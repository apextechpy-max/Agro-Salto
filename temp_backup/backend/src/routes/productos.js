const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

// Función para autogenerar código de producto (local SQLite)
function generarCodigoProducto(tipo_inventario) {
  const prefijos = { 'CLINICA': 'CLI', 'PETSHOP': 'PET', 'AMBOS': 'MIX' };
  const prefix = prefijos[tipo_inventario] || 'PRD';
  
  const ultimo = db.prepare(`SELECT codigo FROM productos WHERE codigo LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}-%`);

  let siguiente = 1;
  if (ultimo) {
    const parts = ultimo.codigo.split('-');
    if (parts.length > 1) {
      const num = parseInt(parts[1]);
      if (!isNaN(num)) siguiente = num + 1;
    }
  }
  return `${prefix}-${String(siguiente).padStart(4, '0')}`;
}

router.get('/', (req, res) => {
  const { buscar, categoria_id, activo = true } = req.query;
  try {
    let sql = `SELECT p.*, c.nombre as categoria_nombre, (SELECT COALESCE(SUM(cantidad), 0) FROM stock WHERE producto_id = p.id) as stock_total
               FROM productos p
               LEFT JOIN categorias c ON c.id = p.categoria_id
               WHERE p.activo = ?`;
    const isActive = (activo === '1' || activo === 'true' || activo === true) ? 1 : 0;
    const params = [isActive];

    if (buscar) {
      sql += ' AND (p.nombre LIKE ? OR p.codigo LIKE ?)';
      params.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (categoria_id) {
      sql += ' AND p.categoria_id = ?';
      params.push(categoria_id);
    }

    sql += ' ORDER BY p.nombre';

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const p = db.prepare(`SELECT p.*, c.nombre as categoria_nombre
                          FROM productos p
                          LEFT JOIN categorias c ON c.id = p.categoria_id
                          WHERE p.id = ?`).get(req.params.id);

    if (!p) return res.status(404).json({ error: 'No encontrado' });
    
    // Obtener stock por filial
    p.stock = db.prepare(`SELECT s.*, f.nombre as filial_nombre 
                          FROM stock s 
                          JOIN filiales f ON f.id = s.filial_id 
                          WHERE s.producto_id = ?`).all(p.id);
    
    // Obtener lotes activos
    p.lotes = db.prepare(`SELECT * FROM lotes WHERE producto_id = ? AND estado = 'ACTIVO' AND cantidad_act > 0`).all(p.id);
    
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, tipo_inventario } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

  try {
    const tipo = tipo_inventario || 'AMBOS';
    const codigo = generarCodigoProducto(tipo);
    
    const r = db.prepare(`INSERT INTO productos (codigo, nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, tipo_inventario)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      codigo, nombre, descripcion || '', categoria_id || null, unidad_medida || 'UNIDAD',
      precio_costo || 0, precio_venta_menor || 0, precio_venta_mayor || 0,
      iva_tipo || '10', stock_minimo || 0, requiere_receta ? 1 : 0, tipo
    );

    res.json({ id: r.lastInsertRowid, codigo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, activo } = req.body;
  try {
    db.prepare(`UPDATE productos SET nombre=?, descripcion=?, categoria_id=?, unidad_medida=?, precio_costo=?, precio_venta_menor=?, precio_venta_mayor=?, iva_tipo=?, stock_minimo=?, requiere_receta=?, activo=? WHERE id=?`)
      .run(
        nombre, descripcion || '', categoria_id || null, unidad_medida || 'UNIDAD',
        precio_costo || 0, precio_venta_menor || 0, precio_venta_mayor || 0,
        iva_tipo || '10', stock_minimo || 0, requiere_receta ? 1 : 0, 
        activo !== undefined ? (activo ? 1 : 0) : 1,
        req.params.id
      );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
