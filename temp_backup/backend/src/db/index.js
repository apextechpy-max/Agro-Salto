const Database = require('better-sqlite3');
const path = require('path');

// Ruta a la base de datos local
const dbPath = path.join(__dirname, '../../data/agrosalto.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('✅ Base de Datos SQLite conectada en:', dbPath);

module.exports = db;

