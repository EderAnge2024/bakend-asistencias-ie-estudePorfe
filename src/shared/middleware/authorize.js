/**
 * authorize.js - Middleware de autorizacion por roles
 * Depende de que req.user ya haya sido poblado por autenticar()
 */
const { forbidden } = require('../utils/response');

/**
 * Genera middleware que permite solo a los roles indicados.
 * @param {...string} roles - Roles permitidos, ej: 'DIRECTOR', 'ADMIN'
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'No autenticado.', 'NOT_AUTHENTICATED');
    }
    const rolUsuario = (req.user.rol || '').toUpperCase();
    const rolesPermitidos = roles.map(r => r.toUpperCase());
    if (!rolesPermitidos.includes(rolUsuario)) {
      return forbidden(res, 'No tiene permisos para esta operacion.', 'INSUFFICIENT_ROLE');
    }
    next();
  };
}

module.exports = { authorize };