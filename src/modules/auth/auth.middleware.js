/**
 * auth.middleware.js
 * Valida el JWT emitido por el sistema de monitoreo.
 * Extrae id_usuario, id_docente, id_institucion, rol y los pone en req.user.
 * NO implementa login. NO crea usuarios.
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/security');
const { unauthorized } = require('../../shared/utils/response');

function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Token de autenticacion requerido.', 'TOKEN_MISSING');
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // El JWT del sistema de monitoreo debe contener estos campos
    req.user = {
      id_usuario    : payload.id_usuario    || payload.id,
      id_docente    : payload.id_docente,
      id_institucion: payload.id_institucion,
      nombres       : payload.nombres,
      apellidos     : payload.apellidos,
      dni           : payload.dni,
      rol           : payload.rol           || payload.role,
      nivel         : payload.nivel,
      grado         : payload.grado,
      seccion       : payload.seccion,
      tutor         : payload.tutor,
      grado_tutoria : payload.grado_tutoria
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expirado. Inicie sesion nuevamente.', 'TOKEN_EXPIRED');
    }
    return unauthorized(res, 'Token invalido.', 'TOKEN_INVALID');
  }
}

module.exports = { autenticar };
