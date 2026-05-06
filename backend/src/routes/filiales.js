const router = require('express').Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM filiales WHERE activa=1 ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { nombre, direccion, telefono } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const result = await db.query(
      'INSERT INTO filiales (nombre,direccion,telefono) VALUES ($1,$2,$3) RETURNING id',
      [nombre, direccion || '', telefono || '']
    );
    const filial_id = result.rows[0].id;
    // Auto-crear caja para la filial
    await db.query('INSERT INTO cajas (nombre,filial_id) VALUES ($1,$2)', ['Caja Principal', filial_id]);
    res.json({ id: filial_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const { nombre, direccion, telefono, activa } = req.body;
  try {
    await db.query(
      'UPDATE filiales SET nombre=$1,direccion=$2,telefono=$3,activa=$4 WHERE id=$5',
      [nombre, direccion, telefono, activa ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
