const Database = require('better-sqlite3');
const db = new Database('./data/agrosalto.db');

try {
  db.transaction(() => {
    // 1. Fix 'internacion'
    console.log('Fixing internacion...');
    db.prepare('ALTER TABLE internacion RENAME TO internacion_temp').run();
    db.prepare(`CREATE TABLE internacion (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      consulta_id     INTEGER NOT NULL REFERENCES consultas(id),
      mascota_id      INTEGER NOT NULL REFERENCES mascotas(id),
      fecha_ingreso   TEXT DEFAULT (datetime('now')),
      fecha_egreso    TEXT,
      constantes      TEXT,
      observaciones   TEXT,
      estado          TEXT DEFAULT 'ACTIVA'
    )`).run();
    db.prepare('INSERT INTO internacion SELECT * FROM internacion_temp').run();
    db.prepare('DROP TABLE internacion_temp').run();

    // 2. Fix 'estudios_adjuntos'
    console.log('Fixing estudios_adjuntos...');
    db.prepare('ALTER TABLE estudios_adjuntos RENAME TO estudios_adjuntos_temp').run();
    db.prepare(`CREATE TABLE estudios_adjuntos (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      consulta_id  INTEGER NOT NULL REFERENCES consultas(id),
      nombre       TEXT NOT NULL,
      tipo_archivo TEXT,
      url_path     TEXT NOT NULL,
      descripcion  TEXT,
      subido_por   INTEGER,
      subido_en    TEXT DEFAULT (datetime('now'))
    )`).run();
    db.prepare('INSERT INTO estudios_adjuntos SELECT * FROM estudios_adjuntos_temp').run();
    db.prepare('DROP TABLE estudios_adjuntos_temp').run();

    // 3. Fix 'agenda'
    console.log('Fixing agenda...');
    db.prepare('ALTER TABLE agenda RENAME TO agenda_temp').run();
    db.prepare(`CREATE TABLE agenda (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      mascota_id     INTEGER REFERENCES mascotas(id),
      persona_id     INTEGER REFERENCES personas(id),
      titulo         TEXT NOT NULL,
      tipo_evento    TEXT DEFAULT 'CONSULTA',
      fecha_inicio   TEXT NOT NULL,
      fecha_fin      TEXT,
      color          TEXT DEFAULT '#4CAF50',
      veterinario_id INTEGER REFERENCES usuarios(id),
      estado         TEXT DEFAULT 'PROGRAMADO',
      notas          TEXT,
      notificado_wa  INTEGER DEFAULT 0,
      consulta_id    INTEGER REFERENCES consultas(id),
      creado_en      TEXT DEFAULT (datetime('now'))
    )`).run();
    db.prepare(`INSERT INTO agenda SELECT * FROM agenda_temp`).run();
    db.prepare('DROP TABLE agenda_temp').run();

    console.log('✅ Schema repair completed successfully.');
  })();
} catch (e) {
  console.error('❌ Schema repair failed:', e.message);
}
