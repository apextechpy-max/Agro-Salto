const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// Cajas disponibles
router.get('/cajas', async (req, res) => {
  const { filial_id } = req.query;
  try {
    let q = 'SELECT c.*, f.nombre as filial_nombre FROM cajas c JOIN filiales f ON f.id=c.filial_id WHERE c.activa=1';
    const params = [];
    if (filial_id) { 
      q += ' AND c.filial_id=$1'; 
      params.push(filial_id); 
    }
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apertura activa
router.get('/apertura-activa', async (req, res) => {
  const { caja_id } = req.query;
  try {
    const result = await db.query("SELECT a.*, u.nombre_completo as usuario_nombre, c.nombre as caja_nombre FROM aperturas_caja a JOIN usuarios u ON u.id=a.usuario_id JOIN cajas c ON c.id=a.caja_id WHERE a.caja_id=$1 AND a.estado='ABIERTA' ORDER BY a.id DESC LIMIT 1", [caja_id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Abrir caja
router.post('/abrir', async (req, res) => {
  const { caja_id, monto_inicial, cambio_usd, cambio_brl, cambio_ars } = req.body;
  const client = await db.pool.connect();
  try {
    const cajaRes = await client.query('SELECT * FROM cajas WHERE id=$1', [caja_id]);
    const caja = cajaRes.rows[0];
    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });
    
    const abiertaRes = await client.query("SELECT id FROM aperturas_caja WHERE caja_id=$1 AND estado='ABIERTA'", [caja_id]);
    if (abiertaRes.rows.length > 0) return res.status(400).json({ error: 'La caja ya está abierta' });

    await client.query('BEGIN');
    const r = await client.query('INSERT INTO aperturas_caja (caja_id,usuario_id,filial_id,monto_inicial,cambio_usd,cambio_brl,cambio_ars) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', 
      [caja_id, req.user.id, caja.filial_id, monto_inicial || 0, cambio_usd || 0, cambio_brl || 0, cambio_ars || 0]);
    const aperturaId = r.rows[0].id;
    
    await client.query("INSERT INTO movimientos_caja (apertura_id,tipo,concepto,ref_tipo,monto,usuario_id) VALUES ($1,$2,$3,$4,$5,$6)", 
      [aperturaId, 'INGRESO', 'Fondo inicial', 'APERTURA', monto_inicial || 0, req.user.id]);
    
    await client.query('COMMIT');
    res.json({ id: aperturaId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// Movimientos de una apertura
router.get('/:apertura_id/movimientos', async (req, res) => {
  try {
    const result = await db.query('SELECT m.*, u.nombre_completo as usuario_nombre FROM movimientos_caja m JOIN usuarios u ON u.id=m.usuario_id WHERE m.apertura_id=$1 ORDER BY m.fecha', [req.params.apertura_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agregar movimiento manual
router.post('/:apertura_id/movimiento', async (req, res) => {
  const { tipo, concepto, monto } = req.body;
  if (!tipo || !monto) return res.status(400).json({ error: 'Faltan datos' });
  try {
    await db.query("INSERT INTO movimientos_caja (apertura_id,tipo,concepto,ref_tipo,monto,usuario_id) VALUES ($1,$2,$3,$4,$5,$6)", 
      [req.params.apertura_id, tipo, concepto, 'MANUAL', monto, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cerrar caja
router.post('/cerrar', async (req, res) => {
  const { apertura_id, monto_declarado } = req.body;
  const client = await db.pool.connect();
  try {
    const apRes = await client.query("SELECT * FROM aperturas_caja WHERE id=$1 AND estado='ABIERTA'", [apertura_id]);
    const apertura = apRes.rows[0];
    if (!apertura) return res.status(400).json({ error: 'Apertura no válida' });

    const movsRes = await client.query("SELECT tipo, monto FROM movimientos_caja WHERE apertura_id=$1", [apertura_id]);
    let monto_sistema = 0;
    for (const m of movsRes.rows) monto_sistema += m.tipo === 'INGRESO' ? parseFloat(m.monto) : -parseFloat(m.monto);

    const diferencia = (monto_declarado || 0) - monto_sistema;
    
    await client.query("UPDATE aperturas_caja SET estado='CERRADA', fecha_cierre=CURRENT_TIMESTAMP, monto_declarado=$1, monto_sistema=$2, diferencia=$3 WHERE id=$4", 
      [monto_declarado || 0, monto_sistema, diferencia, apertura_id]);
    
    res.json({ monto_sistema, diferencia });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Historial de aperturas
router.get('/historial', async (req, res) => {
  const { filial_id, desde, hasta } = req.query;
  try {
    let q = `SELECT a.*, u.nombre_completo as usuario_nombre, c.nombre as caja_nombre, f.nombre as filial_nombre
      FROM aperturas_caja a JOIN usuarios u ON u.id=a.usuario_id JOIN cajas c ON c.id=a.caja_id JOIN filiales f ON f.id=a.filial_id WHERE 1=1`;
    const params = [];
    if (filial_id) { 
      q += ` AND a.filial_id = $${params.length + 1}`; 
      params.push(filial_id); 
    }
    if (desde) { 
      q += ` AND a.fecha_apertura >= $${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      q += ` AND a.fecha_apertura <= $${params.length + 1}`; 
      params.push(hasta + ' 23:59:59'); 
    }
    q += ' ORDER BY a.fecha_apertura DESC LIMIT 100';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
