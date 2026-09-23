/**
 * migrationRunner.js
 * Sistema de migraciones idempotente - Sistema de Asistencias IE
 *
 * - Lee archivos .sql desde /migrations en orden (001_, 002_, ...)
 * - Registra cada migracion ejecutada en schema_migrations
 * - Omite migraciones ya ejecutadas
 * - Cada migracion corre en transaccion (ACID)
 * - NUNCA hace DROP TABLE ni elimina datos
 */

const fs   = require('fs');
const path = require('path');
const db   = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/** Verifica si el SQL ya contiene su propia transaccion BEGIN/COMMIT */
function sqlHasTransaction(sql) {
  const upper = sql.toUpperCase();
  return upper.includes('BEGIN') && upper.includes('COMMIT');
}

async function runMigrations() {
  const client = await db.getClient();
  try {
    console.log('[Migrations] Iniciando verificacion de esquema de BD...');

    // Crear tabla de control si no existe (idempotente)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(50)  PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        executed_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Obtener versiones ya ejecutadas
    const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version');
    const executed  = new Set(rows.map(r => r.version));

    // Leer y ordenar archivos de migracion
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let applied = 0;

    for (const file of files) {
      const version = file.split('_')[0]; // "001" de "001_initial_schema.sql"

      if (executed.has(version)) {
        console.log(`[Migrations] Ya aplicada: ${file}`);
        continue;
      }

      console.log(`[Migrations] Aplicando: ${file}...`);
      const sql   = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const hasTx = sqlHasTransaction(sql);

      try {
        if (!hasTx) await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
          [version, file]
        );
        if (!hasTx) await client.query('COMMIT');
        console.log(`[Migrations] OK: ${file} aplicada correctamente.`);
        applied++;
      } catch (err) {
        if (!hasTx) await client.query('ROLLBACK');
        console.error(`[Migrations] ERROR aplicando ${file}:`, err.message);
        throw err;
      }
    }

    if (applied === 0) {
      console.log('[Migrations] Sin migraciones pendientes. BD al dia.');
    } else {
      console.log(`[Migrations] ${applied} migracion(es) aplicada(s).`);
    }
    console.log('[Migrations] Esquema sincronizado y listo.');
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };