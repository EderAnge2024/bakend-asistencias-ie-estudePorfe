const { Pool } = require('pg');
require('dotenv').config();

// Extraemos el string eliminando opciones que causen conflicto con el SSL estandar de Node
const rawUrl = process.env.DATABASE_URL_MONITOREO || process.env.DATABASE_URL || process.env.DATABASE_URL_ASISTENCIAS;
const connStr = rawUrl ? rawUrl.split('?')[0] : null;

if (!connStr) {
  console.warn('[DB_MONITOREO] ADVERTENCIA: Ni DATABASE_URL_MONITOREO ni DATABASE_URL estan definidas en las variables de entorno');
}

const pool = new Pool({
  connectionString: connStr,
  // Necesario para Aiven / conexiones externas seguras
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB_MONITOREO] Error en el pool de conexiones de la BD externa:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params)
};