const db = require('./src/db');

// Busca o crea a Firulais
let firulais = db.prepare("SELECT id FROM mascotas WHERE nombre LIKE '%Firulais%' LIMIT 1").get();
if (!firulais) {
  const cliente = db.prepare('SELECT id FROM personas WHERE tipo="CLIENTE" LIMIT 1').get() || { id: 1 };
  const r = db.prepare(`INSERT INTO mascotas (persona_id, nombre, especie, sexo, activa) VALUES (?, 'Firulais', 'Perro', 'MACHO', 1)`).run(cliente.id);
  firulais = { id: r.lastInsertRowid };
}

// Asegurarse de tener una consulta para Firulais
let consulta = db.prepare('SELECT id FROM consultas WHERE mascota_id=? LIMIT 1').get(firulais.id);
if (!consulta) {
  const r = db.prepare(`INSERT INTO consultas (mascota_id, tipo_consulta, diagnostico, tratamiento) VALUES (?, 'CONSULTA', 'Otitis leve', 'Limpieza y antibiótico')`).run(firulais.id);
  consulta = { id: r.lastInsertRowid };
}

// Crear recetas para esa consulta
db.prepare(`INSERT INTO recetas (consulta_id, mascota_id, indicaciones) VALUES (?, ?, 'Aplicar gotas cada 8 horas')`).run(consulta.id, firulais.id);
const receta = db.prepare('SELECT id FROM recetas WHERE consulta_id=? LIMIT 1').get(consulta.id);
db.prepare(`INSERT INTO recetas_detalle (receta_id, descripcion, cantidad, posologia) VALUES (?, 'Gotas Óticas', 1, '2 gotas c/ 8 hrs')`).run(receta.id);

// Crear un estudio (PDF de prueba)
db.prepare(`INSERT INTO estudios_adjuntos (consulta_id, nombre, tipo_archivo, url_path, descripcion, subido_por) 
            VALUES (?, 'Radiografía Torax', 'application/pdf', '/uploads/demo-pdf.pdf', 'Descartar neumonía', 1)`).run(consulta.id);

// Crear otro estudio de sangre
db.prepare(`INSERT INTO estudios_adjuntos (consulta_id, nombre, tipo_archivo, url_path, descripcion, subido_por) 
            VALUES (?, 'Hemograma Completo', 'application/pdf', '/uploads/demo-pdf2.pdf', 'Valores de referencia estables', 1)`).run(consulta.id);

console.log('Datos de prueba para Firulais creados con éxito!');
