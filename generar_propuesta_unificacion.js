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

// Distancia de Levenshtein para medir similitud de cadenas
function levenshtein(a, b) {
  const tmp = [];
  let i, j, alen = a.length, blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (i = 0; i <= alen; i++) tmp[i] = [i];
  for (j = 0; j <= blen; j++) tmp[0][j] = j;
  for (i = 1; i <= alen; i++) {
    for (j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

function cleanString(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, '')     // quitar caracteres especiales
    .replace(/\s+/g, ' ')
    .trim();
}

// Similitud de Jaccard basada en palabras
function jaccardSimilarity(str1, str2) {
  const stopWords = ['de', 'para', 'con', 'kg', 'ml', 'la', 'el', 'un', 'x', 'y', 'del', 'los', 'las'];
  const words1 = new Set(cleanString(str1).split(' ').filter(w => w.length > 1 && !stopWords.includes(w)));
  const words2 = new Set(cleanString(str2).split(' ').filter(w => w.length > 1 && !stopWords.includes(w)));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Obtener puntaje de similitud combinando Levenshtein y Jaccard
function getSimilarityScore(name1, name2) {
  const c1 = cleanString(name1);
  const c2 = cleanString(name2);
  
  if (c1 === c2) return 1.0;
  
  // Si uno está contenido en el otro y son largos
  if (c1.length > 4 && c2.length > 4) {
    if (c1.includes(c2) || c2.includes(c1)) {
      return 0.85;
    }
  }
  
  const jaccard = jaccardSimilarity(name1, name2);
  
  const maxLen = Math.max(c1.length, c2.length);
  const levDist = levenshtein(c1, c2);
  const levRatio = maxLen > 0 ? (maxLen - levDist) / maxLen : 0;
  
  return Math.max(jaccard, levRatio);
}

// Extraer peso o medida numérica de una cadena (ej: 25 kg, 10ml, 5 kg)
function extractMeasure(str) {
  const regex = /(\d+(?:[.,]\d+)?)\s*(kg|k|g|ml|l|mg|gr|grs)\b/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(str)) !== null) {
    const value = parseFloat(match[1].replace(',', '.'));
    let unit = match[2].toLowerCase();
    // Normalizar unidades
    if (unit === 'k') unit = 'kg';
    if (unit === 'gr' || unit === 'grs') unit = 'g';
    matches.push({ value, unit });
  }
  return matches;
}

// Verificar si hay conflicto de medidas (ej. 2kg vs 25kg)
function hasMeasureConflict(name1, name2) {
  const m1 = extractMeasure(name1);
  const m2 = extractMeasure(name2);
  
  if (m1.length === 0 || m2.length === 0) return false;
  
  // Comparar pares de medidas extraídas
  for (const item1 of m1) {
    for (const item2 of m2) {
      if (item1.unit === item2.unit && item1.value !== item2.value) {
        return true; // Mismo tipo de unidad pero distinto valor
      }
    }
  }
  return false;
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔍 Consultando base de datos...');
    const res = await client.query('SELECT id, codigo, nombre, precio_venta_menor, tipo_inventario FROM productos ORDER BY id ASC');
    const products = res.rows;
    
    // Separar productos nuevos creados por el importador
    const newProducts = products.filter(p => p.codigo.startsWith('PRD-') && p.codigo !== 'PRD-COMPRA-HISTORICA' && p.codigo !== 'PRD-HISTORICO');
    const existingProducts = products.filter(p => !p.codigo.startsWith('PRD-') || p.codigo === 'PRD-COMPRA-HISTORICA' || p.codigo === 'PRD-HISTORICO');
    
    console.log(`📋 Total productos: ${products.length}`);
    console.log(`🔹 Nuevos por importador: ${newProducts.length}`);
    console.log(`🔸 Productos existentes: ${existingProducts.length}`);
    
    const propuesta = [];
    
    for (const np of newProducts) {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const ep of existingProducts) {
        if (ep.codigo === 'PRD-COMPRA-HISTORICA' || ep.codigo === 'PRD-HISTORICO') continue;
        
        const score = getSimilarityScore(np.nombre, ep.nombre);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = ep;
        }
      }
      
      if (bestScore >= 0.65) {
        const p1 = parseFloat(np.precio_venta_menor) || 0;
        const p2 = parseFloat(bestMatch.precio_venta_menor) || 0;
        
        let unificar = bestScore >= 0.75;
        let razon = `Similitud de nombre del ${(bestScore * 100).toFixed(0)}%.`;
        
        // 1. Filtrar por conflicto de medidas
        if (hasMeasureConflict(np.nombre, bestMatch.nombre)) {
          unificar = false;
          razon += ' ⚠️ CONFLICTO DE MEDIDA (ej: 2kg vs 25kg).';
        }
        
        // 2. Filtrar por diferencia de precio significativa (más del 50% de diferencia)
        if (p1 > 0 && p2 > 0) {
          const maxP = Math.max(p1, p2);
          const minP = Math.min(p1, p2);
          const diffRatio = (maxP - minP) / maxP;
          if (diffRatio > 0.5) {
            unificar = false;
            razon += ` ⚠️ DIFERENCIA DE PRECIO SIGNIFICATIVA (${p1.toLocaleString()} GS vs ${p2.toLocaleString()} GS).`;
          }
        }
        
        propuesta.push({
          unificar,
          score: parseFloat(bestScore.toFixed(3)),
          nuevo_producto: {
            id: np.id,
            codigo: np.codigo,
            nombre: np.nombre,
            precio: p1,
            tipo_inventario: np.tipo_inventario
          },
          producto_existente: {
            id: bestMatch.id,
            codigo: bestMatch.codigo,
            nombre: bestMatch.nombre,
            precio: p2,
            tipo_inventario: bestMatch.tipo_inventario
          },
          razon
        });
      }
    }
    
    // Ordenar por score descendente
    propuesta.sort((a, b) => b.score - a.score);
    
    const outputPath = path.join(__dirname, 'propuesta_unificacion.json');
    fs.writeFileSync(outputPath, JSON.stringify(propuesta, null, 2), 'utf8');
    
    console.log(`\n✅ Propuesta generada y guardada en: ${outputPath}`);
    console.log(`📝 Total propuestas sugeridas: ${propuesta.length}`);
    console.log(`👍 Pre-aprobadas para unificación ("unificar": true): ${propuesta.filter(p => p.unificar).length}`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
