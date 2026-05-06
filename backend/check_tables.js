const db = require('./src/db');
console.log("ventas:", db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ventas'").get());
console.log("ventas_detalle:", db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ventas_detalle'").get());
