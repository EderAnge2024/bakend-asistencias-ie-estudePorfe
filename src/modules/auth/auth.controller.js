const svc = require('./auth.service');
const { ok } = require('../../shared/utils/response');

const login = async (req, res, next) => {
  try {
    const { dni, password } = req.body;
    const data = await svc.login(dni, password);
    ok(res, data, 'Autenticacion exitosa.');
  } catch (e) {
    next(e);
  }
};

module.exports = { login };