/**
 * AppError.js - Clase de error personalizada para errores operacionales
 */
class AppError extends Error {
  constructor(message, errorCode = 'APP_ERROR', statusCode = 400) {
    super(message);
    this.errorCode  = errorCode;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

module.exports = AppError;