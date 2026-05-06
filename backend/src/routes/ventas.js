const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// Listar ventas
router.get('/', async (req, res) => {
  const { desde, hasta, filial_id, tipo, estado = 'COMPLETADA' } = req.query;
  try {
    let sql = `SELECT v.*, p.razon_social as cliente_nombre, f.nombre as filial_nombre, u.nombre_completo as usuario_nombre
               FROM ventas v
               LEFT JOIN personas p ON p.id = v.cliente_id
               LEFT JOIN filiales f ON f.id = v.filial_id
               LEFT JOIN usuarios u ON u.id = v.usuario_id
               WHERE v.estado = $1`;
    const params = [estado];

    if (desde) {
      sql += ` AND v.fecha >= $${params.length + 1}`;
      params.push(desde);
    }
    if (hasta) {
      sql += ` AND v.fecha <= $${params.length + 1}`;
      params.push(hasta + ' 23:59:59');
    }
    if (filial_id) {
      sql += ` AND v.filial_id = $${params.length + 1}`;
      params.push(filial_id);
    }
    if (tipo) {
      sql += ` AND v.tipo = $${params.length + 1}`;
      params.push(tipo);
    }

    sql += ' ORDER BY v.fecha DESC LIMIT 300';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener venta por ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT v.*, p.razon_social as cliente_nombre, p.ruc, p.condicion_iva
                          FROM ventas v
                          LEFT JOIN personas p ON p.id = v.cliente_id
                          WHERE v.id = $1`, [req.params.id]);
    const v = result.rows[0];

    if (!v) return res.status(404).json({ error: 'No encontrada' });

    const detalleRes = await db.query(`SELECT vd.*, p.nombre as producto_nombre, p.codigo
                                 FROM ventas_detalle vd
                                 LEFT JOIN productos p ON p.id = vd.producto_id
                                 WHERE vd.venta_id = $1`, [v.id]);
    v.detalle = detalleRes.rows;
    res.json(v);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear venta
router.post('/', async (req, res) => {
  const { tipo, cliente_id, filial_id, items, tipo_pago, monto_pagado, descuento_global, vendedor_id, observacion, comprobante_pago, moneda_pago } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin ítems' });

  const client = await db.pool.connect();
  try {
    let subtotal = 0, iva5 = 0, iva10 = 0;
    const processedItems = items.map(it => {
      const s = it.cantidad * it.precio_unit - (it.descuento || 0);
      subtotal += s;
      if (it.iva_tipo === '10') iva10 += s * 10 / 110;
      if (it.iva_tipo === '5') iva5 += s * 5 / 105;
      return { ...it, _sub: s };
    });

    const desc = descuento_global || 0;
    const total = subtotal - desc;

    await client.query('BEGIN');

    // Obtener apertura activa
    const apRes = await client.query("SELECT * FROM aperturas_caja WHERE filial_id=$1 AND estado='ABIERTA' ORDER BY id DESC LIMIT 1", [filial_id]);
    const apertura = apRes.rows[0];
    
    // Lógica de conversión
    let montoGS = monto_pagado || total;
    if (moneda_pago && moneda_pago !== 'GS' && apertura) {
      const rate = moneda_pago === 'USD' ? apertura.cambio_usd : 
                   moneda_pago === 'BRL' ? apertura.cambio_brl : 
                   moneda_pago === 'ARS' ? apertura.cambio_ars : 1;
      montoGS = (monto_pagado || total) * rate;
    }

    const vuelto = montoGS > total ? (montoGS - total) : 0;

    const vRes = await client.query(`INSERT INTO ventas (tipo, cliente_id, filial_id, subtotal, descuento, iva_5, iva_10, total, tipo_pago, monto_pagado, vuelto, estado, vendedor_id, usuario_id, observacion, comprobante_pago, moneda_pago)
                          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`, [
      tipo || 'MINORISTA',
      cliente_id || null,
      filial_id,
      subtotal, desc, iva5, iva10, total,
      tipo_pago || 'CONTADO',
      monto_pagado || total,
      vuelto,
      tipo === 'PRESUPUESTO' ? 'PRESUPUESTO' : 'COMPLETADA',
      vendedor_id || null,
      req.user.id,
      observacion || '',
      comprobante_pago || null,
      moneda_pago || 'GS'
    ]);
    const venta_id = vRes.rows[0].id;

    for (const it of processedItems) {
      await client.query(`INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unit, iva_tipo, descuento, subtotal)
                                        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [venta_id, it.producto_id, it.cantidad, it.precio_unit, it.iva_tipo, it.descuento || 0, it._sub]);

      if (tipo !== 'PRESUPUESTO') {
        await client.query(`INSERT INTO movimientos_stock (tipo, producto_id, filial_origen, cantidad, observacion, usuario_id)
                                         VALUES ($1,$2,$3,$4,$5,$6)`, ['VENTA', it.producto_id, filial_id, -it.cantidad, `Venta #${venta_id}`, req.user.id]);
        await client.query(`UPDATE stock SET cantidad = cantidad - $1 WHERE producto_id = $2 AND filial_id = $3`, [it.cantidad, it.producto_id, filial_id]);
      }
    }

    // Caja
    if (tipo !== 'PRESUPUESTO' && tipo_pago !== 'CREDITO' && apertura) {
      await client.query(`INSERT INTO movimientos_caja (apertura_id, tipo, concepto, ref_tipo, ref_id, monto, usuario_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [apertura.id, 'INGRESO', `Venta #${venta_id} (${moneda_pago || 'GS'})`, 'VENTA', venta_id, montoGS, req.user.id]);
    }
    
    // Crédito
    if (tipo !== 'PRESUPUESTO' && tipo_pago === 'CREDITO') {
      await client.query('INSERT INTO cuentas_corrientes (persona_id,tipo,concepto,monto_original,saldo,ref_tipo,ref_id,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [cliente_id, 'COBRAR', `Venta #${venta_id}`, total, total, 'VENTA', venta_id, req.user.id]);
      await client.query('UPDATE personas SET saldo_cuenta = saldo_cuenta + $1 WHERE id = $2', [total, cliente_id]);
    }

    await client.query('COMMIT');
    res.json({ id: venta_id, total, vuelto });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Anular venta
router.patch('/:id/anular', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const vRes = await client.query('SELECT * FROM ventas WHERE id=$1', [req.params.id]);
    const venta = vRes.rows[0];
    if (!venta || venta.estado !== 'COMPLETADA') return res.status(400).json({ error: 'Venta no anulable' });

    await client.query('BEGIN');
    await client.query("UPDATE ventas SET estado='ANULADA' WHERE id=$1", [venta.id]);
    
    const detRes = await client.query('SELECT * FROM ventas_detalle WHERE venta_id=$1', [venta.id]);
    for (const d of detRes.rows) {
      await client.query('UPDATE stock SET cantidad = cantidad + $1 WHERE producto_id=$2 AND filial_id=$3', [d.cantidad, d.producto_id, venta.filial_id]);
      await client.query('INSERT INTO movimientos_stock (tipo,producto_id,filial_origen,cantidad,observacion,usuario_id) VALUES ($1,$2,$3,$4,$5,$6)', ['AJUSTE', d.producto_id, venta.filial_id, d.cantidad, `Anulación Venta #${venta.id}`, req.user.id]);
    }

    // Reversar caja
    if (venta.tipo_pago !== 'CREDITO') {
      const apRes = await client.query("SELECT id FROM aperturas_caja WHERE filial_id=$1 AND estado='ABIERTA' ORDER BY id DESC LIMIT 1", [venta.filial_id]);
      const apertura = apRes.rows[0];
      if (apertura) {
        await client.query(`INSERT INTO movimientos_caja (apertura_id, tipo, concepto, ref_tipo, ref_id, monto, usuario_id)
                      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [apertura.id, 'EGRESO', `Anulación Venta #${venta.id}`, 'VENTA', venta.id, -venta.total, req.user.id]);
      }
    }
    
    // Si era crédito, reversar cuenta corriente
    if (venta.tipo_pago === 'CREDITO') {
      await client.query("UPDATE personas SET saldo_cuenta = saldo_cuenta - $1 WHERE id = $2", [venta.total, venta.cliente_id]);
      await client.query("UPDATE cuentas_corrientes SET estado='ANULADA', saldo=0 WHERE ref_tipo='VENTA' AND ref_id=$1", [venta.id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Cobrar Pre-Venta
router.post('/:id/cobrar', async (req, res) => {
  const { tipo_pago, monto_pagado, observacion, comprobante_pago, moneda_pago } = req.body;
  const ventaId = req.params.id;

  const client = await db.pool.connect();
  try {
    const vRes = await client.query('SELECT * FROM ventas WHERE id=$1', [ventaId]);
    const venta = vRes.rows[0];
    if (!venta || venta.estado !== 'PRE-VENTA') return res.status(400).json({ error: 'Venta no encontrada o ya procesada' });

    await client.query('BEGIN');

    const apRes = await client.query("SELECT * FROM aperturas_caja WHERE filial_id=$1 AND estado='ABIERTA' ORDER BY id DESC LIMIT 1", [venta.filial_id]);
    const apertura = apRes.rows[0];
    
    let montoGS = monto_pagado || venta.total;
    if (moneda_pago && moneda_pago !== 'GS' && apertura) {
      const rate = moneda_pago === 'USD' ? apertura.cambio_usd : 
                   moneda_pago === 'BRL' ? apertura.cambio_brl : 
                   moneda_pago === 'ARS' ? apertura.cambio_ars : 1;
      montoGS = (monto_pagado || venta.total) * rate;
    }

    const vuelto = montoGS > venta.total ? (montoGS - venta.total) : 0;

    await client.query('UPDATE ventas SET estado=$1, tipo_pago=$2, monto_pagado=$3, vuelto=$4, observacion=$5, comprobante_pago=$6, moneda_pago=$7 WHERE id=$8',
      ['COMPLETADA', tipo_pago || 'CONTADO', monto_pagado || venta.total, vuelto, observacion || '', comprobante_pago || null, moneda_pago || 'GS', ventaId]);

    const detRes = await client.query('SELECT * FROM ventas_detalle WHERE venta_id=$1', [ventaId]);
    for (const d of detRes.rows) {
      await client.query('UPDATE stock SET cantidad = cantidad - $1 WHERE producto_id=$2 AND filial_id=$3', [d.cantidad, d.producto_id, venta.filial_id]);
      await client.query('INSERT INTO movimientos_stock (tipo,producto_id,filial_origen,cantidad,observacion,usuario_id) VALUES ($1,$2,$3,$4,$5,$6)', ['VENTA', d.producto_id, venta.filial_id, d.cantidad, `Venta #${ventaId} (Cobro)`, req.user.id]);
    }

    if (tipo_pago !== 'CREDITO' && apertura) {
      await client.query("INSERT INTO movimientos_caja (apertura_id,tipo,concepto,ref_tipo,ref_id,monto,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [apertura.id, 'INGRESO', `Venta #${ventaId} (${moneda_pago || 'GS'}) (Cobro Pre-Venta)`, 'VENTA', ventaId, montoGS, req.user.id]);
    }

    if (tipo_pago === 'CREDITO') {
      await client.query('INSERT INTO cuentas_corrientes (persona_id,tipo,concepto,monto_original,saldo,ref_tipo,ref_id,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [venta.cliente_id, 'COBRAR', `Venta #${ventaId}`, venta.total, venta.total, 'VENTA', ventaId, req.user.id]);
      await client.query('UPDATE personas SET saldo_cuenta = saldo_cuenta + $1 WHERE id = $2', [venta.total, venta.cliente_id]);
    }

    await client.query('COMMIT');
    res.json({ id: ventaId, total: venta.total, vuelto });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
