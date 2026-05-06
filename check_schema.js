const db = require('./backend/src/db');
try {
  const info = db.prepare("PRAGMA table_info(ventas)").all();
  console.log("Columns in 'ventas' table:");
  info.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (e) {
  console.error("Error checking schema:", e);
}
db.close();
