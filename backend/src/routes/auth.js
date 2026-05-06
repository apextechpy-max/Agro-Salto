const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Credenciales requeridas' });
  }

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE usuario = $1 AND activo = 1', [usuario]);
    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Actualizar último acceso
    await db.query('UPDATE usuarios SET ultimo_acceso = $1 WHERE id = $2', [new Date().toISOString(), user.id]);

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre_completo, usuario: user.usuario, perfil: user.perfil, filial_id: user.filial_id },
      SECRET, { expiresIn: '10h' }
    );
    const { password_hash, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => res.json({ ok: true }));

// GET /api/auth/me
router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    const user = jwt.verify(header.slice(7), SECRET);
    res.json(user);
  } catch { res.status(401).json({ error: 'Token inválido' }); }
});

module.exports = router;
