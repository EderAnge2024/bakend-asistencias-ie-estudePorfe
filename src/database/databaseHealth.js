/**
 * databaseHealth.js
 * Inicializacion de BD con reintentos y backoff exponencial.
 * Se llama automaticamente al arrancar el backend.
 */

const db = require('../config/database');
const { runMigrations } = require('./migrationRunner');

async function connectWithBackoff(maxRetries = 5, initialDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DB] Conectando a PostgreSQL (intento ${attempt}/${maxRetries})...`);
      const client = await db.getClient();
      await client.query('SELECT 1');
      client.release();
      console.log('[DB] Conexion establecida exitosamente.');
      return;
    } catch (err) {
      console.warn(`[DB] Fallo en intento ${attempt}: ${err.message}`);
      if (attempt < maxRetries) {
        const delay = initialDelay * attempt;
        console.log(`[DB] Reintentando en ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw new Error(`[DB] No se pudo conectar tras ${maxRetries} intentos.`);
}

async function initDatabase() {
  try {
    await connectWithBackoff(5, 2000);
    await runMigrations();
  } catch (error) {
    console.error('[DB] ERROR FATAL al inicializar la BD:', error.message);
    process.exit(1);
  }
}

module.exports = { initDatabase };