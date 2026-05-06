const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Permitir CORS en producción
app.use(cors());
app.use(express.json());

// Init DB
require('./db');

// Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/usuarios',   require('./routes/usuarios'));
app.use('/api/filiales',   require('./routes/filiales'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/productos',  require('./routes/productos'));
app.use('/api/personas',   require('./routes/personas'));
app.use('/api/stock',      require('./routes/stock'));
app.use('/api/compras',    require('./routes/compras'));
app.use('/api/ventas',     require('./routes/ventas'));
app.use('/api/caja',       require('./routes/caja'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/reportes',   require('./routes/reportes'));

// ── MÓDULO VETERINARIO (VMS) ──────────────────────────────
app.use('/api/mascotas',   require('./routes/mascotas'));
app.use('/api/clinica',    require('./routes/clinica'));
app.use('/api/agenda',     require('./routes/agenda'));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date(), env: 'production' }));

// Para despliegue local
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🌿 ERP Agro Salto — Backend corriendo en http://localhost:${PORT}`);
  });
}

// Exportar para Vercel
module.exports = app;
