const svc = require('./qr.service');
const { ok, created } = require('../../shared/utils/response');

const consultar = async (req, res, next) => {
  try {
    ok(res, await svc.consultar(req.params.id_estudiante));
  } catch (e) {
    next(e);
  }
};

const generar = async (req, res, next) => {
  try {
    const id_estudiante = req.params.id_estudiante || req.body.id_estudiante;
    created(res, await svc.generar(id_estudiante, req.body.dias_validez), 'QR generado.');
  } catch (e) {
    next(e);
  }
};

const renovar = async (req, res, next) => {
  try {
    const id_estudiante = req.params.id_estudiante || req.body.id_estudiante;
    ok(res, await svc.renovar(req.params.id, id_estudiante, req.body.dias_validez), 'QR renovado.');
  } catch (e) {
    next(e);
  }
};

const desactivar = async (req, res, next) => {
  try {
    const id = req.params.id || req.params.id_credencial;
    ok(res, await svc.toggleEstado(id), 'QR desactivado.');
  } catch (e) {
    next(e);
  }
};

const validar = async (req, res, next) => {
  try {
    const token = req.params.token || req.body.token_qr || req.body.token;
    ok(res, await svc.validar(token), 'QR válido.');
  } catch (e) {
    next(e);
  }
};

module.exports = { consultar, generar, renovar, desactivar, validar };