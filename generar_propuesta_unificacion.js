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
  let cleaned = str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[-/.]/g, ' ')          // reemplazar guiones, barras y puntos por espacios
    .replace(/[^a-z0-9\s]/g, '')     // quitar caracteres especiales
    .replace(/\s+/g, ' ')
    .trim();

  // Aplicar equivalencias o sinónimos de productos conocidos
  if (cleaned.includes('afoxopet')) {
    cleaned = cleaned.replace('afoxopet', 'afoxocan');
  }
  if (cleaned.includes('biberon')) {
    cleaned = cleaned.replace('biberon', 'mamadera');
  }
  if (cleaned.includes('xixi')) {
    cleaned = 'kit educador';
  }
  if (cleaned.includes('cepillo con pasta')) {
    cleaned = cleaned.replace('cepillo con pasta dental', 'kit cepillo').replace('cepillo con pasta', 'kit cepillo');
  }
  if (cleaned.includes('bolsa afrecho') || cleaned === 'afrecho bolsa') {
    cleaned = 'afrecho de trigo';
  }
  if (cleaned.includes('analgecin')) {
    cleaned = cleaned.replace('analgecin', 'analgesin');
  }
  if (cleaned.includes('comp canex') || cleaned.includes('canex comp') || cleaned === 'canex 1') {
    cleaned = 'canex original';
  }
  if (cleaned.includes('gaviplen gotas') || cleaned === 'gaviplen gotas') {
    cleaned = 'gasiplen oral 20 ml';
  } else if (cleaned.includes('gaviplen')) {
    cleaned = cleaned.replace('gaviplen', 'gasiplen');
  }

  return cleaned;
}

function wordsMatch(w1, w2) {
  if (w1 === w2) return true;
  const len1 = w1.length;
  const len2 = w2.length;
  if (Math.min(len1, len2) >= 4 && (w1.startsWith(w2) || w2.startsWith(w1))) return true;
  if (Math.abs(len1 - len2) > 1) return false;
  const dist = levenshtein(w1, w2);
  if (dist <= 1 && Math.min(len1, len2) >= 4) return true;
  return false;
}

// Similitud de Jaccard basada en palabras con coincidencia difusa (Fuzzy Jaccard)
function fuzzyJaccardSimilarity(str1, str2) {
  const stopWords = ['de', 'para', 'con', 'kg', 'ml', 'la', 'el', 'un', 'x', 'y', 'del', 'los', 'las'];
  const words1 = cleanString(str1).split(' ').filter(w => w.length > 1 && !stopWords.includes(w) && !/^\d+$/.test(w));
  const words2 = cleanString(str2).split(' ').filter(w => w.length > 1 && !stopWords.includes(w) && !/^\d+$/.test(w));
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  let intersectionCount = 0;
  const matched2 = new Set();
  
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (!matched2.has(w2) && wordsMatch(w1, w2)) {
        intersectionCount++;
        matched2.add(w2);
        break;
      }
    }
  }
  
  const unionCount = words1.length + words2.length - intersectionCount;
  return intersectionCount / unionCount;
}

// Obtener puntaje de similitud combinando Levenshtein y Fuzzy Jaccard
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
  
  const jaccard = fuzzyJaccardSimilarity(name1, name2);
  
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

// Verificar si hay conflicto de números (ej. AFOXOCAN 4-10 tiene max 10 y AFOXOCAN 2 A 4 KG tiene max 4)
function hasNumberConflict(name1, name2) {
  const getNumbers = (str) => {
    const regex = /\b\d+(?:[.,]\d+)?\b|\d+(?=[a-zA-Z])/g;
    const nums = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
      const val = parseFloat(match[0].replace(',', '.'));
      if (!isNaN(val)) nums.push(val);
    }
    return nums;
  };
  
  const n1 = getNumbers(name1);
  const n2 = getNumbers(name2);
  
  if (n1.length > 0 && n2.length > 0) {
    const max1 = Math.max(...n1);
    const max2 = Math.max(...n2);
    if (max1 !== max2) return true; // Conflicto de dosificación o tamaño máximo
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
      
      const p1 = parseFloat(np.precio_venta_menor) || 0;
      
      for (const ep of existingProducts) {
        if (ep.codigo === 'PRD-COMPRA-HISTORICA' || ep.codigo === 'PRD-HISTORICO') continue;
        
        const score = getSimilarityScore(np.nombre, ep.nombre);
        if (score < 0.45) continue; // Umbral mínimo de similitud
        
        const p2 = parseFloat(ep.precio_venta_menor) || 0;
        let conflict = false;
        let razon = `Similitud de nombre del ${(score * 100).toFixed(0)}%.`;
        
        // 1. Filtrar por conflicto de medidas o números (ej: 2kg vs 25kg, 4-10 vs 2-4)
        if (hasMeasureConflict(np.nombre, ep.nombre) || hasNumberConflict(np.nombre, ep.nombre)) {
          conflict = true;
          razon += ' ⚠️ CONFLICTO DE MEDIDA O DOSIS (ej: 2kg vs 25kg, 4-10 vs 2-4).';
        }
        
        // 2. Filtrar por diferencia de precio significativa (más del 25% de diferencia)
        if (p1 > 0 && p2 > 0) {
          const maxP = Math.max(p1, p2);
          const minP = Math.min(p1, p2);
          const diffRatio = (maxP - minP) / maxP;
          if (diffRatio > 0.25) {
            conflict = true;
            razon += ` ⚠️ DIFERENCIA DE PRECIO SIGNIFICATIVA (${p1.toLocaleString()} GS vs ${p2.toLocaleString()} GS).`;
          }
        }
        
        // 3. Filtrar si no hay coincidencia de palabras significativas en absoluto
        const c1 = cleanString(np.nombre);
        const c2 = cleanString(ep.nombre);
        const jaccard = fuzzyJaccardSimilarity(np.nombre, ep.nombre);
        const maxLen = Math.max(c1.length, c2.length);
        const levDist = levenshtein(c1, c2);
        const levRatio = maxLen > 0 ? (maxLen - levDist) / maxLen : 0;
        
        if (jaccard === 0 && levRatio < 0.80) {
          conflict = true;
          razon += ' ⚠️ Cero coincidencia de palabras significativas.';
        }
        
        // Heurística de selección: preferir no-conflicto sobre conflicto, y a igualdad de estado, mayor similitud
        let isBetter = false;
        if (bestMatch === null) {
          isBetter = true;
        } else if (!conflict && bestMatch.conflict) {
          isBetter = true;
        } else if (conflict === bestMatch.conflict) {
          isBetter = score > bestScore;
        }
        
        if (isBetter) {
          bestScore = score;
          bestMatch = {
            id: ep.id,
            codigo: ep.codigo,
            nombre: ep.nombre,
            precio: p2,
            tipo_inventario: ep.tipo_inventario,
            conflict,
            reason: razon
          };
        }
      }
      
      if (bestMatch !== null) {
        propuesta.push({
          unificar: !bestMatch.conflict && bestScore >= 0.50,
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
            precio: bestMatch.precio,
            tipo_inventario: bestMatch.tipo_inventario
          },
          razon: bestMatch.reason
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
