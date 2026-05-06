const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { desde, hasta, filial_id } = req.query;
  try {
    let q = `SELECT c.*, p.razon_social as proveedor_nombre, f.nombre as filial_nombre, u.nombre_completo as usuario_nombre
      FROM compras c LEFT JOIN personas p ON p.id=c.proveedor_id LEFT JOIN filiales f ON f.id=c.filial_id
      JOIN usuarios u ON u.id=c.usuario_id WHERE 1=1`;
    const params = [];
    if (desde) { 
      q += ` AND c.fecha >= $${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      q += ` AND c.fecha <= $${params.length + 1}`; 
      params.push(hasta); 
    }
    if (filial_id) { 
      q += ` AND c.filial_id = $${params.length + 1}`; 
      params.push(filial_id); 
    }
    q += ' ORDER BY c.creado_en DESC LIMIT 200';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT c.*, p.razon_social as proveedor_nombre FROM compras c LEFT JOIN personas p ON p.id=c.proveedor_id WHERE c.id=$1`, [req.params.id]);
    const c = result.rows[0];
    if (!c) return res.status(404).json({ error: 'No encontrada' });
    
    const detalleRes = await db.query('SELECT cd.*, pr.nombre as producto_nombre, pr.codigo FROM compras_detalle cd JOIN productos pr ON pr.id=cd.producto_id WHERE cd.compra_id=$1', [c.id]);
    c.detalle = detalleRes.rows;
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { proveedor_id, filial_id, numero_factura, fecha, items, observacion } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin ítems' });

  let subtotal = 0, iva5 = 0, iva10 = 0;
  for (const it of items) {
    subtotal += parseFloat(it.subtotal);
    if (it.iva_tipo === '10') iva10 += it.subtotal * 10 / 110;
    if (it.iva_tipo === '5') iva5 += it.subtotal * 5 / 105;
  }
  const total = subtotal;
  const lotesGenerados = [];

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const compraRes = await client.query(
      'INSERT INTO compras (proveedor_id,filial_id,numero_factura,fecha,subtotal,iva_5,iva_10,total,observacion,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [proveedor_id || null, filial_id, numero_factura || '', fecha || new Date().toISOString().split('T')[0], subtotal, iva5, iva10, total, observacion || '', req.user.id]
    );
    const compraId = compraRes.rows[0].id;

    let secuencia = 1;
    for (const it of items) {
      const codigoLote = `L-${String(compraId).padStart(4,'0')}-${String(secuencia).padStart(2,'0')}`;
      secuencia++;

      const loteRes = await client.query(
        'INSERT INTO lotes (producto_id,filial_id,numero_lote,codigo_lote,fecha_vto,cantidad_ini,cantidad_act,costo_unitario) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [it.producto_id, filial_id, codigoLote, codigoLote, it.fecha_vto || null, it.cantidad, it.cantidad, it.costo_unit]
      );
      const loteId = loteRes.rows[0].id;

      await client.query('INSERT INTO compras_detalle (compra_id,producto_id,cantidad,costo_unit,iva_tipo,subtotal,lote_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [compraId, it.producto_id, it.cantidad, it.costo_unit, it.iva_tipo, it.subtotal, loteId]);

      // Actualizar stock
      await client.query('INSERT INTO stock (producto_id,filial_id,cantidad) VALUES ($1,$2,0) ON CONFLICT DO NOTHING', [it.producto_id, filial_id]);
      await client.query('UPDATE stock SET cantidad = cantidad + $1 WHERE producto_id=$2 AND filial_id=$3', [it.cantidad, it.producto_id, filial_id]);
      
      // Actualizar precio de costo
      await client.query('UPDATE productos SET precio_costo = $1 WHERE id = $2', [it.costo_unit, it.producto_id]);
      
      // Movimiento de stock
      await client.query('INSERT INTO movimientos_stock (tipo,producto_id,lote_id,filial_destino,cantidad,costo_unit,observacion,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        ['COMPRA', it.producto_id, loteId, filial_id, it.cantidad, it.costo_unit, `Compra #${compraId}`, req.user.id]);

      lotesGenerados.push({ loteId, codigoLote, productoId: it.producto_id, cantidad: it.cantidad, fechaVto: it.fecha_vto });
    }

    await client.query('COMMIT');
    res.json({ ok: true, lotes: lotesGenerados });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id/estado', async (req, res) => {
  try {
    await db.query('UPDATE compras SET estado=$1 WHERE id=$2', [req.body.estado, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
