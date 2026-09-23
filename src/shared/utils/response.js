/**
 * response.js - Helpers para respuestas JSON estandar
 */
const ok = (res, data = {}, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const created = (res, data = {}, message = 'Creado correctamente') =>
  res.status(201).json({ success: true, message, data });

const error = (res, message = 'Error interno', errorCode = 'INTERNAL_ERROR', statusCode = 500) =>
  res.status(statusCode).json({ success: false, message, error: errorCode });

const badRequest = (res, message = 'Solicitud invalida', errorCode = 'BAD_REQUEST') =>
  error(res, message, errorCode, 400);

const unauthorized = (res, message = 'No autorizado', errorCode = 'UNAUTHORIZED') =>
  error(res, message, errorCode, 401);

const forbidden = (res, message = 'Acceso denegado', errorCode = 'FORBIDDEN') =>
  error(res, message, errorCode, 403);

const notFound = (res, message = 'Recurso no encontrado', errorCode = 'NOT_FOUND') =>
  error(res, message, errorCode, 404);

const conflict = (res, message = 'Conflicto con datos existentes', errorCode = 'CONFLICT') =>
  error(res, message, errorCode, 409);

module.exports = { ok, created, error, badRequest, unauthorized, forbidden, notFound, conflict };