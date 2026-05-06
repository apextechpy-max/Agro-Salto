const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// Stock general con alertas
router.get('/', (req, res) => {
  const { filial_id } = req.query;
  let q = `SELECT p.id, p.codigo, p.nombre, p.unidad_medida, p.stock_minimo, p.precio_costo,
    p.precio_venta_menor, p.precio_venta_mayor, p.iva_tipo, c.nombre as categoria_nombre,
    s.filial_id, f.nombre as filial_nombre, s.cantidad,
    CASE WHEN s.cantidad=0 THEN 'SIN_STOCK' WHEN s.cantidad<=p.stock_minimo THEN 'CRITICO' ELSE 'NORMAL' END as estado_stock,
    (SELECT MIN(fecha_vto) FROM lotes l WHERE l.producto_id = p.id AND l.filial_id = s.filial_id AND l.estado = 'ACTIVO' AND l.cantidad_act > 0) as proximo_vencimiento
    FROM stock s JOIN productos p ON p.id=s.producto_id LEFT JOIN categorias c ON c.id=p.categoria_id
    JOIN filiales f ON f.id=s.filial_id WHERE p.activo=1`;
  const params = [];
  if (filial_id) { q += ' AND s.filial_id=?'; params.push(filial_id); }
  q += ' ORDER BY p.nombre';
  res.json(db.prepare(q).all(...params));
});

// Lotes próximos a vencer / vencidos
router.get('/alertas-vencimiento', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, p.nombre as producto_nombre, p.codigo, f.nombre as filial_nombre,
      CAST((julianday(l.fecha_vto) - julianday('now')) AS INTEGER) as dias_restantes
    FROM lotes l JOIN productos p ON p.id=l.producto_id JOIN filiales f ON f.id=l.filial_id
    WHERE l.estado='ACTIVO' AND l.cantidad_act>0 AND l.fecha_vto IS NOT NULL
      AND julianday(l.fecha_vto) - julianday('now') <= 30
    ORDER BY l.fecha_vto
  `).all();
  res.json(rows);
});

// Movimientos
router.get('/movimientos', (req, res) => {
  const { filial_id, producto_id, desde, hasta } = req.query;
  let q = `SELECT ms.*, p.nombre as producto_nombre, p.codigo, u.nombre_completo as usuario_nombre,
    fo.nombre as filial_origen_nombre, fd.nombre as filial_destino_nombre
    FROM movimientos_stock ms JOIN productos p ON p.id=ms.producto_id JOIN usuarios u ON u.id=ms.usuario_id
    LEFT JOIN filiales fo ON fo.id=ms.filial_origen LEFT JOIN filiales fd ON fd.id=ms.filial_destino WHERE 1=1`;
  const params = [];
  if (filial_id) { q += ' AND (ms.filial_origen=? OR ms.filial_destino=?)'; params.push(filial_id, filial_id); }
  if (producto_id) { q += ' AND ms.producto_id=?'; params.push(producto_id); }
  if (desde) { q += ' AND ms.fecha>=?'; params.push(desde); }
  if (hasta) { q += ' AND ms.fecha<=?'; params.push(hasta + ' 23:59:59'); }
  q += ' ORDER BY ms.fecha DESC LIMIT 200';
  res.json(db.prepare(q).all(...params));
});

// Transferencia entre filiales
router.post('/transferencia', (req, res) => {
  const { producto_id, filial_origen, filial_destino, cantidad, observacion } = req.body;
  if (filial_origen === filial_destino) return res.status(400).json({ error: 'Filiales deben ser diferentes' });
  const stockOrig = db.prepare('SELECT cantidad FROM stock WHERE producto_id=? AND filial_id=?').get(producto_id, filial_origen);
  if (!stockOrig || stockOrig.cantidad < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });

  db.transaction(() => {
    db.prepare('UPDATE stock SET cantidad=cantidad-? WHERE producto_id=? AND filial_id=?').run(cantidad, producto_id, filial_origen);
    db.prepare('INSERT OR IGNORE INTO stock (producto_id,filial_id,cantidad) VALUES (?,?,0)').run(producto_id, filial_destino);
    db.prepare('UPDATE stock SET cantidad=cantidad+? WHERE producto_id=? AND filial_id=?').run(cantidad, producto_id, filial_destino);
    db.prepare('INSERT INTO movimientos_stock (tipo,producto_id,filial_origen,filial_destino,cantidad,observacion,usuario_id) VALUES (?,?,?,?,?,?,?)').run('TRANSFERENCIA', producto_id, filial_origen, filial_destino, cantidad, observacion || '', req.user.id);
  })();
  res.json({ ok: true });
});

// Baja/Daño
router.post('/baja', (req, res) => {
  const { producto_id, filial_id, cantidad, motivo, lote_id } = req.body;
  db.transaction(() => {
    db.prepare('UPDATE stock SET cantidad=MAX(0,cantidad-?) WHERE producto_id=? AND filial_id=?').run(cantidad, producto_id, filial_id);
    if (lote_id) db.prepare('UPDATE lotes SET cantidad_act=MAX(0,cantidad_act-?),estado=CASE WHEN cantidad_act-?<=0 THEN ? ELSE estado END WHERE id=?').run(cantidad, cantidad, motivo === 'VENCIDO' ? 'VENCIDO' : 'BAJA', lote_id);
    db.prepare('INSERT INTO movimientos_stock (tipo,producto_id,lote_id,filial_origen,cantidad,observacion,usuario_id) VALUES (?,?,?,?,?,?,?)').run('BAJA', producto_id, lote_id || null, filial_id, cantidad, motivo || 'BAJA', req.user.id);
  })();
  res.json({ ok: true });
});

module.exports = router;
