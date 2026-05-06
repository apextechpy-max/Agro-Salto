const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ─── MASCOTAS ───────────────────────────────────────────────

// Listar mascotas (con filtros)
router.get('/', async (req, res) => {
  const { persona_id, q } = req.query;
  try {
    let sql = `SELECT m.*, p.razon_social as dueno_nombre, p.telefono as dueno_telefono
               FROM mascotas m
               LEFT JOIN personas p ON p.id = m.persona_id
               WHERE m.activa = 1`;
    const params = [];

    if (persona_id) {
      sql += ` AND m.persona_id = $${params.length + 1}`;
      params.push(persona_id);
    }
    if (q) {
      sql += ` AND (m.nombre ILIKE $${params.length + 1} OR m.especie ILIKE $${params.length + 2})`;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY m.nombre';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener mascota por ID (con historial de consultas)
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT m.*, p.razon_social as dueno_nombre, p.telefono as dueno_telefono, p.email as dueno_email
                          FROM mascotas m
                          LEFT JOIN personas p ON p.id = m.persona_id
                          WHERE m.id = $1`, [req.params.id]);
    const m = result.rows[0];

    if (!m) return res.status(404).json({ error: 'Mascota no encontrada' });

    // Consultas
    const consultasRes = await db.query(`SELECT c.*, u.nombre_completo as veterinario_nombre
                                  FROM consultas c
                                  LEFT JOIN usuarios u ON u.id = c.veterinario_id
                                  WHERE c.mascota_id = $1
                                  ORDER BY c.fecha DESC
                                  LIMIT 20`, [m.id]);
    const consultas = consultasRes.rows;

    // Recetas para cada consulta
    for (const c of consultas) {
      const recetasRes = await db.query(`SELECT r.id, r.indicaciones
                                   FROM recetas r
                                   WHERE r.consulta_id = $1`, [c.id]);
      const recetas = recetasRes.rows;
      
      for (const r of recetas) {
        const detallesRes = await db.query('SELECT descripcion, cantidad, posologia FROM recetas_detalle WHERE receta_id = $1', [r.id]);
        r.detalles = detallesRes.rows;
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
router.post('/', async (req, res) => {
  const { persona_id, nombre, especie, raza, color, sexo, fecha_nacimiento, peso_kg, microchip, observaciones } = req.body;
  if (!persona_id || !nombre || !especie) return res.status(400).json({ error: 'persona_id, nombre y especie son requeridos' });

  try {
    const result = await db.query(`INSERT INTO mascotas (persona_id, nombre, especie, raza, color, sexo, fecha_nacimiento, peso_kg, microchip, observaciones)
                          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [
      persona_id, nombre, especie, raza || null, color || null, sexo || 'DESCONOCIDO',
      fecha_nacimiento || null, peso_kg || null, microchip || null, observaciones || null
    ]);

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar mascota
router.put('/:id', async (req, res) => {
  const { nombre, especie, raza, color, sexo, fecha_nacimiento, peso_kg, microchip, observaciones } = req.body;
  try {
    await db.query(`UPDATE mascotas SET nombre=$1, especie=$2, raza=$3, color=$4, sexo=$5, fecha_nacimiento=$6, peso_kg=$7, microchip=$8, observaciones=$9 WHERE id=$10`, 
      [nombre, especie, raza || null, color || null, sexo || 'DESCONOCIDO', fecha_nacimiento || null, peso_kg || null, microchip || null, observaciones || null, req.params.id]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dar de baja mascota
router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE mascotas SET activa = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener mascotas de una persona
router.get('/persona/:persona_id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM mascotas WHERE persona_id = $1 AND activa = 1 ORDER BY nombre', [req.params.persona_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
