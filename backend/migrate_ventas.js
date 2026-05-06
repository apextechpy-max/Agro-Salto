const db = require('./src/db');

try {
  console.log("Iniciando migración de la tabla ventas...");
  
  db.transaction(() => {
    // 1. Rename existing table
    db.prepare('ALTER TABLE ventas RENAME TO ventas_old').run();
    
    // 2. Create new table with updated CHECK constraint
    db.prepare(`
      CREATE TABLE ventas (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo         TEXT DEFAULT 'MINORISTA' CHECK(tipo IN ('MINORISTA','MAYORISTA','PRESUPUESTO')),
        cliente_id   INTEGER REFERENCES personas(id),
        filial_id    INTEGER REFERENCES filiales(id),
        fecha        TEXT DEFAULT (datetime('now')),
        subtotal     REAL DEFAULT 0,
        descuento    REAL DEFAULT 0,
        iva_5        REAL DEFAULT 0,
        iva_10       REAL DEFAULT 0,
        total        REAL DEFAULT 0,
        tipo_pago    TEXT DEFAULT 'CONTADO' CHECK(tipo_pago IN ('CONTADO','CREDITO','TRANSFERENCIA','MIXTO')),
        monto_pagado REAL DEFAULT 0,
        vuelto       REAL DEFAULT 0,
        estado       TEXT DEFAULT 'COMPLETADA' CHECK(estado IN ('COMPLETADA','ANULADA','PRESUPUESTO','PRE-VENTA')),
        vendedor_id  INTEGER REFERENCES personas(id),
        usuario_id   INTEGER REFERENCES usuarios(id),
        observacion  TEXT
      )
    `).run();
    
    // 3. Copy data
    db.prepare(`
      INSERT INTO ventas (id, tipo, cliente_id, filial_id, fecha, subtotal, descuento, iva_5, iva_10, total, tipo_pago, monto_pagado, vuelto, estado, vendedor_id, usuario_id, observacion)
      SELECT id, tipo, cliente_id, filial_id, fecha, subtotal, descuento, iva_5, iva_10, total, tipo_pago, monto_pagado, vuelto, estado, vendedor_id, usuario_id, observacion
      FROM ventas_old
    `).run();
    
    // 4. Drop old table
    db.prepare('DROP TABLE ventas_old').run();
  })();
  
  console.log("Migración completada exitosamente.");
} catch (e) {
  console.error("Error durante la migración:", e);
}
