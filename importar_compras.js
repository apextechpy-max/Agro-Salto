const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Cargar variables de entorno desde el backend
const envPath = path.join(__dirname, 'backend', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('⚠️ No se encontró el archivo backend/.env. Se usarán las variables del entorno actual.');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: La variable DATABASE_URL no está definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Función para normalizar fechas de DD/MM/AAAA a AAAA-MM-DD
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  dateStr = dateStr.trim();
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `${fullYear}-${month}-${day}`;
    }
  }
  return dateStr;
}

// Función para normalizar y estandarizar nombres de productos
function normalizeProductName(name) {
  if (!name) return '';
  let clean = name.trim().toUpperCase();
  // Eliminar espacios múltiples
  clean = clean.replace(/\s+/g, ' ');
  // Eliminar punto final si existe
  clean = clean.replace(/\.$/, '');
  return clean.trim();
}

// Función para parsear una línea de CSV separada por punto y coma (;)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  const csvFile = path.join(__dirname, 'plantilla_compras.csv');
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ Error: No se encontró el archivo ${csvFile}`);
    process.exit(1);
  }

  console.log('📖 Leyendo archivo plantilla_compras.csv...');
  const content = fs.readFileSync(csvFile, 'latin1');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length <= 1) {
    console.error('❌ Error: El archivo CSV está vacío o solo contiene la cabecera.');
    process.exit(1);
  }

  const header = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < header.length) {
      while (values.length < header.length) {
        values.push('');
      }
    }
    const row = {};
    header.forEach((key, idx) => {
      // Normalizar claves de cabecera a minúsculas
      const normalizedKey = key.trim().toLowerCase();
      if (normalizedKey) {
        row[normalizedKey] = values[idx] || '';
      }
    });
    rows.push(row);
  }

  // Agrupar filas por factura (o por proveedor + fecha si la factura viene vacía)
  const comprasAgrupadas = {};
  rows.forEach((row, idx) => {
    let factura = row.factura ? row.factura.trim().toUpperCase() : '';
    if (!factura) {
      const cleanProv = (row.proveedor || 'OCASIONAL').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanFecha = (row.fecha || 'HOY').trim().replace(/\//g, '-');
      factura = `COMPRA-${cleanProv}-${cleanFecha}`;
    }
    if (!comprasAgrupadas[factura]) {
      comprasAgrupadas[factura] = [];
    }
    comprasAgrupadas[factura].push(row);
  });

  console.log(`🚀 Preparando la importación de ${Object.keys(comprasAgrupadas).length} compras agrupadas...`);
  const client = await pool.connect();

  // Contadores en memoria para autogenerar códigos correlativos
  const counters = {};
  async function getNextCodigo(tipoInventario) {
    const prefijos = { 'CLINICA': 'CLI', 'PETSHOP': 'PET', 'FARMACIA': 'FAR' };
    const prefix = prefijos[tipoInventario] || 'PRD';
    
    if (counters[prefix] === undefined) {
      const result = await client.query('SELECT codigo FROM productos WHERE codigo LIKE $1 ORDER BY id DESC LIMIT 1', [`${prefix}-%`]);
      const ultimo = result.rows[0];
      let siguiente = 1;
      if (ultimo) {
        const parts = ultimo.codigo.split('-');
        if (parts.length > 1) {
          const num = parseInt(parts[1]);
          if (!isNaN(num)) siguiente = num + 1;
        }
      }
      counters[prefix] = siguiente;
    }
    
    const numStr = String(counters[prefix]).padStart(4, '0');
    const code = `${prefix}-${numStr}`;
    counters[prefix]++;
    return code;
  }

  try {
    await client.query('BEGIN');

    // 1. Asegurar Proveedor Genérico por defecto
    let proveedorGenericoId = null;
    const provGenRes = await client.query("SELECT id FROM personas WHERE LOWER(razon_social) = 'proveedor genérico' AND tipo IN ('PROVEEDOR', 'AMBOS') LIMIT 1");
    if (provGenRes.rows.length > 0) {
      proveedorGenericoId = provGenRes.rows[0].id;
    } else {
      const newProv = await client.query(
        "INSERT INTO personas (tipo, razon_social, ruc, condicion_iva, activo) VALUES ('PROVEEDOR', 'PROVEEDOR GENÉRICO', '44444402-5', 'SIN_RUC', 1) RETURNING id"
      );
      proveedorGenericoId = newProv.rows[0].id;
      console.log('👤 Proveedor Genérico creado.');
    }

    // 2. Asegurar Producto Genérico para compras sin código específico
    let productoGenericoId = null;
    const prodGenRes = await client.query("SELECT id FROM productos WHERE codigo = 'PRD-COMPRA-HISTORICA' LIMIT 1");
    if (prodGenRes.rows.length > 0) {
      productoGenericoId = prodGenRes.rows[0].id;
    } else {
      const newProd = await client.query(
        `INSERT INTO productos 
         (codigo, nombre, descripcion, unidad_medida, precio_costo, precio_venta_menor, iva_tipo, tipo_inventario, activo) 
         VALUES ('PRD-COMPRA-HISTORICA', 'COMPRA HISTÓRICA', 'Producto genérico usado para migrar historial de compras', 'UNIDAD', 0, 0, '10', 'AMBOS', 1) 
         RETURNING id`
      );
      productoGenericoId = newProd.rows[0].id;
      console.log('📦 Producto genérico "Compra Histórica" (PRD-COMPRA-HISTORICA) creado.');
    }

    // Asumimos Filial 1 (Casa Central) por defecto
    const filialId = 1;

    // Obtener usuario administrador para auditoría
    const userRes = await client.query("SELECT id FROM usuarios WHERE usuario = 'admin' LIMIT 1");
    const usuarioId = userRes.rows.length > 0 ? userRes.rows[0].id : 1;

    for (const factura of Object.keys(comprasAgrupadas)) {
      const items = comprasAgrupadas[factura];
      const primeraFila = items[0];

      // Determinar proveedor
      let proveedorId = proveedorGenericoId;
      if (primeraFila.proveedor && primeraFila.proveedor.trim() !== '') {
        const nomProv = primeraFila.proveedor.trim().toUpperCase();
        const rucProv = primeraFila.ruc_proveedor ? primeraFila.ruc_proveedor.trim() : null;

        // Intentar buscar por RUC o por Razón Social
        let provRes;
        if (rucProv) {
          provRes = await client.query("SELECT id FROM personas WHERE ruc = $1 AND tipo IN ('PROVEEDOR', 'AMBOS')", [rucProv]);
        } else {
          provRes = await client.query("SELECT id FROM personas WHERE LOWER(razon_social) = LOWER($1) AND tipo IN ('PROVEEDOR', 'AMBOS')", [nomProv]);
        }

        if (provRes.rows.length > 0) {
          proveedorId = provRes.rows[0].id;
        } else {
          const newProv = await client.query(
            "INSERT INTO personas (tipo, razon_social, ruc, condicion_iva, activo) VALUES ('PROVEEDOR', $1, $2, 'CONTRIBUYENTE', 1) RETURNING id",
            [nomProv, rucProv || null]
          );
          proveedorId = newProv.rows[0].id;
          console.log(`👤 Proveedor creado para historial: "${nomProv}"`);
        }
      }

      // Parámetros de la compra con normalización de fecha
      const fechaCompra = normalizeDate(primeraFila.fecha) || new Date().toISOString().split('T')[0];

      let subtotalTotal = 0;
      let iva5Total = 0;
      let iva10Total = 0;
      const processedItems = [];

      for (const it of items) {
        const cant = parseFloat(it.cantidad) || 1;
        const costUnit = parseFloat(it.costo_unitario) || 0;
        const pVentaMenor = parseFloat(it.precio_venta_menor) || 0;
        const pVentaMayor = parseFloat(it.precio_venta_mayor) || 0;
        const ivaTipo = it.iva_tipo || '10';

        // Intentar resolver producto
        let prodId = null;
        let finalCodigo = it.codigo_producto ? it.codigo_producto.trim() : '';
        const nomProd = normalizeProductName(it.nombre_producto);

        // 1. Intentar buscar por código si se provee
        if (finalCodigo !== '') {
          const prodRes = await client.query('SELECT id FROM productos WHERE codigo = $1', [finalCodigo]);
          if (prodRes.rows.length > 0) {
            prodId = prodRes.rows[0].id;
          }
        }

        // 2. Si no se encontró por código (o no se proveyó), buscar por nombre exacto (case-insensitive)
        if (!prodId && nomProd !== '') {
          const prodRes = await client.query('SELECT id, codigo FROM productos WHERE LOWER(nombre) = LOWER($1) LIMIT 1', [nomProd]);
          if (prodRes.rows.length > 0) {
            prodId = prodRes.rows[0].id;
            finalCodigo = prodRes.rows[0].codigo;
          }
        }

        const tInventario = (it.tipo_inventario || 'AMBOS').trim().toUpperCase();

        // 3. Si sigue sin existir pero tiene un nombre de producto, crearlo automáticamente
        if (!prodId && nomProd !== '') {
          finalCodigo = await getNextCodigo(tInventario);
          const prodInsert = await client.query(
            `INSERT INTO productos 
             (codigo, nombre, descripcion, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, tipo_inventario, activo) 
             VALUES ($1, $2, 'AUTOCREADO DURANTE IMPORTACIÓN DE COMPRAS', 'UNIDAD', $3, $4, $5, $6, 0, $7, 1) RETURNING id`,
            [finalCodigo, nomProd, costUnit, pVentaMenor, pVentaMayor, ivaTipo, tInventario]
          );
          prodId = prodInsert.rows[0].id;
          console.log(`✨ Producto autocreado en compra: [${finalCodigo}] ${nomProd} (${tInventario})`);
        }

        // 4. Si no tiene ni código ni nombre, usar producto genérico
        if (!prodId) {
          prodId = productoGenericoId;
        }

        const subItem = cant * costUnit;
        subtotalTotal += subItem;

        if (ivaTipo === '10') {
          iva10Total += subItem * 10 / 110;
        } else if (ivaTipo === '5') {
          iva5Total += subItem * 5 / 105;
        }

        processedItems.push({
          producto_id: prodId,
          cantidad: cant,
          costo_unit: costUnit,
          iva_tipo: ivaTipo,
          subtotal: subItem
        });
      }

      // Insertar Compra
      const cRes = await client.query(
        `INSERT INTO compras 
         (proveedor_id, filial_id, numero_factura, fecha, subtotal, iva_5, iva_10, total, estado, observacion, usuario_id, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $5, 'COMPLETADA', $8, $9, $10) 
         RETURNING id`,
        [
          proveedorId,
          filialId,
          factura,
          fechaCompra,
          subtotalTotal,
          iva5Total,
          iva10Total,
          `IMPORTACIÓN HISTÓRICA - FACTURA ${factura}`,
          usuarioId,
          fechaCompra
        ]
      );
      const compraId = cRes.rows[0].id;

      // Insertar detalles de la compra
      for (const item of processedItems) {
        await client.query(
          `INSERT INTO compras_detalle (compra_id, producto_id, cantidad, costo_unit, iva_tipo, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [compraId, item.producto_id, item.cantidad, item.costo_unit, item.iva_tipo, item.subtotal]
        );
      }

      console.log(`🧾 Compra importada: Factura ${factura} - Total: ${subtotalTotal.toLocaleString()} GS (Fecha: ${fechaCompra})`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 ¡Importación de compras históricas completada con éxito!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante la importación de compras. Se revirtieron los cambios:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
