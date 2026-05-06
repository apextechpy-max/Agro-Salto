const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/ventas', async (req, res) => {
  const { desde, hasta, filial_id } = req.query;
  try {
    let q = `SELECT v.id, v.fecha, v.tipo, v.total, v.tipo_pago, v.estado, c.razon_social as cliente, u.nombre_completo as usuario, f.nombre as filial
      FROM ventas v LEFT JOIN personas c ON c.id=v.cliente_id JOIN usuarios u ON u.id=v.usuario_id JOIN filiales f ON f.id=v.filial_id WHERE 1=1`;
    const params = [];
    if (desde) { 
      q += ` AND v.fecha::date >= $${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      q += ` AND v.fecha::date <= $${params.length + 1}`; 
      params.push(hasta); 
    }
    if (filial_id) { 
      q += ` AND v.filial_id = $${params.length + 1}`; 
      params.push(filial_id); 
    }
    q += ' ORDER BY v.fecha DESC';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stock-critico', async (req, res) => {
  try {
    const result = await db.query(`SELECT p.codigo, p.nombre, p.stock_minimo, s.cantidad as stock_actual, f.nombre as filial FROM stock s JOIN productos p ON p.id=s.producto_id JOIN filiales f ON f.id=s.filial_id WHERE s.cantidad<=p.stock_minimo AND p.activo=1 ORDER BY s.cantidad`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/deudores', async (req, res) => {
  try {
    const result = await db.query(`SELECT p.id, p.razon_social, p.telefono, p.ruc, SUM(CASE WHEN cc.tipo='COBRAR' THEN cc.saldo ELSE 0 END) as total_a_cobrar, COUNT(CASE WHEN cc.tipo='COBRAR' AND cc.estado!='PAGADO' THEN 1 END) as cant_cuentas FROM cuentas_corrientes cc JOIN personas p ON p.id=cc.persona_id WHERE cc.tipo='COBRAR' AND cc.estado!='PAGADO' GROUP BY p.id, p.razon_social, p.telefono, p.ruc ORDER BY total_a_cobrar DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cierres-caja', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let q = `SELECT a.*, u.nombre_completo as usuario, c.nombre as caja, f.nombre as filial FROM aperturas_caja a JOIN usuarios u ON u.id=a.usuario_id JOIN cajas c ON c.id=a.caja_id JOIN filiales f ON f.id=a.filial_id WHERE a.estado='CERRADA'`;
    const params = [];
    if (desde) { 
      q += ` AND a.fecha_apertura::date >= $${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      q += ` AND a.fecha_apertura::date <= $${params.length + 1}`; 
      params.push(hasta); 
    }
    q += ' ORDER BY a.fecha_apertura DESC';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/libro-ventas', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let q = `SELECT v.id, v.fecha, c.razon_social, c.ruc, c.condicion_iva, v.subtotal, v.iva_5, v.iva_10, v.descuento, v.total FROM ventas v LEFT JOIN personas c ON c.id=v.cliente_id WHERE v.estado='COMPLETADA'`;
    const params = [];
    if (desde) { 
      q += ` AND v.fecha::date >= $${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      q += ` AND v.fecha::date <= $${params.length + 1}`; 
      params.push(hasta); 
    }
    q += ' ORDER BY v.fecha';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/libro-compras', async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    let q = `SELECT c.id, c.fecha, p.razon_social as proveedor, p.ruc, c.numero_factura, c.subtotal, c.iva_5, c.iva_10, c.total FROM compras c LEFT JOIN personas p ON p.id=c.proveedor_id WHERE c.estado!='ANULADA'`;
    const params = [];
    if (desde) { 
      q += ` AND c.fecha::date >= $${params.length + 1}`; 
      params.push(desde); 
    }
    if (hasta) { 
      q += ` AND c.fecha::date <= $${params.length + 1}`; 
      params.push(hasta); 
    }
    q += ' ORDER BY c.fecha';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
