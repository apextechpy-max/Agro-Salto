const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { nombre, padre_id } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO categorias (nombre,padre_id) VALUES ($1,$2) RETURNING id',
      [nombre, padre_id || null]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { nombre, padre_id } = req.body;
  try {
    await db.query('UPDATE categorias SET nombre=$1,padre_id=$2 WHERE id=$3', [nombre, padre_id || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
