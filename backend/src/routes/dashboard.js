const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const filial_id = req.query.filial_id;

  try {
    // Ventas Hoy
    let sqlVentasHoy = `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as cant FROM ventas WHERE estado='COMPLETADA' AND fecha::date = $1`;
    const paramsHoy = [hoy];
    if (filial_id) {
      sqlVentasHoy += ' AND filial_id = $2';
      paramsHoy.push(filial_id);
    }
    const vHoyRes = await db.query(sqlVentasHoy, paramsHoy);
    const ventasHoy = vHoyRes.rows[0];

    // Ventas Mes (Postgres style)
    let sqlVentasMes = `SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE estado='COMPLETADA' AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)`;
    const paramsMes = [];
    if (filial_id) {
      sqlVentasMes += ' AND filial_id = $1';
      paramsMes.push(filial_id);
    }
    const vMesRes = await db.query(sqlVentasMes, paramsMes);
    const ventasMes = vMesRes.rows[0];

    // Stock Crítico
    let sqlStockCrit = `SELECT COUNT(*) as cant FROM stock s JOIN productos p ON p.id=s.producto_id WHERE s.cantidad <= p.stock_minimo AND p.activo=1`;
    const paramsStock = [];
    if (filial_id) {
      sqlStockCrit += ' AND s.filial_id = $1';
      paramsStock.push(filial_id);
    }
    const sCritRes = await db.query(sqlStockCrit, paramsStock);
    const stockCritico = sCritRes.rows[0];

    // Alertas Vencimiento
    let sqlAlertasVtoCount = `SELECT COUNT(*) as cant FROM lotes WHERE estado='ACTIVO' AND cantidad_act > 0 AND fecha_vto IS NOT NULL AND (fecha_vto - CURRENT_DATE) <= 30`;
    const paramsVto = [];
    if (filial_id) {
      sqlAlertasVtoCount += ' AND filial_id = $1';
      paramsVto.push(filial_id);
    }
    const vtoCountRes = await db.query(sqlAlertasVtoCount, paramsVto);
    const alertasVto = vtoCountRes.rows[0];

    // Lista Alertas Vto
    let sqlAlertasList = `SELECT l.numero_lote, l.fecha_vto, p.nombre, (l.fecha_vto - CURRENT_DATE) as dias 
      FROM lotes l JOIN productos p ON p.id=l.producto_id 
      WHERE l.estado='ACTIVO' AND l.cantidad_act > 0 AND l.fecha_vto IS NOT NULL AND (l.fecha_vto - CURRENT_DATE) <= 30`;
    const paramsList = [];
    if (filial_id) {
      sqlAlertasList += ' AND l.filial_id = $1';
      paramsList.push(filial_id);
    }
    sqlAlertasList += ' ORDER BY l.fecha_vto ASC LIMIT 5';
    const alertasListRes = await db.query(sqlAlertasList, paramsList);
    const listaAlertasVto = alertasListRes.rows;

    // Deudores
    const deudoresRes = await db.query("SELECT COALESCE(SUM(saldo),0) as total FROM cuentas_corrientes WHERE tipo='COBRAR' AND estado!='PAGADO'");
    const deudoresTotal = deudoresRes.rows[0];

    // Top 5 Productos (Last 30 days)
    const top5Res = await db.query(`SELECT p.nombre, SUM(vd.cantidad) as total_vendido 
      FROM ventas_detalle vd JOIN productos p ON p.id=vd.producto_id JOIN ventas v ON v.id=vd.venta_id 
      WHERE v.estado='COMPLETADA' AND v.fecha::date >= (CURRENT_DATE - INTERVAL '30 days') 
      GROUP BY p.id, p.nombre ORDER BY total_vendido DESC LIMIT 5`);
    const top5Productos = top5Res.rows;

    // Ventas últimos 7 días
    const v7Res = await db.query(`SELECT fecha::date as dia, SUM(total) as total 
      FROM ventas WHERE estado='COMPLETADA' AND fecha::date >= (CURRENT_DATE - INTERVAL '6 days') 
      GROUP BY dia ORDER BY dia`);
    const ventasUltimos7 = v7Res.rows;

    res.json({
      ventasHoy: ventasHoy.total,
      cantVentasHoy: ventasHoy.cant,
      ventasMes: ventasMes.total,
      stockCritico: stockCritico.cant,
      alertasVto: alertasVto.cant,
      listaAlertasVto,
      deudoresTotal: deudoresTotal.total,
      top5Productos,
      ventasUltimos7
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
