const db = require('better-sqlite3')('./data/agrosalto.db');
try {
  console.log('Testing ventasHoy...');
  const filial_id = undefined; const hoy = '2026-04-23';
  db.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as cant FROM ventas WHERE estado='COMPLETADA' AND date(fecha)=? ${filial_id ? 'AND filial_id=?' : ''}`).get(...(filial_id ? [hoy, filial_id] : [hoy]));

  console.log('Testing alertasVto...');
  db.prepare(`SELECT COUNT(*) as cant FROM lotes WHERE estado='ACTIVO' AND cantidad_act>0 AND fecha_vto IS NOT NULL AND julianday(fecha_vto)-julianday('now')<=30 ${filial_id ? 'AND filial_id=?' : ''}`).get(...(filial_id ? [filial_id] : []));

  console.log('Testing listaAlertasVto...');
  db.prepare(`SELECT l.numero_lote, l.fecha_vto, p.nombre, CAST((julianday(l.fecha_vto)-julianday('now')) AS INTEGER) as dias FROM lotes l JOIN productos p ON p.id=l.producto_id WHERE l.estado='ACTIVO' AND l.cantidad_act>0 AND l.fecha_vto IS NOT NULL AND julianday(l.fecha_vto)-julianday('now')<=30 ${filial_id ? 'AND l.filial_id=?' : ''} ORDER BY l.fecha_vto ASC LIMIT 5`).all(...(filial_id ? [filial_id] : []));

  console.log('ALL OK');
} catch(e) {
  console.error(e);
}
