const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', (req, res) => {
  const { tipo, buscar, activo = 1 } = req.query;
  let q = 'SELECT * FROM personas WHERE activo=?';
  const params = [parseInt(activo)];
  if (tipo) { q += ' AND tipo=?'; params.push(tipo); }
  if (buscar) { q += ' AND (razon_social LIKE ? OR ruc LIKE ? OR telefono LIKE ?)'; params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`); }
  q += ' ORDER BY razon_social';
  res.json(db.prepare(q).all(...params));
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM personas WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  p.cuentas = db.prepare('SELECT * FROM cuentas_corrientes WHERE persona_id=? ORDER BY creado_en DESC').all(p.id);
  res.json(p);
});

router.post('/', (req, res) => {
  const { tipo, razon_social, ruc, ci, telefono, email, direccion, condicion_iva, condicion_pago, limite_credito, comision_pct } = req.body;
  if (!tipo || !razon_social) return res.status(400).json({ error: 'Tipo y nombre son requeridos' });
  const r = db.prepare(
    'INSERT INTO personas (tipo,razon_social,ruc,ci,telefono,email,direccion,condicion_iva,condicion_pago,limite_credito,comision_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(tipo, razon_social, ruc || '', ci || '', telefono || '', email || '', direccion || '', condicion_iva || 'CONTRIBUYENTE', condicion_pago || 'CONTADO', limite_credito || 0, comision_pct || 0);
  res.json({ id: r.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { tipo, razon_social, ruc, ci, telefono, email, direccion, condicion_iva, condicion_pago, limite_credito, comision_pct, activo } = req.body;
  db.prepare(
    'UPDATE personas SET tipo=?,razon_social=?,ruc=?,ci=?,telefono=?,email=?,direccion=?,condicion_iva=?,condicion_pago=?,limite_credito=?,comision_pct=?,activo=? WHERE id=?'
  ).run(tipo, razon_social, ruc, ci, telefono, email, direccion, condicion_iva, condicion_pago, limite_credito, comision_pct, activo !== undefined ? (activo ? 1 : 0) : 1, req.params.id);
  res.json({ ok: true });
});

// Registrar pago de cuenta corriente
router.post('/:id/pago', (req, res) => {
  const { cuenta_id, monto, tipo_pago, observacion } = req.body;
  const cuenta = db.prepare('SELECT * FROM cuentas_corrientes WHERE id=?').get(cuenta_id);
  if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
  const nuevo_saldo = Math.max(0, cuenta.saldo - monto);
  const estado = nuevo_saldo === 0 ? 'PAGADO' : 'PARCIAL';
  db.prepare('UPDATE cuentas_corrientes SET saldo=?,estado=? WHERE id=?').run(nuevo_saldo, estado, cuenta_id);
  db.prepare('INSERT INTO pagos_cc (cuenta_id,monto,tipo_pago,usuario_id,observacion) VALUES (?,?,?,?,?)').run(cuenta_id, monto, tipo_pago || 'EFECTIVO', req.user.id, observacion || '');
  // actualizar saldo en persona
  db.prepare('UPDATE personas SET saldo_cuenta=saldo_cuenta-? WHERE id=?').run(monto, req.params.id);
  res.json({ ok: true, nuevo_saldo });
});

module.exports = router;
