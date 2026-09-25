const { Pool } = require('pg');
const env = require('./env');

let pool;

const connectionString = process.env.DATABASE_URL_ASISTENCIAS || process.env.DATABASE_URL;

if (connectionString) {
  // Limpiamos los query parameters para evitar conflictos con ssl personalizado de node-postgres
  const cleanConnectionString = connectionString.split('?')[0];
  pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  const poolConfig = {
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
  };

  // En caso de conectar a host remoto sin connectionString
  if (
    process.env.NODE_ENV === 'production' ||
    (env.DB_HOST && env.DB_HOST !== 'localhost' && env.DB_HOST !== '127.0.0.1')
  ) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  pool = new Pool(poolConfig);
}

pool.on('error', (err) => {
  console.error('[DB] Error en el pool de la BD de asistencias:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
