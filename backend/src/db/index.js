const { Pool } = require('pg');

// La URL de conexión se obtiene de las variables de entorno
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ DATABASE_URL no está definida en las variables de entorno.');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Requerido para Supabase y entornos en la nube
  }
});

// Helper para facilitar la transición desde better-sqlite3
// Nos permite usar db.query(sql, params)
const db = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};

console.log('🐘 Conexión a PostgreSQL (Supabase) inicializada');

module.exports = db;
