const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ─── CONSULTAS ──────────────────────────────────────────────

// Listar consultas (con filtros)
router.get('/consultas', async (req, res) => {
  const { mascota_id, estado, desde, hasta } = req.query;
  try {
    let sql = `SELECT c.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre, u.nombre_completo as veterinario_nombre
               FROM consultas c
               LEFT JOIN mascotas m ON m.id = c.mascota_id
               LEFT JOIN personas p ON p.id = m.persona_id
               LEFT JOIN usuarios u ON u.id = c.veterinario_id
               WHERE 1=1`;
    const params = [];

    if (mascota_id) {
      sql += ` AND c.mascota_id = $${params.length + 1}`;
      params.push(mascota_id);
    }
    if (estado) {
      const estados = estado.split(',');
      const placeholders = estados.map((_, i) => `$${params.length + i + 1}`).join(',');
      sql += ` AND c.estado IN (${placeholders})`;
      params.push(...estados);
    }
    if (desde) {
      sql += ` AND c.fecha >= $${params.length + 1}`;
      params.push(desde);
    }
    if (hasta) {
      sql += ` AND c.fecha <= $${params.length + 1}`;
      params.push(hasta + ' 23:59:59');
    }

    sql += ' ORDER BY c.fecha DESC LIMIT 100';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener consulta por ID
router.get('/consultas/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT c.*, m.nombre as mascota_nombre, m.especie, m.raza, p.id as dueno_id, p.razon_social as dueno_nombre, p.telefono as dueno_telefono, u.nombre_completo as veterinario_nombre
                          FROM consultas c
                          LEFT JOIN mascotas m ON m.id = c.mascota_id
                          LEFT JOIN personas p ON p.id = m.persona_id
                          LEFT JOIN usuarios u ON u.id = c.veterinario_id
                          WHERE c.id = $1`, [req.params.id]);
    const c = result.rows[0];

    if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

    // Recetas
    const recetasRes = await db.query(`SELECT r.*, u.nombre_completo as vet_nombre
                                FROM recetas r
                                LEFT JOIN usuarios u ON u.id = r.veterinario_id
                                WHERE r.consulta_id = $1`, [c.id]);
    const recetas = recetasRes.rows;

    for (const r of recetas) {
      const detRes = await db.query(`SELECT rd.*, p.nombre as producto_nombre
                                   FROM recetas_detalle rd
                                   LEFT JOIN productos p ON p.id = rd.producto_id
                                   WHERE rd.receta_id = $1`, [r.id]);
      r.detalle = detRes.rows;
    }
    c.recetas = recetas;

    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear consulta
router.post('/consultas', async (req, res) => {
  const { mascota_id, tipo_consulta, motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones, veterinario_id } = req.body;
  if (!mascota_id) return res.status(400).json({ error: 'mascota_id requerido' });

  try {
    const result = await db.query(`INSERT INTO consultas (mascota_id, veterinario_id, tipo_consulta, motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones)
                          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [
      mascota_id,
      veterinario_id || req.user.id,
      tipo_consulta || 'CONSULTA',
      motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones
    ]);

    if (peso_kg) {
      await db.query('UPDATE mascotas SET peso_kg = $1 WHERE id = $2', [peso_kg, mascota_id]);
    }

    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar consulta
router.put('/consultas/:id', async (req, res) => {
  const { diagnostico, tratamiento, peso_kg, temperatura, observaciones, estado, justificacion } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (justificacion) {
      await client.query(`INSERT INTO consultas_progreso (consulta_id, diagnostico, tratamiento, peso_kg, temperatura, justificacion, usuario_id)
                  VALUES ($1,$2,$3,$4,$5,$6,$7)`, [req.params.id, diagnostico, tratamiento, peso_kg, temperatura, justificacion, req.user.id]);
    }

    await client.query(`UPDATE consultas SET diagnostico=$1, tratamiento=$2, peso_kg=$3, temperatura=$4, observaciones=$5, estado=$6 WHERE id=$7`,
      [diagnostico, tratamiento, peso_kg, temperatura, observaciones, estado, req.params.id]);

    if (peso_kg) {
      const cRes = await client.query('SELECT mascota_id FROM consultas WHERE id = $1', [req.params.id]);
      if (cRes.rows[0]) await client.query('UPDATE mascotas SET peso_kg = $1 WHERE id = $2', [peso_kg, cRes.rows[0].mascota_id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Obtener progreso
router.get('/consultas/:id/progreso', async (req, res) => {
  try {
    const result = await db.query(`SELECT cp.*, u.nombre_completo as usuario_nombre
                             FROM consultas_progreso cp
                             LEFT JOIN usuarios u ON u.id = cp.usuario_id
                             WHERE cp.consulta_id = $1
                             ORDER BY cp.fecha DESC`, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enviar consulta a Pre-Venta
router.post('/consultas/:id/pre-venta', async (req, res) => {
  const { items, cliente_id, filial_id } = req.body;
  const client = await db.pool.connect();
  try {
    const total = items.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
    await client.query('BEGIN');
    
    const vRes = await client.query(`INSERT INTO ventas (tipo, cliente_id, filial_id, total, estado, usuario_id, observacion)
                          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [
      'MINORISTA', cliente_id, filial_id || 1, total, 'PRE-VENTA', req.user.id, `Consulta Vet #${req.params.id}`
    ]);
    const venta_id = vRes.rows[0].id;

    for (const it of items) {
      await client.query(`INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unit, subtotal)
                                      VALUES ($1,$2,$3,$4,$5)`, [venta_id, it.producto_id, it.cantidad, it.precio, it.precio * it.cantidad]);
    }

    await client.query('UPDATE consultas SET pre_venta_id = $1, estado = $2 WHERE id = $3', [venta_id, 'FINALIZADA', req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true, venta_id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── RECETAS ────────────────────────────────────────────────

router.post('/consultas/:id/receta', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { indicaciones, items } = req.body;
    await client.query('BEGIN');
    
    const cRes = await client.query(`SELECT c.mascota_id, m.nombre as mascota, p.razon_social as dueno 
                          FROM consultas c 
                          JOIN mascotas m ON m.id = c.mascota_id 
                          JOIN personas p ON p.id = m.persona_id 
                          WHERE c.id = $1`, [req.params.id]);
    const c = cRes.rows[0];

    if (!c) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Consulta no encontrada' });
    }

    const rRes = await client.query(`INSERT INTO recetas (consulta_id, mascota_id, veterinario_id, indicaciones)
                          VALUES ($1,$2,$3,$4) RETURNING id`, [req.params.id, c.mascota_id, req.user.id, indicaciones]);
    const receta_id = rRes.rows[0].id;

    if (items && items.length) {
      for (const it of items) {
        await client.query(`INSERT INTO recetas_detalle (receta_id, producto_id, descripcion, cantidad, posologia)
                                        VALUES ($1,$2,$3,$4,$5)`, [receta_id, it.producto_id || null, it.descripcion, it.cantidad, it.posologia]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ id: receta_id, fecha: new Date().toISOString(), mascota: c.mascota, dueno: c.dueno, indicaciones, items: items || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── INTERNACIONES ──────────────────────────────────────────

router.get('/internaciones', async (req, res) => {
  try {
    const result = await db.query(`SELECT i.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre
                             FROM internacion i
                             JOIN mascotas m ON m.id = i.mascota_id
                             JOIN personas p ON p.id = m.persona_id
                             WHERE i.estado = 'ACTIVA'
                             ORDER BY i.fecha_ingreso DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/internaciones/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT i.*, m.nombre as mascota_nombre, m.especie, m.raza, p.razon_social as dueno_nombre, p.telefono as dueno_telefono
                          FROM internacion i
                          JOIN mascotas m ON m.id = i.mascota_id
                          JOIN personas p ON p.id = m.persona_id
                          WHERE i.id = $1`, [req.params.id]);
    const i = result.rows[0];

    if (!i) return res.status(404).json({ error: 'Internación no encontrada' });

    const constRes = await db.query(`SELECT cv.*, u.nombre_completo as usuario_nombre
                                         FROM constantes_vitales cv
                                         LEFT JOIN usuarios u ON u.id = cv.usuario_id
                                         WHERE cv.internacion_id = $1
                                         ORDER BY cv.fecha DESC`, [i.id]);
    i.constantes_historial = constRes.rows;
    res.json(i);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/internaciones', async (req, res) => {
  const { consulta_id, mascota_id, observaciones } = req.body;
  if (!mascota_id) return res.status(400).json({ error: 'mascota_id requerido' });
  try {
    const result = await db.query(`INSERT INTO internacion (consulta_id, mascota_id, observaciones, estado)
                          VALUES ($1,$2,$3, 'ACTIVA') RETURNING id`, [consulta_id || null, mascota_id, observaciones || '']);
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/internaciones/:id/alta', async (req, res) => {
  try {
    await db.query(`UPDATE internacion SET estado = 'FINALIZADA', fecha_egreso = CURRENT_TIMESTAMP, observaciones = $1 WHERE id = $2`, [req.body.observaciones_finales || '', req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/internaciones/:id/constante', async (req, res) => {
  const { temperatura, frecuencia_card, frecuencia_resp, peso_kg, observacion } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO constantes_vitales (internacion_id, temperatura, frecuencia_card, frecuencia_resp, peso_kg, observacion, usuario_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7)`, [req.params.id, temperatura, frecuencia_card, frecuencia_resp, peso_kg, observacion, req.user.id]);

    const ultima = `Temp: ${temperatura || '-'}°C, FC: ${frecuencia_card || '-'}bpm, FR: ${frecuencia_resp || '-'}rpm`;
    await client.query('UPDATE internacion SET constantes = $1 WHERE id = $2', [ultima, req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/internaciones/:id/constantes', async (req, res) => {
  try {
    const result = await db.query(`SELECT cv.*, u.nombre_completo as usuario_nombre
                             FROM constantes_vitales cv
                             LEFT JOIN usuarios u ON u.id = cv.usuario_id
                             WHERE cv.internacion_id = $1
                             ORDER BY cv.fecha DESC`, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
