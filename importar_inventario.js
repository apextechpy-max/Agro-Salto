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
  const csvFile = path.join(__dirname, 'plantilla_inventario.csv');
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ Error: No se encontró el archivo ${csvFile}`);
    process.exit(1);
  }

  console.log('📖 Leyendo archivo plantilla_inventario.csv...');
  const content = fs.readFileSync(csvFile, 'utf-8');
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

  console.log(`🚀 Preparando la importación de ${rows.length} productos...`);
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

    // Asumimos Filial 1 (Casa Central) por defecto
    const filialId = 1;
    
    // Obtener un usuario de referencia para el historial (por ejemplo, el admin)
    const userRes = await client.query("SELECT id FROM usuarios WHERE usuario = 'admin' LIMIT 1");
    const usuarioId = userRes.rows.length > 0 ? userRes.rows[0].id : 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let {
        codigo,
        nombre,
        descripcion,
        categoria,
        unidad_medida,
        precio_costo,
        precio_venta_menor,
        precio_venta_mayor,
        iva_tipo,
        stock_minimo,
        tipo_inventario,
        stock_actual,
        numero_lote,
        fecha_vencimiento
      } = row;

      if (!nombre || nombre.trim() === '') {
        console.warn(`⚠️ Fila ${i + 2} saltada: El nombre es requerido.`);
        continue;
      }

      // Convertir strings a MAYÚSCULAS
      nombre = nombre.trim().toUpperCase();
      descripcion = descripcion ? descripcion.trim().toUpperCase() : '';
      categoria = categoria ? categoria.trim().toUpperCase() : '';
      unidad_medida = (unidad_medida || 'UNIDAD').trim().toUpperCase();
      tipo_inventario = (tipo_inventario || 'AMBOS').trim().toUpperCase();
      numero_lote = numero_lote ? numero_lote.trim().toUpperCase() : '';

      const tInventario = tipo_inventario;

      // Si no tiene código, se autogenera según el tipo de inventario
      if (!codigo || codigo.trim() === '') {
        codigo = await getNextCodigo(tInventario);
        console.log(`✨ Código autogenerado para "${nombre}": ${codigo}`);
      } else {
        codigo = codigo.trim().toUpperCase();
      }

      // 1. Manejo de Categoría
      let categoriaId = null;
      if (categoria !== '') {
        const catRes = await client.query('SELECT id FROM categorias WHERE LOWER(nombre) = LOWER($1)', [categoria]);
        if (catRes.rows.length > 0) {
          categoriaId = catRes.rows[0].id;
        } else {
          const newCat = await client.query('INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', [categoria]);
          categoriaId = newCat.rows[0].id;
          console.log(`📁 Nueva categoría creada: "${categoria}"`);
        }
      }

      // 2. Mapear valores por defecto y numéricos
      const uMedida = unidad_medida;
      const costo = parseFloat(precio_costo) || 0;
      const ventaMenor = parseFloat(precio_venta_menor) || 0;
      const ventaMayor = parseFloat(precio_venta_mayor) || 0;
      const iva = iva_tipo || '10';
      const stMinimo = parseFloat(stock_minimo) || 0;
      const cantActual = parseFloat(stock_actual) || 0;

      // 3. Upsert del Producto
      let productoId = null;
      const prodCheck = await client.query('SELECT id FROM productos WHERE codigo = $1', [codigo]);

      if (prodCheck.rows.length > 0) {
        productoId = prodCheck.rows[0].id;
        await client.query(
          `UPDATE productos 
           SET nombre = $1, descripcion = $2, categoria_id = $3, unidad_medida = $4, 
               precio_costo = $5, precio_venta_menor = $6, precio_venta_mayor = $7, 
               iva_tipo = $8, stock_minimo = $9, tipo_inventario = $10 
           WHERE id = $11`,
          [nombre, descripcion, categoriaId, uMedida, costo, ventaMenor, ventaMayor, iva, stMinimo, tInventario, productoId]
        );
        console.log(`🔄 Producto actualizado: [${codigo}] ${nombre}`);
      } else {
        const prodInsert = await client.query(
          `INSERT INTO productos 
           (codigo, nombre, descripcion, categoria_id, unidad_medida, precio_costo, precio_venta_menor, precio_venta_mayor, iva_tipo, stock_minimo, tipo_inventario, activo) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1) RETURNING id`,
          [codigo, nombre, descripcion, categoriaId, uMedida, costo, ventaMenor, ventaMayor, iva, stMinimo, tInventario]
        );
        productoId = prodInsert.rows[0].id;
        console.log(`✅ Producto creado: [${codigo}] ${nombre}`);
      }

      // 4. Actualizar Stock y Lotes (si hay stock_actual definido y es válido)
      if (stock_actual !== undefined && stock_actual !== '') {
        // Upsert de stock
        const stockCheck = await client.query('SELECT * FROM stock WHERE producto_id = $1 AND filial_id = $2', [productoId, filialId]);
        if (stockCheck.rows.length > 0) {
          await client.query('UPDATE stock SET cantidad = $1 WHERE producto_id = $2 AND filial_id = $3', [cantActual, productoId, filialId]);
        } else {
          await client.query('INSERT INTO stock (producto_id, filial_id, cantidad) VALUES ($1, $2, $3)', [productoId, filialId, cantActual]);
        }

        // Registrar movimiento de stock (AJUSTE por carga inicial)
        await client.query(
          `INSERT INTO movimientos_stock (tipo, producto_id, filial_destino, cantidad, costo_unit, observacion, usuario_id) 
           VALUES ('AJUSTE', $1, $2, $3, $4, 'CARGA INICIAL DE INVENTARIO', $5)`,
          [productoId, filialId, cantActual, costo, usuarioId]
        );

        // Si se define un lote o hay cantidad, creamos un lote
        if (cantActual > 0) {
          const nLote = numero_lote || 'LOTE-INICIAL';
          const codLote = `${codigo}-${nLote}`;
          const fVto = normalizeDate(fecha_vencimiento);

          // Upsert de Lote (por código único de lote)
          const loteCheck = await client.query('SELECT id FROM lotes WHERE codigo_lote = $1', [codLote]);
          if (loteCheck.rows.length > 0) {
            await client.query(
              `UPDATE lotes 
               SET cantidad_act = $1, cantidad_ini = $2, fecha_vto = $3, costo_unitario = $4, estado = 'ACTIVO' 
               WHERE id = $5`,
              [cantActual, cantActual, fVto, costo, loteCheck.rows[0].id]
            );
            console.log(`📦 Lote actualizado: ${codLote} con cantidad ${cantActual}`);
          } else {
            await client.query(
              `INSERT INTO lotes (producto_id, filial_id, numero_lote, codigo_lote, fecha_vto, cantidad_ini, cantidad_act, costo_unitario, estado) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVO')`,
              [productoId, filialId, nLote, codLote, fVto, cantActual, cantActual, costo]
            );
            console.log(`📦 Lote creado: ${codLote} con cantidad ${cantActual}`);
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 ¡Importación completada con éxito!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante la importación. Se revirtieron todos los cambios:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
