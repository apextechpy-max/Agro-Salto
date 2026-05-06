const db = require('./src/db');
console.log("consultas:", db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='consultas'").get());
