const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno desde el backend
const envPath = path.join(__dirname, 'backend', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: La variable DATABASE_URL no está definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Función de clasificación por palabras clave
function inferTipoInventario(name) {
  const clean = name.toLowerCase();
  
  // Palabras clave de CLINICA (Servicios y Vacunas)
  const clinicaKeywords = [
    'vacuna', 'septuple', 'antirrabica', 'triple', 'agujas', 'jeringa', 'servicio', 'corte de uña',
    'corte de una', 'baño', 'banho', 'banos', 'bano', 'consulta', 'ecografia', 'radiografia', 
    'cirugia', 'castracion', 'internacion', 'curacion', 'hemograma', 'receta'
  ];
  
  // Palabras clave de FARMACIA (Medicamentos y Antibióticos)
  const farmaciaKeywords = [
    'mg', 'ml', 'biotic', 'amoxivet', 'floxacin', 'doxivet', 'terramicina', 'vetcort', 'vetcor', 
    'biomisol', 'hepacura', 'timpancin', 'dexayal', 'dexagal', 'peridon', 'finestrol', 'gasiplen', 
    'enterogel', 'vitabiot', 'rifag', 'rifa g', 'dectomax', 'ivermic', 'pomada', 'canex', 
    'analgecin', 'rowatinex', 'floxin', 'floxapron', 'amoxi', 'doxi', 'gentavet', 'spray',
    'pipeta', 'clazic', 'analgesin', 'soludex', 'antiseptico', 'antiinflamatorio', 'antiparasitario',
    'vitamina', 'antibiotico', 'jarabe', 'suspension', 'inyectable', 'comprimido', 'comprimidos',
    'timpacin'
  ];
  
  // Palabras clave de PETSHOP (Alimentos, accesorios, granel y balanceados)
  const petshopKeywords = [
    'dog', 'cat', 'gat', 'cachorro', 'ponedora', 'ave', 'conejo', 'cerdo', 'maiz', 'afrecho', 
    'shampoo', 'arena', 'huesito', 'biberon', 'cepillo', 'girasol', 'champu', 'maíz', 'terminador',
    'iniciador', 'crecimiento', 'engorde', 'lechera', 'equino', 'comida', 'racion', 'pequeñas', 
    'pequenas', 'adulto', 'adultos', 'granel', 'star pop', 'bionature', 'chow', 'filhotes',
    'comedero', 'bebedero', 'collar', 'correa', 'pretal', 'juguete', 'rascador'
  ];

  for (const kw of clinicaKeywords) {
    if (clean.includes(kw)) return 'CLINICA';
  }
  
  for (const kw of farmaciaKeywords) {
    if (clean.includes(kw)) return 'FARMACIA';
  }

  for (const kw of petshopKeywords) {
    if (clean.includes(kw)) return 'PETSHOP';
  }

  return 'AMBOS'; // Default si no hay coincidencia clara
}

async function main() {
  const isCommit = process.argv.includes('--commit');
  const propuestaFile = path.join(__dirname, 'propuesta_unificacion.json');

  if (!fs.existsSync(propuestaFile)) {
    console.error(`❌ Error: No se encontró el archivo ${propuestaFile}. Ejecute primero generar_propuesta_unificacion.js`);
    process.exit(1);
  }

  const propuesta = JSON.parse(fs.readFileSync(propuestaFile, 'utf8'));
  const approvedMerges = propuesta.filter(p => p.unificar);

  console.log(`📖 Procesando propuesta de unificación...`);
  console.log(`Unificaciones aprobadas: ${approvedMerges.length}`);
  console.log(`Modo: ${isCommit ? '🚀 REAL (COMMIT)' : '⚠️ PRUEBA (DRY RUN)'}\n`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ejecutar fusiones de productos aprobadas
    for (const merge of approvedMerges) {
      const dupId = merge.nuevo_producto.id;
      const orgId = merge.producto_existente.id;
      const dupName = merge.nuevo_producto.nombre;
      const orgName = merge.producto_existente.nombre;

      console.log(`🔗 Fusionando: [${merge.nuevo_producto.codigo}] "${dupName}" -> [${merge.producto_existente.codigo}] "${orgName}"`);

      // A. Actualizar tablas de detalles que apuntan al producto duplicado
      await client.query('UPDATE ventas_detalle SET producto_id = $1 WHERE producto_id = $2', [orgId, dupId]);
      await client.query('UPDATE compras_detalle SET producto_id = $1 WHERE producto_id = $2', [orgId, dupId]);
      await client.query('UPDATE lotes SET producto_id = $1 WHERE producto_id = $2', [orgId, dupId]);
      await client.query('UPDATE movimientos_stock SET producto_id = $1 WHERE producto_id = $2', [orgId, dupId]);
      await client.query('UPDATE recetas_detalle SET producto_id = $1 WHERE producto_id = $2', [orgId, dupId]);

      // B. Fusionar la tabla de Stock
      const stockDupRes = await client.query('SELECT filial_id, cantidad FROM stock WHERE producto_id = $1', [dupId]);
      for (const row of stockDupRes.rows) {
        const filialId = row.filial_id;
        const cantDup = parseFloat(row.cantidad) || 0;

        const stockOrgRes = await client.query('SELECT cantidad FROM stock WHERE producto_id = $1 AND filial_id = $2', [orgId, filialId]);
        if (stockOrgRes.rows.length > 0) {
          // Si el original ya tiene stock en esa filial, sumamos y eliminamos el del duplicado
          await client.query('UPDATE stock SET cantidad = cantidad + $1 WHERE producto_id = $2 AND filial_id = $3', [cantDup, orgId, filialId]);
          await client.query('DELETE FROM stock WHERE producto_id = $1 AND filial_id = $2', [dupId, filialId]);
        } else {
          // Si no tiene stock, cambiamos el producto_id en el stock del duplicado
          await client.query('UPDATE stock SET producto_id = $1 WHERE producto_id = $2 AND filial_id = $3', [orgId, dupId, filialId]);
        }
      }

      // C. Eliminar el producto duplicado
      await client.query('DELETE FROM productos WHERE id = $1', [dupId]);
    }

    // 2. Clasificar los productos nuevos (código 'PRD-xxxx') que quedaron en la base de datos
    console.log('\n🏷️ Clasificando categorías de productos nuevos remanentes...');
    const prodRes = await client.query(`
      SELECT id, codigo, nombre, tipo_inventario 
      FROM productos 
      WHERE codigo LIKE 'PRD-%' 
        AND codigo NOT IN ('PRD-COMPRA-HISTORICA', 'PRD-HISTORICO')
    `);

    let classifiedCount = 0;
    for (const prod of prodRes.rows) {
      const suggestedType = inferTipoInventario(prod.nombre);
      if (prod.tipo_inventario !== suggestedType) {
        await client.query('UPDATE productos SET tipo_inventario = $1 WHERE id = $2', [suggestedType, prod.id]);
        console.log(`  🏷️ [${prod.codigo}] "${prod.nombre}" clasificado como -> ${suggestedType} (Antes: ${prod.tipo_inventario})`);
        classifiedCount++;
      }
    }
    console.log(`Clasificados/Actualizados: ${classifiedCount} productos.`);

    if (isCommit) {
      await client.query('COMMIT');
      console.log('\n🎉 ¡Unificación y Clasificación completada con éxito en la base de datos (COMMIT)!');
    } else {
      await client.query('ROLLBACK');
      console.log('\n⚠️ DRY RUN COMPLETO: Todos los cambios fueron revertidos con ROLLBACK de forma segura.');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error durante el proceso de unificación. Se revirtieron los cambios:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
