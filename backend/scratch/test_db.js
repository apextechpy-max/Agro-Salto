const Database = require('better-sqlite3');
const db = new Database('./data/agrosalto.db');

try {
  // Test create internacion
  const result = db.prepare(`INSERT INTO internacion (consulta_id, mascota_id, estado, observaciones) 
                             VALUES (?, ?, 'ACTIVA', ?)`).run(1, 1, 'Test internacion');
  console.log('Internacion created:', result.lastInsertRowid);
  
  // Test add constante
  db.prepare(`INSERT INTO constantes_vitales (internacion_id, temperatura, frecuencia_card, frecuencia_resp, peso_kg, observacion, usuario_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)`).run(result.lastInsertRowid, 38.5, 80, 20, 10.5, 'Test obs', 1);
  console.log('Constante added');
  
  // Test get internaciones
  const rows = db.prepare(`SELECT i.*, m.nombre as mascota_nombre, m.especie, p.razon_social as dueno_nombre
                          FROM internacion i
                          JOIN mascotas m ON m.id = i.mascota_id
                          JOIN personas p ON p.id = m.persona_id
                          WHERE i.estado = 'ACTIVA'`).all();
  console.log('Active internaciones:', rows.length);
  
  // Cleanup test data if needed, or just leave it for now
} catch (e) {
  console.error('Test failed:', e.message);
}
