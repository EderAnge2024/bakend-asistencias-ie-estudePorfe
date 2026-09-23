const { Pool } = require('pg');
require('dotenv').config();

// Extraemos el string eliminando opciones que causen conflicto con el SSL estandar de Node
const connStr = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace("?sslmode=require", "") : null;

if (!connStr) {
  console.warn('[DB_MONITOREO] ADVERTENCIA: DATABASE_URL no esta definida en .env');
}

const pool = new Pool({
  connectionString: connStr,
  // Necesario para Aiven / conexiones externas seguras
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB_MONITOREO] Error en el pool de conexiones de la BD externa', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params)
};