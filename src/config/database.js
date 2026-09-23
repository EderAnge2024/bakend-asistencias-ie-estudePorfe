const { Pool } = require('pg');
const env = require('./env');

let pool;

if (process.env.DATABASE_URL_ASISTENCIAS) {
  const connStr = process.env.DATABASE_URL_ASISTENCIAS.replace("?sslmode=require", "");
  pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
} else {
  pool = new Pool({
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
  });
}

pool.on('error', (err) => {
  console.error('[DB] Error en el pool de la BD local/asistencias:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
