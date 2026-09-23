// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const scoreRoutes = require('/routes/scoreRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir frontend como estático
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas de API
app.use('/api', scoreRoutes);

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`[Neon Siege Server] Servidor activo en http://localhost:${PORT}`);
});