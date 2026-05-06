const router = require('express').Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM filiales WHERE activa=1 ORDER BY id').all());
});

router.post('/', requireRole('ADMIN'), (req, res) => {
  const { nombre, direccion, telefono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const r = db.prepare('INSERT INTO filiales (nombre,direccion,telefono) VALUES (?,?,?)').run(nombre, direccion || '', telefono || '');
  // Auto-crear caja para la filial
  db.prepare('INSERT INTO cajas (nombre,filial_id) VALUES (?,?)').run('Caja Principal', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

router.put('/:id', requireRole('ADMIN'), (req, res) => {
  const { nombre, direccion, telefono, activa } = req.body;
  db.prepare('UPDATE filiales SET nombre=?,direccion=?,telefono=?,activa=? WHERE id=?').run(nombre, direccion, telefono, activa ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
