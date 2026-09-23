/**
 * errorHandler.js - Middleware global de manejo de errores
 */
const AppError = require('../errors/AppError');

function errorHandler(err, req, res, next) {
  // Error de violacion UNIQUE de PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un registro con estos datos.',
      error: 'DUPLICATE_RECORD'
    });
  }

  // Error de FK violada
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referencia a un recurso que no existe.',
      error: 'FOREIGN_KEY_VIOLATION'
    });
  }

  // Error operacional conocido
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      error: err.errorCode || 'APP_ERROR'
    });
  }

  // Error desconocido: NO exponer detalles al cliente
  console.error('[ErrorHandler] Error no controlado:', err);
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor.',
    error: 'INTERNAL_ERROR'
  });
}

module.exports = errorHandler;