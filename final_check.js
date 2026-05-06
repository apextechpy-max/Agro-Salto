const db = require('./backend/src/db');
try {
  const mov = db.prepare("SELECT * FROM movimientos_caja ORDER BY id DESC LIMIT 2").all();
  console.log("Last 2 Movimientos Caja:", JSON.stringify(mov, null, 2));
  const venta = db.prepare("SELECT * FROM ventas ORDER BY id DESC LIMIT 1").get();
  console.log("Last Venta:", JSON.stringify(venta, null, 2));
} catch (e) {
  console.error("Error:", e);
}
db.close();
