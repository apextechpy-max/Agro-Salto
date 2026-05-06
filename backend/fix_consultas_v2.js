const db = require('./src/db');

try {
  console.log("Corrigiendo referencias en la tabla 'consultas' (sin PRAGMA dentro de transacción)...");
  
  // PRAGMA foreign_keys debe ejecutarse FUERA de una transacción en muchas versiones de better-sqlite3
  db.prepare('PRAGMA foreign_keys = OFF').run();

  db.transaction(() => {
    // 1. Renombrar
    db.prepare('ALTER TABLE consultas RENAME TO consultas_old').run();
    
    // 2. Crear la nueva tabla
    db.prepare(`
      CREATE TABLE consultas (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        mascota_id      INTEGER NOT NULL REFERENCES mascotas(id),
        veterinario_id  INTEGER REFERENCES usuarios(id),
        tipo_consulta   TEXT DEFAULT 'CONSULTA' CHECK(tipo_consulta IN ('CONSULTA','CIRUGIA','VACUNA','BANO_ESTETICA','CONTROL','EMERGENCIA','OTRO')),
        fecha           TEXT DEFAULT (datetime('now')),
        motivo          TEXT,
        diagnostico     TEXT,
        tratamiento     TEXT,
        peso_kg         REAL,
        temperatura     REAL,
        observaciones   TEXT,
        pre_venta_id    INTEGER REFERENCES ventas(id),
        estado          TEXT DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','EN_CURSO','FINALIZADA','CANCELADA')),
        creado_en       TEXT DEFAULT (datetime('now'))
      )
    `).run();
    
    // 3. Migrar los datos (limpiando pre_venta_id si apunta a algo inexistente)
    db.prepare(`
      INSERT INTO consultas (id, mascota_id, veterinario_id, tipo_consulta, fecha, motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones, pre_venta_id, estado, creado_en)
      SELECT id, mascota_id, veterinario_id, tipo_consulta, fecha, motivo, diagnostico, tratamiento, peso_kg, temperatura, observaciones, 
             CASE WHEN pre_venta_id IN (SELECT id FROM ventas) THEN pre_venta_id ELSE NULL END, 
             estado, creado_en
      FROM consultas_old
    `).run();
    
    // 4. Borrar la tabla temporal
    db.prepare('DROP TABLE consultas_old').run();
  })();
  
  db.prepare('PRAGMA foreign_keys = ON').run();
  
  console.log("Corrección de 'consultas' completada con éxito.");
} catch (e) {
  console.error("Error durante la corrección de 'consultas':", e);
}
