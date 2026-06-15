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
  const csvFile = path.join(__dirname, 'plantilla_ventas.csv');
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ Error: No se encontró el archivo ${csvFile}`);
    process.exit(1);
  }

  console.log('📖 Leyendo archivo plantilla_ventas.csv...');
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

  // Agrupar filas por ticket (Venta)
  const ventasAgrupadas = {};
  rows.forEach((row, idx) => {
    const ticket = (row.ticket || `GEN-${idx}`).trim().toUpperCase();
    if (!ventasAgrupadas[ticket]) {
      ventasAgrupadas[ticket] = [];
    }
    ventasAgrupadas[ticket].push(row);
  });

  console.log(`🚀 Preparando la importación de ${Object.keys(ventasAgrupadas).length} ventas agrupadas...`);
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

    // 1. Asegurar Cliente Ocasional por defecto
    let clienteOcasionalId = null;
    const cliOcaRes = await client.query("SELECT id FROM personas WHERE LOWER(razon_social) = 'cliente ocasional' AND tipo IN ('CLIENTE', 'AMBOS') LIMIT 1");
    if (cliOcaRes.rows.length > 0) {
      clienteOcasionalId = cliOcaRes.rows[0].id;
    } else {
      const newCli = await client.query(
        "INSERT INTO personas (tipo, razon_social, ruc, condicion_iva, activo) VALUES ('CLIENTE', 'CLIENTE OCASIONAL', '44444401-7', 'SIN_RUC', 1) RETURNING id"
      );
      clienteOcasionalId = newCli.rows[0].id;
      console.log('👤 Cliente Ocasional genérico creado.');
    }

    // 2. Asegurar Producto Genérico para ventas sin código específico
    let productoGenericoId = null;
    const prodGenRes = await client.query("SELECT id FROM productos WHERE codigo = 'PRD-HISTORICO' LIMIT 1");
    if (prodGenRes.rows.length > 0) {
      productoGenericoId = prodGenRes.rows[0].id;
    } else {
      const newProd = await client.query(
        `INSERT INTO productos 
         (codigo, nombre, descripcion, unidad_medida, precio_costo, precio_venta_menor, iva_tipo, tipo_inventario, activo) 
         VALUES ('PRD-HISTORICO', 'VENTA HISTÓRICA', 'Producto genérico usado para migrar historial de ventas', 'UNIDAD', 0, 0, '10', 'AMBOS', 1) 
         RETURNING id`
      );
      productoGenericoId = newProd.rows[0].id;
      console.log('📦 Producto genérico "Venta Histórica" (PRD-HISTORICO) creado.');
    }

    // Asumimos Filial 1 (Casa Central) por defecto
    const filialId = 1;

    // Obtener usuario administrador para auditoría
    const userRes = await client.query("SELECT id FROM usuarios WHERE usuario = 'admin' LIMIT 1");
    const usuarioId = userRes.rows.length > 0 ? userRes.rows[0].id : 1;

    for (const ticket of Object.keys(ventasAgrupadas)) {
      const items = ventasAgrupadas[ticket];
      const primeraFila = items[0];

      // Determinar cliente
      let clienteId = clienteOcasionalId;
      if (primeraFila.cliente && primeraFila.cliente.trim() !== '') {
        const nomCli = primeraFila.cliente.trim().toUpperCase();
        const rucCli = primeraFila.ruc_cliente ? primeraFila.ruc_cliente.trim() : null;

        // Intentar buscar por RUC/CI o por Razón Social
        let cliRes;
        if (rucCli) {
          cliRes = await client.query("SELECT id FROM personas WHERE ruc = $1 AND tipo IN ('CLIENTE', 'AMBOS')", [rucCli]);
        } else {
          cliRes = await client.query("SELECT id FROM personas WHERE LOWER(razon_social) = LOWER($1) AND tipo IN ('CLIENTE', 'AMBOS')", [nomCli]);
        }

        if (cliRes.rows.length > 0) {
          clienteId = cliRes.rows[0].id;
        } else {
          // Crear cliente ocasional o específico
          const newCli = await client.query(
            "INSERT INTO personas (tipo, razon_social, ruc, condicion_iva, activo) VALUES ('CLIENTE', $1, $2, 'CONTRIBUYENTE', 1) RETURNING id",
            [nomCli, rucCli || null]
          );
          clienteId = newCli.rows[0].id;
          console.log(`👤 Cliente creado para historial: "${nomCli}"`);
        }
      }

      // Parámetros generales de la venta con normalización de fecha
      const fechaVenta = normalizeDate(primeraFila.fecha) || new Date().toISOString();
      const tipoPago = (primeraFila.tipo_pago || 'CONTADO').trim().toUpperCase();

      // Calcular detalles de los ítems
      let subtotalTotal = 0;
      let descuentoTotal = 0;
      let iva5Total = 0;
      let iva10Total = 0;
      const processedItems = [];

      for (const it of items) {
        const cant = parseFloat(it.cantidad) || 1;
        const pUnit = parseFloat(it.precio_unitario) || 0;
        const descItem = parseFloat(it.descuento_item) || 0;
        const ivaTipo = it.iva_tipo || '10';

        // Intentar resolver producto
        let prodId = null;
        let finalCodigo = it.codigo_producto ? it.codigo_producto.trim() : '';
        const nomProd = it.nombre_producto ? it.nombre_producto.trim().toUpperCase() : '';

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

        // 3. Si sigue sin existir pero tiene un nombre de producto, crearlo automáticamente
        if (!prodId && nomProd !== '') {
          finalCodigo = await getNextCodigo('AMBOS'); // Default prefix PRD
          const prodInsert = await client.query(
            `INSERT INTO productos 
             (codigo, nombre, descripcion, unidad_medida, precio_costo, precio_venta_menor, iva_tipo, stock_minimo, tipo_inventario, activo) 
             VALUES ($1, $2, 'AUTOCREADO DURANTE IMPORTACIÓN DE VENTAS', 'UNIDAD', 0, $3, $4, 0, 'AMBOS', 1) RETURNING id`,
            [finalCodigo, nomProd, pUnit, ivaTipo]
          );
          prodId = prodInsert.rows[0].id;
          console.log(`✨ Producto autocreado en venta: [${finalCodigo}] ${nomProd}`);
        }

        // 4. Si no tiene ni código ni nombre, usar producto genérico
        if (!prodId) {
          prodId = productoGenericoId;
        }

        const subItem = (cant * pUnit) - descItem;
        subtotalTotal += (cant * pUnit);
        descuentoTotal += descItem;

        if (ivaTipo === '10') {
          iva10Total += subItem * 10 / 110;
        } else if (ivaTipo === '5') {
          iva5Total += subItem * 5 / 105;
        }

        processedItems.push({
          producto_id: prodId,
          cantidad: cant,
          precio_unit: pUnit,
          iva_tipo: ivaTipo,
          descuento: descItem,
          subtotal: subItem
        });
      }

      const totalVenta = subtotalTotal - descuentoTotal;

      // Insertar Venta
      const vRes = await client.query(
        `INSERT INTO ventas 
         (tipo, cliente_id, filial_id, subtotal, descuento, iva_5, iva_10, total, tipo_pago, monto_pagado, vuelto, estado, usuario_id, observacion, fecha, creado_en)
         VALUES ('MINORISTA', $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'COMPLETADA', $10, $11, $12, $12) 
         RETURNING id`,
        [
          clienteId,
          filialId,
          subtotalTotal,
          descuentoTotal,
          iva5Total,
          iva10Total,
          totalVenta,
          tipoPago,
          totalVenta, // monto_pagado
          usuarioId,
          `Importación histórica - Ticket ${ticket}`,
          fechaVenta
        ]
      );
      const ventaId = vRes.rows[0].id;

      // Insertar detalles de la venta
      for (const item of processedItems) {
        await client.query(
          `INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unit, iva_tipo, descuento, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ventaId, item.producto_id, item.cantidad, item.precio_unit, item.iva_tipo, item.descuento, item.subtotal]
        );
      }

      console.log(`🧾 Venta importada: Ticket ${ticket} (${tipoPago}) - Total: ${totalVenta.toLocaleString()} GS (Fecha: ${fechaVenta})`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 ¡Importación de ventas históricas completada con éxito!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante la importación de ventas. Se revirtieron los cambios:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
