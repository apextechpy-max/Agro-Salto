const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

router.use(authMiddleware);

// Inicializar cliente de Supabase para Storage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Usar memoria en lugar de disco, ya que Vercel es read-only
const storage = multer.memoryStorage();

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

// Función auxiliar para subir a Supabase Storage
async function uploadToSupabase(file) {
  if (!supabase) throw new Error('Supabase no está configurado (faltan variables de entorno)');
  
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const fileName = 'prod-' + uniqueSuffix + path.extname(file.originalname);

  const { data, error } = await supabase.storage
    .from('productos')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) throw error;

  const { data: publicData } = supabase.storage
    .from('productos')
    .getPublicUrl(fileName);

  return publicData.publicUrl;
}

// Función para autogenerar código de producto (PostgreSQL)
async function generarCodigoProducto(tipo_inventario) {
  const prefijos = { 'CLINICA': 'CLI', 'PETSHOP': 'PET', 'FARMACIA': 'FAR' };
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

// Obtener historial del producto (ventas, compras, movimientos de stock)
router.get('/:id/historial', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Obtener ventas del producto
    const ventasRes = await db.query(`
      SELECT vd.cantidad, vd.precio_unit, vd.subtotal, v.fecha, v.id as venta_id, p.razon_social as cliente_nombre
      FROM ventas_detalle vd
      JOIN ventas v ON v.id = vd.venta_id
      LEFT JOIN personas p ON p.id = v.cliente_id
      WHERE vd.producto_id = $1 AND v.estado = 'COMPLETADA'
      ORDER BY v.fecha DESC
      LIMIT 100
    `, [id]);

    // 2. Obtener compras del producto
    const comprasRes = await db.query(`
      SELECT cd.cantidad, cd.costo_unit, cd.subtotal, c.fecha, c.id as compra_id, p.razon_social as proveedor_nombre, c.numero_factura
      FROM compras_detalle cd
      JOIN compras c ON c.id = cd.compra_id
      LEFT JOIN personas p ON p.id = c.proveedor_id
      WHERE cd.producto_id = $1 AND c.estado != 'ANULADA'
      ORDER BY c.fecha DESC
      LIMIT 100
    `, [id]);

    // 3. Obtener movimientos de stock
    const movRes = await db.query(`
      SELECT ms.*, u.nombre_completo as usuario_nombre,
             fo.nombre as filial_origen_nombre, fd.nombre as filial_destino_nombre
      FROM movimientos_stock ms
      JOIN usuarios u ON u.id = ms.usuario_id
      LEFT JOIN filiales fo ON fo.id = ms.filial_origen
      LEFT JOIN filiales fd ON fd.id = ms.filial_destino
      WHERE ms.producto_id = $1
      ORDER BY ms.fecha DESC
      LIMIT 100
    `, [id]);

    res.json({
      ventas: ventasRes.rows,
      compras: comprasRes.rows,
      movimientos: movRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/', upload.single('foto'), async (req, res) => {
  const { nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, tipo_inventario } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

  try {
    const tipo = tipo_inventario || 'FARMACIA';
    const codigo = await generarCodigoProducto(tipo);
    
    let foto_url = null;
    if (req.file) {
      foto_url = await uploadToSupabase(req.file);
    }
    
    const result = await db.query(`INSERT INTO productos (codigo, nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, requiere_receta, tipo_inventario, foto_url)
                          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`, [
      codigo, 
      nombre.trim().toUpperCase(), 
      (descripcion || '').trim().toUpperCase(), 
      categoria_id || null, 
      (unidad_medida || 'UNIDAD').trim().toUpperCase(),
      precio_costo || 0, 
      precio_venta_menor || 0, 
      precio_venta_mayor || 0,
      iva_tipo || '10', 
      stock_minimo || 0, 
      requiere_receta ? 1 : 0, 
      tipo, 
      foto_url
    ]);

    res.json({ id: result.rows[0].id, codigo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', upload.single('foto'), async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    descripcion,
    categoria_id,
    unidad_medida,
    precio_costo,
    precio_venta_menor,
    precio_venta_mayor,
    iva_tipo,
    stock_minimo,
    requiere_receta,
    activo
  } = req.body;

  try {
    const currRes = await db.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (currRes.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const current = currRes.rows[0];

    let foto_url = current.foto_url;
    if (req.file) {
      foto_url = await uploadToSupabase(req.file);
    }

    const nuevoNombre = nombre !== undefined && nombre !== null ? String(nombre).trim().toUpperCase() : current.nombre;
    const nuevaDesc = descripcion !== undefined && descripcion !== null ? String(descripcion).trim().toUpperCase() : current.descripcion;
    const nuevaCat = categoria_id !== undefined ? categoria_id : current.categoria_id;
    const nuevaUnidad = unidad_medida !== undefined && unidad_medida !== null ? String(unidad_medida).trim().toUpperCase() : current.unidad_medida;
    const nuevoCosto = precio_costo !== undefined && precio_costo !== null ? Number(precio_costo) : current.precio_costo;
    const nuevaVentaMenor = precio_venta_menor !== undefined && precio_venta_menor !== null ? Number(precio_venta_menor) : current.precio_venta_menor;
    const nuevaVentaMayor = precio_venta_mayor !== undefined && precio_venta_mayor !== null ? Number(precio_venta_mayor) : current.precio_venta_mayor;
    const nuevoIva = iva_tipo !== undefined && iva_tipo !== null ? iva_tipo : current.iva_tipo;
    const nuevoStockMin = stock_minimo !== undefined && stock_minimo !== null ? Number(stock_minimo) : current.stock_minimo;
    const nuevoReceta = requiere_receta !== undefined ? (requiere_receta ? 1 : 0) : current.requiere_receta;
    const nuevoActivo = activo !== undefined ? (activo ? 1 : 0) : current.activo;

    const sql = `
      UPDATE productos SET
        nombre = $1,
        descripcion = $2,
        categoria_id = $3,
        unidad_medida = $4,
        precio_costo = $5,
        precio_venta_menor = $6,
        precio_venta_mayor = $7,
        iva_tipo = $8,
        stock_minimo = $9,
        requiere_receta = $10,
        activo = $11,
        foto_url = $12
      WHERE id = $13
    `;

    await db.query(sql, [
      nuevoNombre,
      nuevaDesc,
      nuevaCat,
      nuevaUnidad,
      nuevoCosto,
      nuevaVentaMenor,
      nuevaVentaMayor,
      nuevoIva,
      nuevoStockMin,
      nuevoReceta,
      nuevoActivo,
      foto_url,
      id
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
