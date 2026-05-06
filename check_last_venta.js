const db = require('./backend/src/db');
try {
  const venta = db.prepare("SELECT * FROM ventas ORDER BY id DESC LIMIT 1").get();
  console.log("Last Venta:", JSON.stringify(venta, null, 2));
} catch (e) {
  console.error("Error fetching venta:", e);
}
db.close();
