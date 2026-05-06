const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'backend/data/agrosalto.db'));

const prods = db.prepare('SELECT id, precio_costo FROM productos').all();
const insL = db.prepare(`INSERT INTO lotes (producto_id,filial_id,numero_lote,fecha_vto,cantidad_ini,cantidad_act,costo_unitario) VALUES (?,?,?,?,?,?,?)`);

db.transaction(() => {
  // Clear existing lotes to avoid duplicates if run multiple times
  db.prepare('DELETE FROM lotes').run();
  
  for (const [i, p] of prods.entries()) {
    const qty1 = Math.floor(Math.random() * 20) + 10;
    const qty2 = Math.floor(Math.random() * 20) + 5;
    
    // Vence pronto (en 15 días)
    const date1 = new Date();
    date1.setDate(date1.getDate() + 15);
    insL.run(p.id, 1, `LOTE-A-${i}`, date1.toISOString().split('T')[0], qty1, qty1, p.precio_costo);

    // Vence más adelante (en 120 días)
    const date2 = new Date();
    date2.setDate(date2.getDate() + 120);
    insL.run(p.id, 1, `LOTE-B-${i}`, date2.toISOString().split('T')[0], qty2, qty2, p.precio_costo);
  }
})();
console.log('Lotes seed executed successfully.');
