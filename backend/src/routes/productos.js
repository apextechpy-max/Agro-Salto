const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authMiddleware);

// Configuración de Multer para fotos de productos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/productos';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const mime = allowed.test(file.mimetype);
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (mime && ext) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpg, png, webp)'));
  }
});

// Función para autogenerar código de producto (PostgreSQL)
async function generarCodigoProducto(tipo_inventario) {
  const prefijos = { 'CLINICA': 'CLI', 'PETSHOP': 'PET', 'AMBOS': 'MIX' };
  const prefix = prefijos[tipo_inventario] || 'PRD';
  
  const result = await db.query('SELECT codigo FROM productos WHERE codigo LIKE $1 ORDER BY id DESC LIMIT 1', [`${prefix}-%`]);
  const ultimo = result.rows[0];

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

router.get('/', async (req, res) => {
  const { buscar, categoria_id, activo = true } = req.query;
  try {
    let sql = `SELECT p.*, c.nombre as categoria_nombre, (SELECT COALESCE(SUM(cantidad), 0) FROM stock WHERE producto_id = p.id) as stock_total
               FROM productos p
               LEFT JOIN categorias c ON c.id = p.categoria_id
               WHERE p.activo = $1`;
    const isActive = (activo === '1' || activo === 'true' || activo === true) ? 1 : 0;
    const params = [isActive];

    if (buscar) {
      sql += ` AND (p.nombre ILIKE $${params.length + 1} OR p.codigo ILIKE $${params.length + 2})`;
      params.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (categoria_id) {
      sql += ` AND p.categoria_id = $${params.length + 1}`;
      params.push(categoria_id);
    }

    sql += ' ORDER BY p.nombre';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT p.*, c.nombre as categoria_nombre
                          FROM productos p
                          LEFT JOIN categorias c ON c.id = p.categoria_id
                          WHERE p.id = $1`, [req.params.id]);
    const p = result.rows[0];

    if (!p) return res.status(404).json({ error: 'No encontrado' });
    
    // Obtener stock por filial
    const stockRes = await db.query(`SELECT s.*, f.nombre as filial_nombre 
                           FROM stock s 
                           JOIN filiales f ON f.id = s.filial_id 
                           WHERE s.producto_id = $1`, [p.id]);
    p.stock = stockRes.rows;
    
    // Obtener lotes activos
    const lotesRes = await db.query(`SELECT * FROM lotes WHERE producto_id = $1 AND estado = 'ACTIVO' AND cantidad_act > 0`, [p.id]);
    p.lotes = lotesRes.rows;
    
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('foto'), async (req, res) => {
  const { nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, tipo_inventario } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

  try {
    const tipo = tipo_inventario || 'AMBOS';
    const codigo = await generarCodigoProducto(tipo);
    const foto_url = req.file ? `/_/backend/uploads/productos/${req.file.filename}` : null;
    
    const result = await db.query(`INSERT INTO productos (codigo, nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, tipo_inventario, foto_url)
                          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`, [
      codigo, nombre, descripcion || '', categoria_id || null, unidad_medida || 'UNIDAD',
      precio_costo || 0, precio_venta_menor || 0, precio_venta_mayor || 0,
      iva_tipo || '10', stock_minimo || 0, requiere_receta ? 1 : 0, tipo, foto_url
    ]);

    res.json({ id: result.rows[0].id, codigo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', upload.single('foto'), async (req, res) => {
  const { nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, activo } = req.body;
  try {
    let foto_url = null;
    let sql = `UPDATE productos SET nombre=$1, descripcion=$2, categoria_id=$3, unidad_medida=$4, precio_costo=$5, precio_venta_menor=$6, precio_venta_mayor=$7, iva_tipo=$8, stock_minimo=$9, requiere_receta=$10, activo=$11`;
    const params = [
      nombre, descripcion || '', categoria_id || null, unidad_medida || 'UNIDAD',
      precio_costo || 0, precio_venta_menor || 0, precio_venta_mayor || 0,
      iva_tipo || '10', stock_minimo || 0, requiere_receta ? 1 : 0, 
      activo !== undefined ? (activo ? 1 : 0) : 1
    ];

    if (req.file) {
      foto_url = `/_/backend/uploads/productos/${req.file.filename}`;
      sql += `, foto_url=$${params.length + 1}`;
      params.push(foto_url);
    }

    sql += ` WHERE id=$${params.length + 1}`;
    params.push(req.params.id);

    await db.query(sql, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
