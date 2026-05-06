const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', requireRole('ADMIN'), (req, res) => {
  const rows = db.prepare('SELECT id,nombre_completo,usuario,perfil,filial_id,activo,ultimo_acceso,creado_en FROM usuarios ORDER BY id').all();
  res.json(rows);
});

router.post('/', requireRole('ADMIN'), (req, res) => {
  const { nombre_completo, usuario, password, perfil, filial_id } = req.body;
  if (!nombre_completo || !usuario || !password || !perfil) return res.status(400).json({ error: 'Faltan campos' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO usuarios (nombre_completo,usuario,password_hash,perfil,filial_id) VALUES (?,?,?,?,?)').run(nombre_completo, usuario, hash, perfil, filial_id || null);
    res.json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'El usuario ya existe' });
  }
});

router.put('/:id', requireRole('ADMIN'), (req, res) => {
  const { nombre_completo, perfil, filial_id, activo, password } = req.body;
  if (password) {
    db.prepare('UPDATE usuarios SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password, 10), req.params.id);
  }
  db.prepare('UPDATE usuarios SET nombre_completo=?,perfil=?,filial_id=?,activo=? WHERE id=?').run(nombre_completo, perfil, filial_id || null, activo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('ADMIN'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
  db.prepare('UPDATE usuarios SET activo=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
