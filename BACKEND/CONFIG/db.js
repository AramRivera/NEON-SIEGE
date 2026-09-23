// backend/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'neon_siege_db',
  max: 20, // Máximo de conexiones simultáneas en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('connect', () => {
  console.log('[PostgreSQL] Conectado exitosamente al pool.');
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Error inesperado]:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};