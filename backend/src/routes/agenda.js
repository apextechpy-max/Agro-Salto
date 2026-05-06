const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// ─── AGENDA ─────────────────────────────────────────────────

// Listar eventos (por rango de fechas o todos)
router.get('/', (req, res) => {
  const { desde, hasta, veterinario_id, tipo_evento } = req.query;
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
  if (desde) { sql += ' AND a.fecha_inicio>=?'; params.push(desde); }
  if (hasta) { sql += ' AND a.fecha_inicio<=?'; params.push(hasta + ' 23:59:59'); }
  if (veterinario_id) { sql += ' AND a.veterinario_id=?'; params.push(veterinario_id); }
  if (tipo_evento) { sql += ' AND a.tipo_evento=?'; params.push(tipo_evento); }
  sql += ' ORDER BY a.fecha_inicio';
  res.json(db.prepare(sql).all(...params));
});

// Obtener evento por ID
router.get('/:id', (req, res) => {
  const a = db.prepare(`SELECT a.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre, p.telefono as dueno_telefono, u.nombre_completo as veterinario_nombre
                        FROM agenda a LEFT JOIN mascotas m ON m.id=a.mascota_id LEFT JOIN personas p ON p.id=a.persona_id LEFT JOIN usuarios u ON u.id=a.veterinario_id WHERE a.id=?`).get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json(a);
});

// Crear evento de agenda
router.post('/', (req, res) => {
  const { mascota_id, persona_id, titulo, tipo_evento, fecha_inicio, fecha_fin, color, veterinario_id, notas } = req.body;
  if (!titulo || !fecha_inicio) return res.status(400).json({ error: 'titulo y fecha_inicio son requeridos' });

  // Color por tipo de evento si no se especifica
  const colores = {
    CONSULTA: '#4A90D9', CIRUGIA: '#E53935', VACUNA: '#43A047',
    BANO_ESTETICA: '#8E24AA', CONTROL: '#FB8C00', EMERGENCIA: '#D32F2F',
    RECORDATORIO: '#039BE5', OTRO: '#757575'
  };

  const r = db.prepare(`INSERT INTO agenda (mascota_id,persona_id,titulo,tipo_evento,fecha_inicio,fecha_fin,color,veterinario_id,notas)
                        VALUES (?,?,?,?,?,?,?,?,?)`).run(
    mascota_id||null, persona_id||null, titulo,
    tipo_evento||'CONSULTA', fecha_inicio, fecha_fin||null,
    color || colores[tipo_evento] || '#4A90D9',
    veterinario_id||null, notas||null
  );
  res.status(201).json({ id: r.lastInsertRowid });
});

// Actualizar evento
router.put('/:id', (req, res) => {
  const { titulo, tipo_evento, fecha_inicio, fecha_fin, color, veterinario_id, notas, estado } = req.body;
  db.prepare(`UPDATE agenda SET titulo=?,tipo_evento=?,fecha_inicio=?,fecha_fin=?,color=?,veterinario_id=?,notas=?,estado=? WHERE id=?`)
    .run(titulo, tipo_evento, fecha_inicio, fecha_fin||null, color||'#4A90D9', veterinario_id||null, notas||null, estado||'PROGRAMADO', req.params.id);
  res.json({ ok: true });
});

// Eliminar evento
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM agenda WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Cambiar estado
router.patch('/:id/estado', (req, res) => {
  const { estado } = req.body;
  db.prepare('UPDATE agenda SET estado=? WHERE id=?').run(estado, req.params.id);
  res.json({ ok: true });
});

// Generar link de WhatsApp para notificación
router.get('/:id/whatsapp', (req, res) => {
  const evento = db.prepare(`SELECT a.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre, p.telefono as dueno_telefono
                             FROM agenda a LEFT JOIN mascotas m ON m.id=a.mascota_id LEFT JOIN personas p ON p.id=a.persona_id WHERE a.id=?`).get(req.params.id);
  if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

  const telefono = (evento.dueno_telefono || '').replace(/\D/g, '');
  const fecha = new Date(evento.fecha_inicio).toLocaleString('es-PY', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });

  const mensaje = `Hola ${evento.dueno_nombre || 'estimado/a'} 👋\n\nLe recordamos que *${evento.mascota_nombre || 'su mascota'}* tiene un turno de *${evento.tipo_evento}* programado para el *${fecha}* en Agro Salto.\n\nPor favor confirme su asistencia. ¡Muchas gracias! 🐾`;

  const telPY = telefono.startsWith('595') ? telefono : `595${telefono.replace(/^0/, '')}`;
  const link = `https://wa.me/${telPY}?text=${encodeURIComponent(mensaje)}`;

  db.prepare('UPDATE agenda SET notificado_wa=1 WHERE id=?').run(req.params.id);
  res.json({ link, mensaje, telefono: telPY });
});

module.exports = router;
