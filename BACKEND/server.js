// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const scoreRoutes = require('./ROUTES/scoreRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares base
app.use(cors());
app.use(express.json());

// 2. RUTAS DE LA API (Deben definirse ANTES de los estáticos)
app.use('/api', scoreRoutes);

// 3. Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// 4. Servir frontend como estático (DESPUÉS de las rutas de la API)
app.use(express.static(path.join(__dirname, '../frontend')));

app.listen(PORT, () => {
  console.log(`[Neon Siege Server] Servidor activo en http://localhost:${PORT}`);
});