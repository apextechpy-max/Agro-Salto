const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', (req, res) => {
  const { desde, hasta, filial_id } = req.query;
  let q = `SELECT c.*, p.razon_social as proveedor_nombre, f.nombre as filial_nombre, u.nombre_completo as usuario_nombre
    FROM compras c LEFT JOIN personas p ON p.id=c.proveedor_id LEFT JOIN filiales f ON f.id=c.filial_id
    JOIN usuarios u ON u.id=c.usuario_id WHERE 1=1`;
  const params = [];
  if (desde) { q += ' AND c.fecha>=?'; params.push(desde); }
  if (hasta) { q += ' AND c.fecha<=?'; params.push(hasta); }
  if (filial_id) { q += ' AND c.filial_id=?'; params.push(filial_id); }
  q += ' ORDER BY c.creado_en DESC LIMIT 200';
  res.json(db.prepare(q).all(...params));
});

router.get('/:id', (req, res) => {
  const c = db.prepare(`SELECT c.*, p.razon_social as proveedor_nombre FROM compras c LEFT JOIN personas p ON p.id=c.proveedor_id WHERE c.id=?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'No encontrada' });
  c.detalle = db.prepare('SELECT cd.*, pr.nombre as producto_nombre, pr.codigo FROM compras_detalle cd JOIN productos pr ON pr.id=cd.producto_id WHERE cd.compra_id=?').all(c.id);
  res.json(c);
});

router.post('/', (req, res) => {
  const { proveedor_id, filial_id, numero_factura, fecha, items, observacion } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin ítems' });

  let subtotal = 0, iva5 = 0, iva10 = 0;
  for (const it of items) {
    subtotal += it.subtotal;
    if (it.iva_tipo === '10') iva10 += it.subtotal * 10 / 110;
    if (it.iva_tipo === '5') iva5 += it.subtotal * 5 / 105;
  }
  const total = subtotal;
  const lotesGenerados = [];

  db.transaction(() => {
    const r = db.prepare(
      'INSERT INTO compras (proveedor_id,filial_id,numero_factura,fecha,subtotal,iva_5,iva_10,total,observacion,usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(proveedor_id || null, filial_id, numero_factura || '', fecha || new Date().toISOString().split('T')[0], subtotal, iva5, iva10, total, observacion || '', req.user.id);
    const compraId = r.lastInsertRowid;

    // Autogenerar código de lote: L-{compraId}-{secuencial}
    const insD = db.prepare('INSERT INTO compras_detalle (compra_id,producto_id,cantidad,costo_unit,iva_tipo,subtotal,lote_id) VALUES (?,?,?,?,?,?,?)');
    let secuencia = 1;

    for (const it of items) {
      // Crear lote autogenerado
      const codigoLote = `L-${String(compraId).padStart(4,'0')}-${String(secuencia).padStart(2,'0')}`;
      secuencia++;

      const loteRes = db.prepare(
        'INSERT INTO lotes (producto_id,filial_id,numero_lote,codigo_lote,fecha_vto,cantidad_ini,cantidad_act,costo_unitario) VALUES (?,?,?,?,?,?,?,?)'
      ).run(it.producto_id, filial_id, codigoLote, codigoLote, it.fecha_vto || null, it.cantidad, it.cantidad, it.costo_unit);
      const loteId = loteRes.lastInsertRowid;

      insD.run(compraId, it.producto_id, it.cantidad, it.costo_unit, it.iva_tipo, it.subtotal, loteId);

      // actualizar stock general
      db.prepare('INSERT OR IGNORE INTO stock (producto_id,filial_id,cantidad) VALUES (?,?,0)').run(it.producto_id, filial_id);
      db.prepare('UPDATE stock SET cantidad=cantidad+? WHERE producto_id=? AND filial_id=?').run(it.cantidad, it.producto_id, filial_id);
      // actualizar precio de costo
      db.prepare('UPDATE productos SET precio_costo=? WHERE id=?').run(it.costo_unit, it.producto_id);
      // movimiento de stock
      db.prepare('INSERT INTO movimientos_stock (tipo,producto_id,lote_id,filial_destino,cantidad,costo_unit,observacion,usuario_id) VALUES (?,?,?,?,?,?,?,?)').run('COMPRA', it.producto_id, loteId, filial_id, it.cantidad, it.costo_unit, `Compra #${compraId}`, req.user.id);

      lotesGenerados.push({ loteId, codigoLote, productoId: it.producto_id, cantidad: it.cantidad, fechaVto: it.fecha_vto });
    }
  })();

  res.json({ ok: true, lotes: lotesGenerados });
});

router.patch('/:id/estado', (req, res) => {
  db.prepare('UPDATE compras SET estado=? WHERE id=?').run(req.body.estado, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
