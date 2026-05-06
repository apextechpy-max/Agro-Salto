const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// Stock general con alertas
router.get('/', async (req, res) => {
  const { filial_id } = req.query;
  try {
    let q = `SELECT p.id, p.codigo, p.nombre, p.unidad_medida, p.stock_minimo, p.precio_costo,
      p.precio_venta_menor, p.precio_venta_mayor, p.iva_tipo, c.nombre as categoria_nombre,
      s.filial_id, f.nombre as filial_nombre, s.cantidad,
      CASE WHEN s.cantidad=0 THEN 'SIN_STOCK' WHEN s.cantidad<=p.stock_minimo THEN 'CRITICO' ELSE 'NORMAL' END as estado_stock,
      (SELECT MIN(fecha_vto) FROM lotes l WHERE l.producto_id = p.id AND l.filial_id = s.filial_id AND l.estado = 'ACTIVO' AND l.cantidad_act > 0) as proximo_vencimiento
      FROM stock s JOIN productos p ON p.id=s.producto_id LEFT JOIN categorias c ON c.id=p.categoria_id
      JOIN filiales f ON f.id=s.filial_id WHERE p.activo=1`;
    const params = [];
    if (filial_id) { 
      q += ' AND s.filial_id=$1'; 
      params.push(filial_id); 
    }
    q += ' ORDER BY p.nombre';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lotes próximos a vencer / vencidos (Adaptado para Postgres)
router.get('/alertas-vencimiento', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*, p.nombre as producto_nombre, p.codigo, f.nombre as filial_nombre,
        (l.fecha_vto - CURRENT_DATE) as dias_restantes
      FROM lotes l JOIN productos p ON p.id=l.producto_id JOIN filiales f ON f.id=l.filial_id
      WHERE l.estado='ACTIVO' AND l.cantidad_act>0 AND l.fecha_vto IS NOT NULL
        AND (l.fecha_vto - CURRENT_DATE) <= 30
      ORDER BY l.fecha_vto
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Movimientos
router.get('/movimientos', async (req, res) => {
  const { filial_id, producto_id, desde, hasta } = req.query;
  try {
    let q = `SELECT ms.*, p.nombre as producto_nombre, p.codigo, u.nombre_completo as usuario_nombre,
      fo.nombre as filial_origen_nombre, fd.nombre as filial_destino_nombre
      FROM movimientos_stock ms JOIN productos p ON p.id=ms.producto_id JOIN usuarios u ON u.id=ms.usuario_id
      LEFT JOIN filiales fo ON fo.id=ms.filial_origen LEFT JOIN filiales fd ON fd.id=ms.filial_destino WHERE 1=1`;
    const params = [];
    if (filial_id) { 
      q += ` AND (ms.filial_origen=$${params.length + 1} OR ms.filial_destino=$${params.length + 2})`; 
      params.push(filial_id, filial_id); 
    }
    if (producto_id) { 
      q += ` AND ms.producto_id=$${params.length + 1}`; 
      params.push(producto_id); 
    }
    if (desde) { 
      q += ` AND ms.fecha>=$${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      q += ` AND ms.fecha<=$${params.length + 1}`; 
      params.push(hasta + ' 23:59:59'); 
    }
    q += ' ORDER BY ms.fecha DESC LIMIT 200';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transferencia entre filiales
router.post('/transferencia', async (req, res) => {
  const { producto_id, filial_origen, filial_destino, cantidad, observacion } = req.body;
  if (filial_origen === filial_destino) return res.status(400).json({ error: 'Filiales deben ser diferentes' });
  
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const stockOrigRes = await client.query('SELECT cantidad FROM stock WHERE producto_id=$1 AND filial_id=$2', [producto_id, filial_origen]);
    const stockOrig = stockOrigRes.rows[0];
    
    if (!stockOrig || stockOrig.cantidad < cantidad) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    await client.query('UPDATE stock SET cantidad = cantidad - $1 WHERE producto_id=$2 AND filial_id=$3', [cantidad, producto_id, filial_origen]);
    await client.query('INSERT INTO stock (producto_id, filial_id, cantidad) VALUES ($1,$2,0) ON CONFLICT DO NOTHING', [producto_id, filial_destino]);
    await client.query('UPDATE stock SET cantidad = cantidad + $1 WHERE producto_id=$2 AND filial_id=$3', [cantidad, producto_id, filial_destino]);
    await client.query('INSERT INTO movimientos_stock (tipo, producto_id, filial_origen, filial_destino, cantidad, observacion, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', 
      ['TRANSFERENCIA', producto_id, filial_origen, filial_destino, cantidad, observacion || '', req.user.id]);
    
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Baja/Daño
router.post('/baja', async (req, res) => {
  const { producto_id, filial_id, cantidad, motivo, lote_id } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE stock SET cantidad = GREATEST(0, cantidad - $1) WHERE producto_id=$2 AND filial_id=$3', [cantidad, producto_id, filial_id]);
    
    if (lote_id) {
      await client.query(`UPDATE lotes SET 
        cantidad_act = GREATEST(0, cantidad_act - $1),
        estado = CASE WHEN cantidad_act - $1 <= 0 THEN $2 ELSE estado END 
        WHERE id = $3`, [cantidad, motivo === 'VENCIDO' ? 'VENCIDO' : 'BAJA', lote_id]);
    }
    
    await client.query('INSERT INTO movimientos_stock (tipo, producto_id, lote_id, filial_origen, cantidad, observacion, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', 
      ['BAJA', producto_id, lote_id || null, filial_id, cantidad, motivo || 'BAJA', req.user.id]);
    
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
