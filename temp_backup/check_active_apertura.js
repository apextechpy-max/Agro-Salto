const db = require('./backend/src/db');
try {
  const apertura = db.prepare("SELECT * FROM aperturas_caja WHERE estado='ABIERTA' ORDER BY id DESC LIMIT 1").get();
  console.log("Active Apertura:", JSON.stringify(apertura, null, 2));
} catch (e) {
  console.error("Error fetching aperture:", e);
}
db.close();
