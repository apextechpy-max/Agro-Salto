const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await db.query('SELECT id,nombre_completo,usuario,perfil,filial_id,activo,ultimo_acceso,creado_en FROM usuarios ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { nombre_completo, usuario, password, perfil, filial_id } = req.body;
  if (!nombre_completo || !usuario || !password || !perfil) return res.status(400).json({ error: 'Faltan campos' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.query(
      'INSERT INTO usuarios (nombre_completo,usuario,password_hash,perfil,filial_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [nombre_completo, usuario, hash, perfil, filial_id || null]
    );
    res.json({ id: result.rows[0].id });
  } catch (e) {
    res.status(400).json({ error: 'El usuario ya existe o error en los datos' });
  }
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const { nombre_completo, perfil, filial_id, activo, password } = req.body;
  try {
    if (password) {
      await db.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [bcrypt.hashSync(password, 10), req.params.id]);
    }
    await db.query(
      'UPDATE usuarios SET nombre_completo=$1,perfil=$2,filial_id=$3,activo=$4 WHERE id=$5',
      [nombre_completo, perfil, filial_id || null, activo ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
    await db.query('UPDATE usuarios SET activo=0 WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
