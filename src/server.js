/**
 * server.js - Punto de entrada del backend
 * Sistema de Asistencias IE
 *
 * Secuencia:
 *  1. Inicializa BD (conexion + migraciones idempotentes)
 *  2. Levanta servidor HTTP
 */

const env              = require('./config/env');
const app              = require('./app');
const { initDatabase } = require('./database/databaseHealth');

async function startServer() {
  await initDatabase();
  const PORT = env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[Server] Sistema de Asistencias IE en puerto ${PORT}`);
    console.log(`[Server] Health: http://localhost:${PORT}/health`);
  });
}

startServer();