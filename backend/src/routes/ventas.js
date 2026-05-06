const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// Listar ventas
router.get('/', (req, res) => {
  const { desde, hasta, filial_id, tipo, estado = 'COMPLETADA' } = req.query;
  try {
    let sql = `SELECT v.*, p.razon_social as cliente_nombre, f.nombre as filial_nombre, u.nombre_completo as usuario_nombre
               FROM ventas v
               LEFT JOIN personas p ON p.id = v.cliente_id
               LEFT JOIN filiales f ON f.id = v.filial_id
               LEFT JOIN usuarios u ON u.id = v.usuario_id
               WHERE v.estado = ?`;
    const params = [estado];

    if (desde) {
      sql += ' AND v.fecha >= ?';
      params.push(desde);
    }
    if (hasta) {
      sql += ' AND v.fecha <= ?';
      params.push(hasta + ' 23:59:59');
    }
    if (filial_id) {
      sql += ' AND v.filial_id = ?';
      params.push(filial_id);
    }
    if (tipo) {
      sql += ' AND v.tipo = ?';
      params.push(tipo);
    }

    sql += ' ORDER BY v.fecha DESC LIMIT 300';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener venta por ID
router.get('/:id', (req, res) => {
  try {
    const v = db.prepare(`SELECT v.*, p.razon_social as cliente_nombre, p.ruc, p.condicion_iva
                          FROM ventas v
                          LEFT JOIN personas p ON p.id = v.cliente_id
                          WHERE v.id = ?`).get(req.params.id);

    if (!v) return res.status(404).json({ error: 'No encontrada' });

    const detalle = db.prepare(`SELECT vd.*, p.nombre as producto_nombre, p.codigo
                                FROM ventas_detalle vd
                                LEFT JOIN productos p ON p.id = vd.producto_id
                                WHERE vd.venta_id = ?`).all(v.id);

    v.detalle = detalle;
    res.json(v);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear venta
router.post('/', (req, res) => {
  const { tipo, cliente_id, filial_id, items, tipo_pago, monto_pagado, descuento_global, vendedor_id, observacion, comprobante_pago, moneda_pago } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin ítems' });

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
    const vuelto = (monto_pagado || 0) > total ? (monto_pagado - total) : 0;

    let venta_id;
    
    // Iniciar transacción para asegurar consistencia
    db.transaction(() => {
      // Obtener apertura activa con tasas de cambio
      const apertura = db.prepare("SELECT * FROM aperturas_caja WHERE filial_id=? AND estado='ABIERTA' ORDER BY id DESC LIMIT 1").get(filial_id);
      
      // Lógica de conversión
      let montoGS = monto_pagado || total;
      if (moneda_pago && moneda_pago !== 'GS' && apertura) {
        const rate = moneda_pago === 'USD' ? apertura.cambio_usd : 
                     moneda_pago === 'BRL' ? apertura.cambio_brl : 
                     moneda_pago === 'ARS' ? apertura.cambio_ars : 1;
        montoGS = (monto_pagado || total) * rate;
      }

      const vuelto = montoGS > total ? (montoGS - total) : 0;

      const r = db.prepare(`INSERT INTO ventas (tipo, cliente_id, filial_id, subtotal, descuento, iva_5, iva_10, total, tipo_pago, monto_pagado, vuelto, estado, vendedor_id, usuario_id, observacion, comprobante_pago, moneda_pago)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
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
      );

      venta_id = r.lastInsertRowid;

      const insertDetalle = db.prepare(`INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unit, iva_tipo, descuento, subtotal)
                                        VALUES (?, ?, ?, ?, ?, ?, ?)`);
      const insertMovStock = db.prepare(`INSERT INTO movimientos_stock (tipo, producto_id, filial_origen, cantidad, observacion, usuario_id)
                                         VALUES (?, ?, ?, ?, ?, ?)`);
      const updateStock = db.prepare(`UPDATE stock SET cantidad = cantidad - ? WHERE producto_id = ? AND filial_id = ?`);

      for (const it of processedItems) {
        insertDetalle.run(venta_id, it.producto_id, it.cantidad, it.precio_unit, it.iva_tipo, it.descuento || 0, it._sub);

        if (tipo !== 'PRESUPUESTO') {
          insertMovStock.run('VENTA', it.producto_id, filial_id, -it.cantidad, `Venta #${venta_id}`, req.user.id);
          updateStock.run(it.cantidad, it.producto_id, filial_id);
        }
      }

      // Caja
      if (tipo !== 'PRESUPUESTO' && tipo_pago !== 'CREDITO') {
        if (apertura) {
          db.prepare(`INSERT INTO movimientos_caja (apertura_id, tipo, concepto, ref_tipo, ref_id, monto, usuario_id)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            apertura.id, 'INGRESO', `Venta #${venta_id} (${moneda_pago || 'GS'})`, 'VENTA', venta_id, montoGS, req.user.id
          );
        }
      }
      
      // Si es crédito, generar cuenta corriente
      if (tipo !== 'PRESUPUESTO' && tipo_pago === 'CREDITO') {
        db.prepare('INSERT INTO cuentas_corrientes (persona_id,tipo,concepto,monto_original,saldo,ref_tipo,ref_id,usuario_id) VALUES (?,?,?,?,?,?,?,?)').run(cliente_id, 'COBRAR', `Venta #${venta_id}`, total, total, 'VENTA', venta_id, req.user.id);
        db.prepare('UPDATE personas SET saldo_cuenta=saldo_cuenta+? WHERE id=?').run(total, cliente_id);
      }
    })();

    res.json({ id: venta_id, total, vuelto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Anular venta
router.patch('/:id/anular', (req, res) => {
  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id=?').get(req.params.id);
    if (!venta || venta.estado !== 'COMPLETADA') return res.status(400).json({ error: 'Venta no anulable' });

    db.transaction(() => {
      db.prepare("UPDATE ventas SET estado='ANULADA' WHERE id=?").run(venta.id);
      const detalle = db.prepare('SELECT * FROM ventas_detalle WHERE venta_id=?').all(venta.id);
      for (const d of detalle) {
        db.prepare('UPDATE stock SET cantidad=cantidad+? WHERE producto_id=? AND filial_id=?').run(d.cantidad, d.producto_id, venta.filial_id);
        db.prepare('INSERT INTO movimientos_stock (tipo,producto_id,filial_origen,cantidad,observacion,usuario_id) VALUES (?,?,?,?,?,?)').run('AJUSTE', d.producto_id, venta.filial_id, d.cantidad, `Anulación Venta #${venta.id}`, req.user.id);
      }
      // Reversar caja si aplica
      if (venta.tipo_pago !== 'CREDITO') {
         const apertura = db.prepare("SELECT id FROM aperturas_caja WHERE filial_id=? AND estado='ABIERTA' ORDER BY id DESC LIMIT 1").get(venta.filial_id);
         if (apertura) {
           db.prepare(`INSERT INTO movimientos_caja (apertura_id, tipo, concepto, ref_tipo, ref_id, monto, usuario_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
             apertura.id, 'EGRESO', `Anulación Venta #${venta.id}`, 'VENTA', venta.id, -venta.total, req.user.id
           );
         }
      }
    })();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cobrar Pre-Venta
router.post('/:id/cobrar', (req, res) => {
  const { tipo_pago, monto_pagado, observacion, comprobante_pago, moneda_pago } = req.body;
  const ventaId = req.params.id;

  try {
    const venta = db.prepare('SELECT * FROM ventas WHERE id=?').get(ventaId);
    if (!venta || venta.estado !== 'PRE-VENTA') return res.status(400).json({ error: 'Venta no encontrada o ya procesada' });

    const vuelto = (monto_pagado || 0) > venta.total ? (monto_pagado - venta.total) : 0;

    db.transaction(() => {
      // Obtener apertura activa con tasas de cambio
      const apertura = db.prepare("SELECT * FROM aperturas_caja WHERE filial_id=? AND estado='ABIERTA' ORDER BY id DESC LIMIT 1").get(venta.filial_id);
      
      // Lógica de conversión
      let montoGS = monto_pagado || venta.total;
      if (moneda_pago && moneda_pago !== 'GS' && apertura) {
        const rate = moneda_pago === 'USD' ? apertura.cambio_usd : 
                     moneda_pago === 'BRL' ? apertura.cambio_brl : 
                     moneda_pago === 'ARS' ? apertura.cambio_ars : 1;
        montoGS = (monto_pagado || venta.total) * rate;
      }

      const vuelto = montoGS > venta.total ? (montoGS - venta.total) : 0;

      // Actualizar la venta
      db.prepare('UPDATE ventas SET estado=?, tipo_pago=?, monto_pagado=?, vuelto=?, observacion=?, comprobante_pago=?, moneda_pago=? WHERE id=?')
        .run('COMPLETADA', tipo_pago || 'CONTADO', monto_pagado || venta.total, vuelto, observacion || '', comprobante_pago || null, moneda_pago || 'GS', ventaId);

      // Descontar stock
      const detalle = db.prepare('SELECT * FROM ventas_detalle WHERE venta_id=?').all(ventaId);
      for (const d of detalle) {
        db.prepare('UPDATE stock SET cantidad=cantidad-? WHERE producto_id=? AND filial_id=?').run(d.cantidad, d.producto_id, venta.filial_id);
        db.prepare('INSERT INTO movimientos_stock (tipo,producto_id,filial_origen,cantidad,observacion,usuario_id) VALUES (?,?,?,?,?,?)').run('VENTA', d.producto_id, venta.filial_id, d.cantidad, `Venta #${ventaId} (Cobro)`, req.user.id);
      }

      // Registrar en caja
      if (tipo_pago !== 'CREDITO') {
        if (apertura) {
          db.prepare("INSERT INTO movimientos_caja (apertura_id,tipo,concepto,ref_tipo,ref_id,monto,usuario_id) VALUES (?,?,?,?,?,?,?)").run(
            apertura.id, 'INGRESO', `Venta #${ventaId} (${moneda_pago || 'GS'}) (Cobro Pre-Venta)`, 'VENTA', ventaId, montoGS, req.user.id
          );
        }
      }

      // Si es crédito, generar cuenta corriente
      if (tipo_pago === 'CREDITO') {
        db.prepare('INSERT INTO cuentas_corrientes (persona_id,tipo,concepto,monto_original,saldo,ref_tipo,ref_id,usuario_id) VALUES (?,?,?,?,?,?,?,?)').run(venta.cliente_id, 'COBRAR', `Venta #${ventaId}`, venta.total, venta.total, 'VENTA', ventaId, req.user.id);
        db.prepare('UPDATE personas SET saldo_cuenta=saldo_cuenta+? WHERE id=?').run(venta.total, venta.cliente_id);
      }
    })();

    res.json({ id: ventaId, total: venta.total, vuelto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
