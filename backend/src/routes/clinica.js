const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ─── CONSULTAS ──────────────────────────────────────────────

// Listar consultas (con filtros)
router.get('/consultas', (req, res) => {
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
      sql += ' AND c.mascota_id = ?';
      params.push(mascota_id);
    }
    if (estado) {
      const estados = estado.split(',');
      const placeholders = estados.map(() => '?').join(',');
      sql += ` AND c.estado IN (${placeholders})`;
      params.push(...estados);
    }
    if (desde) {
      sql += ' AND c.fecha >= ?';
      params.push(desde);
    }
    if (hasta) {
      sql += ' AND c.fecha <= ?';
      params.push(hasta + ' 23:59:59');
    }

    sql += ' ORDER BY c.fecha DESC LIMIT 100';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener consulta por ID (con estudios y recetas)
router.get('/consultas/:id', (req, res) => {
  try {
    const c = db.prepare(`SELECT c.*, m.nombre as mascota_nombre, m.especie, m.raza, p.id as dueno_id, p.razon_social as dueno_nombre, p.telefono as dueno_telefono, u.nombre_completo as veterinario_nombre
                          FROM consultas c
                          LEFT JOIN mascotas m ON m.id = c.mascota_id
                          LEFT JOIN personas p ON p.id = m.persona_id
                          LEFT JOIN usuarios u ON u.id = c.veterinario_id
                          WHERE c.id = ?`).get(req.params.id);

    if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

    // Recetas
    const recetas = db.prepare(`SELECT r.*, u.nombre_completo as vet_nombre
                                FROM recetas r
                                LEFT JOIN usuarios u ON u.id = r.veterinario_id
                                WHERE r.consulta_id = ?`).all(c.id);

    c.recetas = recetas.map(r => {
      const detalles = db.prepare(`SELECT rd.*, p.nombre as producto_nombre
                                   FROM recetas_detalle rd
                                   LEFT JOIN productos p ON p.id = rd.producto_id
                                   WHERE rd.receta_id = ?`).all(r.id);
      return { ...r, detalle: detalles };
    });

    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear consulta
router.post('/consultas', (req, res) => {
  const { mascota_id, tipo_consulta, motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones, veterinario_id } = req.body;
  if (!mascota_id) return res.status(400).json({ error: 'mascota_id requerido' });

  try {
    const r = db.prepare(`INSERT INTO consultas (mascota_id, veterinario_id, tipo_consulta, motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      mascota_id,
      veterinario_id || req.user.id,
      tipo_consulta || 'CONSULTA',
      motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones
    );

    if (peso_kg) {
      db.prepare('UPDATE mascotas SET peso_kg = ? WHERE id = ?').run(peso_kg, mascota_id);
    }

    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar consulta (Evolución Clínica)
router.put('/consultas/:id', (req, res) => {
  const { diagnostico, tratamiento, peso_kg, temperatura, observaciones, estado, justificacion } = req.body;
  try {
    // 1. Registrar progreso si hay cambios
    if (justificacion) {
      db.prepare(`INSERT INTO consultas_progreso (consulta_id, diagnostico, tratamiento, peso_kg, temperatura, justificacion, usuario_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        req.params.id,
        diagnostico, tratamiento, peso_kg, temperatura, justificacion,
        req.user.id
      );
    }

    // 2. Actualizar principal
    db.prepare(`UPDATE consultas SET diagnostico=?, tratamiento=?, peso_kg=?, temperatura=?, observaciones=?, estado=? WHERE id=?`)
      .run(diagnostico, tratamiento, peso_kg, temperatura, observaciones, estado, req.params.id);

    if (peso_kg) {
      const c = db.prepare('SELECT mascota_id FROM consultas WHERE id = ?').get(req.params.id);
      if (c) db.prepare('UPDATE mascotas SET peso_kg = ? WHERE id = ?').run(peso_kg, c.mascota_id);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener progreso
router.get('/consultas/:id/progreso', (req, res) => {
  try {
    const rows = db.prepare(`SELECT cp.*, u.nombre_completo as usuario_nombre
                             FROM consultas_progreso cp
                             LEFT JOIN usuarios u ON u.id = cp.usuario_id
                             WHERE cp.consulta_id = ?
                             ORDER BY cp.fecha DESC`).all(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enviar consulta a Pre-Venta
router.post('/consultas/:id/pre-venta', (req, res) => {
  const { items, cliente_id, filial_id } = req.body;
  try {
    const total = items.reduce((acc, it) => acc + (it.precio * it.cantidad), 0);
    
    // Crear la venta en estado PRE-VENTA
    const r = db.prepare(`INSERT INTO ventas (tipo, cliente_id, filial_id, total, estado, usuario_id, observacion)
                          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      'MINORISTA',
      cliente_id,
      filial_id || 1,
      total,
      'PRE-VENTA',
      req.user.id,
      `Consulta Vet #${req.params.id}`
    );

    const venta_id = r.lastInsertRowid;

    // Detalles
    const insertDetalle = db.prepare(`INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unit, subtotal)
                                      VALUES (?, ?, ?, ?, ?)`);
    
    for (const it of items) {
      insertDetalle.run(venta_id, it.producto_id, it.cantidad, it.precio, it.precio * it.cantidad);
    }

    db.prepare('UPDATE consultas SET pre_venta_id = ?, estado = ? WHERE id = ?').run(venta_id, 'FINALIZADA', req.params.id);

    res.json({ ok: true, venta_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RECETAS ────────────────────────────────────────────────

router.post('/consultas/:id/receta', (req, res) => {
  try {
    const { indicaciones, items } = req.body;
    
    // Obtener datos de la mascota y dueño para el impreso
    const c = db.prepare(`SELECT c.mascota_id, m.nombre as mascota, p.razon_social as dueno 
                          FROM consultas c 
                          JOIN mascotas m ON m.id = c.mascota_id 
                          JOIN personas p ON p.id = m.persona_id 
                          WHERE c.id = ?`).get(req.params.id);

    if (!c) return res.status(404).json({ error: 'Consulta no encontrada' });

    const r = db.prepare(`INSERT INTO recetas (consulta_id, mascota_id, veterinario_id, indicaciones)
                          VALUES (?, ?, ?, ?)`).run(
      req.params.id,
      c.mascota_id,
      req.user.id,
      indicaciones
    );

    const receta_id = r.lastInsertRowid;

    if (items && items.length) {
      const insertDetalle = db.prepare(`INSERT INTO recetas_detalle (receta_id, producto_id, descripcion, cantidad, posologia)
                                        VALUES (?, ?, ?, ?, ?)`);
      for (const it of items) {
        insertDetalle.run(receta_id, it.producto_id || null, it.descripcion, it.cantidad, it.posologia);
      }
    }

    // Retornar objeto completo para el frontend
    res.status(201).json({ 
      id: receta_id, 
      fecha: new Date().toISOString(),
      mascota: c.mascota,
      dueno: c.dueno,
      indicaciones,
      items: items || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INTERNACIONES ──────────────────────────────────────────

// Listar internaciones activas
router.get('/internaciones', (req, res) => {
  try {
    const rows = db.prepare(`SELECT i.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre
                             FROM internacion i
                             JOIN mascotas m ON m.id = i.mascota_id
                             JOIN personas p ON p.id = m.persona_id
                             WHERE i.estado = 'ACTIVA'
                             ORDER BY i.fecha_ingreso DESC`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener internación por ID
router.get('/internaciones/:id', (req, res) => {
  try {
    const i = db.prepare(`SELECT i.*, m.nombre as mascota_nombre, m.especie, m.raza, p.razon_social as dueno_nombre, p.telefono as dueno_telefono
                          FROM internacion i
                          JOIN mascotas m ON m.id = i.mascota_id
                          JOIN personas p ON p.id = m.persona_id
                          WHERE i.id = ?`).get(req.params.id);

    if (!i) return res.status(404).json({ error: 'Internación no encontrada' });

    // Historial de constantes
    i.constantes_historial = db.prepare(`SELECT cv.*, u.nombre_completo as usuario_nombre
                                         FROM constantes_vitales cv
                                         LEFT JOIN usuarios u ON u.id = cv.usuario_id
                                         WHERE cv.internacion_id = ?
                                         ORDER BY cv.fecha DESC`).all(i.id);

    res.json(i);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear internación
router.post('/internaciones', (req, res) => {
  const { consulta_id, mascota_id, observaciones } = req.body;
  if (!mascota_id) return res.status(400).json({ error: 'mascota_id requerido' });

  try {
    const r = db.prepare(`INSERT INTO internacion (consulta_id, mascota_id, observaciones, estado)
                          VALUES (?, ?, ?, 'ACTIVA')`).run(
      consulta_id || null,
      mascota_id,
      observaciones || ''
    );

    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dar de alta internación
router.patch('/internaciones/:id/alta', (req, res) => {
  const { observaciones_finales } = req.body;
  try {
    db.prepare(`UPDATE internacion SET estado = 'FINALIZADA', fecha_egreso = datetime('now'), observaciones = ? WHERE id = ?`)
      .run(observaciones_finales || '', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar constantes vitales
router.post('/internaciones/:id/constante', (req, res) => {
  const { temperatura, frecuencia_card, frecuencia_resp, peso_kg, observacion } = req.body;
  try {
    db.prepare(`INSERT INTO constantes_vitales (internacion_id, temperatura, frecuencia_card, frecuencia_resp, peso_kg, observacion, usuario_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      req.params.id,
      temperatura, frecuencia_card, frecuencia_resp, peso_kg, observacion,
      req.user.id
    );

    // Actualizar última constante en la tabla internacion (opcional pero útil)
    const ultima = `Temp: ${temperatura || '-'}°C, FC: ${frecuencia_card || '-'}bpm, FR: ${frecuencia_resp || '-'}rpm`;
    db.prepare('UPDATE internacion SET constantes = ? WHERE id = ?').run(ultima, req.params.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener historial de constantes
router.get('/internaciones/:id/constantes', (req, res) => {
  try {
    const rows = db.prepare(`SELECT cv.*, u.nombre_completo as usuario_nombre
                             FROM constantes_vitales cv
                             LEFT JOIN usuarios u ON u.id = cv.usuario_id
                             WHERE cv.internacion_id = ?
                             ORDER BY cv.fecha DESC`).all(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
