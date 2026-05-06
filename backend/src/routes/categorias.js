const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', (req, res) => res.json(db.prepare('SELECT * FROM categorias ORDER BY nombre').all()));

router.post('/', (req, res) => {
  const { nombre, padre_id } = req.body;
  const r = db.prepare('INSERT INTO categorias (nombre,padre_id) VALUES (?,?)').run(nombre, padre_id || null);
  res.json({ id: r.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { nombre, padre_id } = req.body;
  db.prepare('UPDATE categorias SET nombre=?,padre_id=? WHERE id=?').run(nombre, padre_id || null, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
