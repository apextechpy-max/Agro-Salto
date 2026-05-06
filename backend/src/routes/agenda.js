const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ─── AGENDA ─────────────────────────────────────────────────

// Listar eventos
router.get('/', async (req, res) => {
  const { desde, hasta, veterinario_id, tipo_evento } = req.query;
  try {
    let sql = `SELECT a.*,
               m.nombre as mascota_nombre, m.especie,
               p.razon_social as dueno_nombre, p.telefono as dueno_telefono,
               u.nombre_completo as veterinario_nombre
               FROM agenda a
               LEFT JOIN mascotas m ON m.id=a.mascota_id
               LEFT JOIN personas p ON p.id=a.persona_id
               LEFT JOIN usuarios u ON u.id=a.veterinario_id
               WHERE 1=1`;
    const params = [];
    if (desde) { 
      sql += ` AND a.fecha_inicio >= $${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      sql += ` AND a.fecha_inicio <= $${params.length + 1}`; 
      params.push(hasta + ' 23:59:59'); 
    }
    if (veterinario_id) { 
      sql += ` AND a.veterinario_id = $${params.length + 1}`; 
      params.push(veterinario_id); 
    }
    if (tipo_evento) { 
      sql += ` AND a.tipo_evento = $${params.length + 1}`; 
      params.push(tipo_evento); 
    }
    sql += ' ORDER BY a.fecha_inicio';
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener evento por ID
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT a.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre, p.telefono as dueno_telefono, u.nombre_completo as veterinario_nombre
                          FROM agenda a LEFT JOIN mascotas m ON m.id=a.mascota_id LEFT JOIN personas p ON p.id=a.persona_id LEFT JOIN usuarios u ON u.id=a.veterinario_id WHERE a.id=$1`, [req.params.id]);
    const a = result.rows[0];
    if (!a) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(a);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear evento
router.post('/', async (req, res) => {
  const { mascota_id, persona_id, titulo, tipo_evento, fecha_inicio, fecha_fin, color, veterinario_id, notas } = req.body;
  if (!titulo || !fecha_inicio) return res.status(400).json({ error: 'titulo y fecha_inicio son requeridos' });

  const colores = {
    CONSULTA: '#4A90D9', CIRUGIA: '#E53935', VACUNA: '#43A047',
    BANO_ESTETICA: '#8E24AA', CONTROL: '#FB8C00', EMERGENCIA: '#D32F2F',
    RECORDATORIO: '#039BE5', OTRO: '#757575'
  };

  try {
    const result = await db.query(`INSERT INTO agenda (mascota_id,persona_id,titulo,tipo_evento,fecha_inicio,fecha_fin,color,veterinario_id,notas)
                          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [
      mascota_id||null, persona_id||null, titulo,
      tipo_evento||'CONSULTA', fecha_inicio, fecha_fin||null,
      color || colores[tipo_evento] || '#4A90D9',
      veterinario_id||null, notas||null
    ]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar evento
router.put('/:id', async (req, res) => {
  const { titulo, tipo_evento, fecha_inicio, fecha_fin, color, veterinario_id, notas, estado } = req.body;
  try {
    await db.query(`UPDATE agenda SET titulo=$1,tipo_evento=$2,fecha_inicio=$3,fecha_fin=$4,color=$5,veterinario_id=$6,notas=$7,estado=$8 WHERE id=$9`,
      [titulo, tipo_evento, fecha_inicio, fecha_fin||null, color||'#4A90D9', veterinario_id||null, notas||null, estado||'PROGRAMADO', req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar evento
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM agenda WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cambiar estado
router.patch('/:id/estado', async (req, res) => {
  const { estado } = req.body;
  try {
    await db.query('UPDATE agenda SET estado=$1 WHERE id=$2', [estado, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notificación WhatsApp
router.get('/:id/whatsapp', async (req, res) => {
  try {
    const result = await db.query(`SELECT a.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre, p.telefono as dueno_telefono
                               FROM agenda a LEFT JOIN mascotas m ON m.id=a.mascota_id LEFT JOIN personas p ON p.id=a.persona_id WHERE a.id=$1`, [req.params.id]);
    const evento = result.rows[0];
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

    const telefono = (evento.dueno_telefono || '').replace(/\D/g, '');
    const fecha = new Date(evento.fecha_inicio).toLocaleString('es-PY', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });

    const mensaje = `Hola ${evento.dueno_nombre || 'estimado/a'} 👋\n\nLe recordamos que *${evento.mascota_nombre || 'su mascota'}* tiene un turno de *${evento.tipo_evento}* programado para el *${fecha}* en Agro Salto.\n\nPor favor confirme su asistencia. ¡Muchas gracias! 🐾`;

    const telPY = telefono.startsWith('595') ? telefono : `595${telefono.replace(/^0/, '')}`;
    const link = `https://wa.me/${telPY}?text=${encodeURIComponent(mensaje)}`;

    await db.query('UPDATE agenda SET notificado_wa=1 WHERE id=$1', [req.params.id]);
    res.json({ link, mensaje, telefono: telPY });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
