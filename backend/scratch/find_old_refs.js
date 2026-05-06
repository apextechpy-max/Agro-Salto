const Database = require('better-sqlite3');
const db = new Database('./data/agrosalto.db');
const rows = db.prepare("SELECT name, type, sql FROM sqlite_master WHERE sql LIKE '%consultas_old%'").all();
console.log(JSON.stringify(rows, null, 2));
