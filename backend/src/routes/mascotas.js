const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ─── MASCOTAS ───────────────────────────────────────────────

// Listar mascotas (con filtros)
router.get('/', (req, res) => {
  const { persona_id, q } = req.query;
  try {
    let sql = `SELECT m.*, p.razon_social as dueno_nombre, p.telefono as dueno_telefono
               FROM mascotas m
               LEFT JOIN personas p ON p.id = m.persona_id
               WHERE m.activa = 1`;
    const params = [];

    if (persona_id) {
      sql += ' AND m.persona_id = ?';
      params.push(persona_id);
    }
    if (q) {
      sql += ' AND (m.nombre LIKE ? OR m.especie LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY m.nombre';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener mascota por ID (con historial de consultas)
router.get('/:id', (req, res) => {
  try {
    const m = db.prepare(`SELECT m.*, p.razon_social as dueno_nombre, p.telefono as dueno_telefono, p.email as dueno_email
                          FROM mascotas m
                          LEFT JOIN personas p ON p.id = m.persona_id
                          WHERE m.id = ?`).get(req.params.id);

    if (!m) return res.status(404).json({ error: 'Mascota no encontrada' });

    // Consultas
    const consultas = db.prepare(`SELECT c.*, u.nombre_completo as veterinario_nombre
                                  FROM consultas c
                                  LEFT JOIN usuarios u ON u.id = c.veterinario_id
                                  WHERE c.mascota_id = ?
                                  ORDER BY c.fecha DESC
                                  LIMIT 20`).all(m.id);

    // Recetas para cada consulta
    for (const c of consultas) {
      const recetas = db.prepare(`SELECT r.id, r.indicaciones
                                   FROM recetas r
                                   WHERE r.consulta_id = ?`).all(c.id);
      
      for (const r of recetas) {
        const detalles = db.prepare('SELECT descripcion, cantidad, posologia FROM recetas_detalle WHERE receta_id = ?').all(r.id);
        r.detalles = detalles;
      }
      c.recetas = recetas;
    }

    m.consultas = consultas;
    res.json(m);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear mascota
router.post('/', (req, res) => {
  const { persona_id, nombre, especie, raza, color, sexo, fecha_nacimiento, peso_kg, microchip, observaciones } = req.body;
  if (!persona_id || !nombre || !especie) return res.status(400).json({ error: 'persona_id, nombre y especie son requeridos' });

  try {
    const r = db.prepare(`INSERT INTO mascotas (persona_id, nombre, especie, raza, color, sexo, fecha_nacimiento, peso_kg, microchip, observaciones)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      persona_id, nombre, especie, raza || null, color || null, sexo || 'DESCONOCIDO',
      fecha_nacimiento || null, peso_kg || null, microchip || null, observaciones || null
    );

    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar mascota
router.put('/:id', (req, res) => {
  const { nombre, especie, raza, color, sexo, fecha_nacimiento, peso_kg, microchip, observaciones } = req.body;
  try {
    db.prepare(`UPDATE mascotas SET nombre=?, especie=?, raza=?, color=?, sexo=?, fecha_nacimiento=?, peso_kg=?, microchip=?, observaciones=? WHERE id=?`)
      .run(nombre, especie, raza || null, color || null, sexo || 'DESCONOCIDO', fecha_nacimiento || null, peso_kg || null, microchip || null, observaciones || null, req.params.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dar de baja mascota
router.delete('/:id', (req, res) => {
  try {
    db.prepare('UPDATE mascotas SET activa = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener mascotas de una persona
router.get('/persona/:persona_id', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM mascotas WHERE persona_id = ? AND activa = 1 ORDER BY nombre').all(req.params.persona_id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
