const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const filial_id = req.query.filial_id;

  const ventasHoy = db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as cant FROM ventas WHERE estado='COMPLETADA' AND date(fecha)=? ${filial_id ? 'AND filial_id=?' : ''}`).get(...(filial_id ? [hoy, filial_id] : [hoy]));

  const ventasMes = db.prepare(`SELECT COALESCE(SUM(total),0) as total FROM ventas WHERE estado='COMPLETADA' AND strftime('%Y-%m',fecha)=strftime('%Y-%m','now') ${filial_id ? 'AND filial_id=?' : ''}`).get(...(filial_id ? [filial_id] : []));

  const stockCritico = db.prepare(`SELECT COUNT(*) as cant FROM stock s JOIN productos p ON p.id=s.producto_id WHERE s.cantidad<=p.stock_minimo AND p.activo=1 ${filial_id ? 'AND s.filial_id=?' : ''}`).get(...(filial_id ? [filial_id] : []));

  const alertasVto = db.prepare(`SELECT COUNT(*) as cant FROM lotes WHERE estado='ACTIVO' AND cantidad_act>0 AND fecha_vto IS NOT NULL AND julianday(fecha_vto)-julianday('now')<=30 ${filial_id ? 'AND filial_id=?' : ''}`).get(...(filial_id ? [filial_id] : []));

  const listaAlertasVto = db.prepare(`SELECT l.numero_lote, l.fecha_vto, p.nombre, CAST((julianday(l.fecha_vto)-julianday('now')) AS INTEGER) as dias FROM lotes l JOIN productos p ON p.id=l.producto_id WHERE l.estado='ACTIVO' AND l.cantidad_act>0 AND l.fecha_vto IS NOT NULL AND julianday(l.fecha_vto)-julianday('now')<=30 ${filial_id ? 'AND l.filial_id=?' : ''} ORDER BY l.fecha_vto ASC LIMIT 5`).all(...(filial_id ? [filial_id] : []));

  const deudoresTotal = db.prepare("SELECT COALESCE(SUM(saldo),0) as total FROM cuentas_corrientes WHERE tipo='COBRAR' AND estado!='PAGADO'").get();

  const top5Productos = db.prepare(`SELECT p.nombre, SUM(vd.cantidad) as total_vendido FROM ventas_detalle vd JOIN productos p ON p.id=vd.producto_id JOIN ventas v ON v.id=vd.venta_id WHERE v.estado='COMPLETADA' AND date(v.fecha)>=date('now','-30 days') GROUP BY p.id ORDER BY total_vendido DESC LIMIT 5`).all();

  const ventasUltimos7 = db.prepare(`SELECT date(fecha) as dia, SUM(total) as total FROM ventas WHERE estado='COMPLETADA' AND date(fecha)>=date('now','-6 days') GROUP BY dia ORDER BY dia`).all();

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
});

module.exports = router;
