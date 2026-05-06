const db = require('./src/db');

try {
  console.log("Corrigiendo referencias de ventas_detalle...");
  
  db.transaction(() => {
    // 1. Desactivar llaves foráneas temporalmente para poder manipular las tablas
    db.prepare('PRAGMA foreign_keys = OFF').run();

    // 2. Renombrar la tabla de detalle actual (que apunta a ventas_old)
    db.prepare('ALTER TABLE ventas_detalle RENAME TO ventas_detalle_old').run();
    
    // 3. Crear la nueva tabla de detalle apuntando correctamente a 'ventas'
    db.prepare(`
      CREATE TABLE ventas_detalle (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id    INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id),
        cantidad    REAL,
        precio_unit REAL,
        iva_tipo    TEXT,
        descuento   REAL DEFAULT 0,
        subtotal    REAL,
        lote_id     INTEGER REFERENCES lotes(id)
      )
    `).run();
    
    // 4. Migrar los datos
    db.prepare(`
      INSERT INTO ventas_detalle (id, venta_id, producto_id, cantidad, precio_unit, iva_tipo, descuento, subtotal, lote_id)
      SELECT id, venta_id, producto_id, cantidad, precio_unit, iva_tipo, descuento, subtotal, lote_id
      FROM ventas_detalle_old
    `).run();
    
    // 5. Borrar la tabla temporal
    db.prepare('DROP TABLE ventas_detalle_old').run();

    // 6. Reactivar llaves foráneas
    db.prepare('PRAGMA foreign_keys = ON').run();
  })();
  
  console.log("Corrección completada con éxito. Las referencias ahora apuntan a 'ventas'.");
} catch (e) {
  console.error("Error durante la corrección:", e);
}
