const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// Cajas disponibles
router.get('/cajas', (req, res) => {
  const { filial_id } = req.query;
  let q = 'SELECT c.*, f.nombre as filial_nombre FROM cajas c JOIN filiales f ON f.id=c.filial_id WHERE c.activa=1';
  const params = [];
  if (filial_id) { q += ' AND c.filial_id=?'; params.push(filial_id); }
  res.json(db.prepare(q).all(...params));
});

// Apertura activa
router.get('/apertura-activa', (req, res) => {
  const { caja_id } = req.query;
  const a = db.prepare("SELECT a.*, u.nombre_completo as usuario_nombre, c.nombre as caja_nombre FROM aperturas_caja a JOIN usuarios u ON u.id=a.usuario_id JOIN cajas c ON c.id=a.caja_id WHERE a.caja_id=? AND a.estado='ABIERTA' ORDER BY a.id DESC LIMIT 1").get(caja_id);
  res.json(a || null);
});

// Abrir caja
router.post('/abrir', (req, res) => {
  const { caja_id, monto_inicial, cambio_usd, cambio_brl, cambio_ars } = req.body;
  const caja = db.prepare('SELECT * FROM cajas WHERE id=?').get(caja_id);
  if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });
  const abierta = db.prepare("SELECT id FROM aperturas_caja WHERE caja_id=? AND estado='ABIERTA'").get(caja_id);
  if (abierta) return res.status(400).json({ error: 'La caja ya está abierta' });
  const r = db.prepare('INSERT INTO aperturas_caja (caja_id,usuario_id,filial_id,monto_inicial,cambio_usd,cambio_brl,cambio_ars) VALUES (?,?,?,?,?,?,?)').run(caja_id, req.user.id, caja.filial_id, monto_inicial || 0, cambio_usd || 0, cambio_brl || 0, cambio_ars || 0);
  db.prepare("INSERT INTO movimientos_caja (apertura_id,tipo,concepto,ref_tipo,monto,usuario_id) VALUES (?,?,?,?,?,?)").run(r.lastInsertRowid, 'INGRESO', 'Fondo inicial', 'APERTURA', monto_inicial || 0, req.user.id);
  res.json({ id: r.lastInsertRowid });
});


// Movimientos de una apertura
router.get('/:apertura_id/movimientos', (req, res) => {
  const movs = db.prepare('SELECT m.*, u.nombre_completo as usuario_nombre FROM movimientos_caja m JOIN usuarios u ON u.id=m.usuario_id WHERE m.apertura_id=? ORDER BY m.fecha').all(req.params.apertura_id);
  res.json(movs);
});

// Agregar movimiento manual
router.post('/:apertura_id/movimiento', (req, res) => {
  const { tipo, concepto, monto } = req.body;
  if (!tipo || !monto) return res.status(400).json({ error: 'Faltan datos' });
  db.prepare("INSERT INTO movimientos_caja (apertura_id,tipo,concepto,ref_tipo,monto,usuario_id) VALUES (?,?,?,?,?,?)").run(req.params.apertura_id, tipo, concepto, 'MANUAL', monto, req.user.id);
  res.json({ ok: true });
});

// Cerrar caja (CIEGO - el cajero declara sin ver el total)
router.post('/cerrar', (req, res) => {
  const { apertura_id, monto_declarado } = req.body;
  const apertura = db.prepare("SELECT * FROM aperturas_caja WHERE id=? AND estado='ABIERTA'").get(apertura_id);
  if (!apertura) return res.status(400).json({ error: 'Apertura no válida' });

  const movs = db.prepare("SELECT tipo, monto FROM movimientos_caja WHERE apertura_id=?").all(apertura_id);
  let monto_sistema = 0;
  for (const m of movs) monto_sistema += m.tipo === 'INGRESO' ? m.monto : -m.monto;

  const diferencia = (monto_declarado || 0) - monto_sistema;
  db.prepare("UPDATE aperturas_caja SET estado='CERRADA',fecha_cierre=datetime('now'),monto_declarado=?,monto_sistema=?,diferencia=? WHERE id=?").run(monto_declarado || 0, monto_sistema, diferencia, apertura_id);
  res.json({ monto_sistema, diferencia });
});

// Historial de aperturas (ADMIN)
router.get('/historial', (req, res) => {
  const { filial_id, desde, hasta } = req.query;
  let q = `SELECT a.*, u.nombre_completo as usuario_nombre, c.nombre as caja_nombre, f.nombre as filial_nombre
    FROM aperturas_caja a JOIN usuarios u ON u.id=a.usuario_id JOIN cajas c ON c.id=a.caja_id JOIN filiales f ON f.id=a.filial_id WHERE 1=1`;
  const params = [];
  if (filial_id) { q += ' AND a.filial_id=?'; params.push(filial_id); }
  if (desde) { q += ' AND a.fecha_apertura>=?'; params.push(desde); }
  if (hasta) { q += ' AND a.fecha_apertura<=?'; params.push(hasta + ' 23:59:59'); }
  q += ' ORDER BY a.fecha_apertura DESC LIMIT 100';
  res.json(db.prepare(q).all(...params));
});

module.exports = router;
