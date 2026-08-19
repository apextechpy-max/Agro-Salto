require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/db');

async function createAdmin() {
  const usuario = 'admin';
  const password = 'admin123';
  const nombre_completo = 'Administrador Principal';
  const perfil = 'ADMIN';
  const password_hash = bcrypt.hashSync(password, 10);

  console.log(`Generando hash para usuario ${usuario}...`);

  try {
    // 1. Asegurar que existe al menos una filial
    let filialRes = await db.query('SELECT id FROM filiales LIMIT 1');
    let filial_id = filialRes.rows[0]?.id;
    if (!filial_id) {
      const nuevaFilial = await db.query("INSERT INTO filiales (nombre, direccion, activa) VALUES ('Casa Central', 'Salto del Guairá', 1) RETURNING id");
      filial_id = nuevaFilial.rows[0].id;
      console.log(`Filial creada con ID: ${filial_id}`);
    }

    // 2. Verificar si el usuario admin ya existe
    const res = await db.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario]);
    if (res.rows.length > 0) {
      await db.query(
        'UPDATE usuarios SET password_hash = $1, nombre_completo = $2, perfil = $3, filial_id = $4, activo = 1 WHERE usuario = $5',
        [password_hash, nombre_completo, perfil, filial_id, usuario]
      );
      console.log(`✅ Usuario '${usuario}' actualizado con éxito con la contraseña '${password}'.`);
    } else {
      await db.query(
        'INSERT INTO usuarios (usuario, password_hash, nombre_completo, perfil, filial_id, activo) VALUES ($1, $2, $3, $4, $5, 1)',
        [usuario, password_hash, nombre_completo, perfil, filial_id]
      );
      console.log(`✅ Usuario '${usuario}' creado con éxito con la contraseña '${password}'.`);
    }

    // 3. Imprimir el hash para que también pueda usarse en migraciones directas SQL
    console.log(`Hash bcrypt generado: ${password_hash}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creando usuario admin:', err.message);
    process.exit(1);
  }
}

createAdmin();
