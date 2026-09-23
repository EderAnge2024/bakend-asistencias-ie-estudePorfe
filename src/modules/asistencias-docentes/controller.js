const svc = require('./service');
const { ok, created } = require('../../shared/utils/response');

const entrada           = async (req,res,next) => { try { created(res, await svc.registrarEntrada(req.user, req.body), 'Entrada registrada correctamente.'); } catch(e){next(e);} };
const salida            = async (req,res,next) => { try { ok(res, await svc.registrarSalida(req.user, req.body), 'Salida registrada correctamente.'); } catch(e){next(e);} };
const mia               = async (req,res,next) => { try { ok(res, await svc.consultarPropia(req.user, req.query), 'Asistencias obtenidas.'); } catch(e){next(e);} };
const porDocente        = async (req,res,next) => { try { ok(res, await svc.consultarPorDocente(req.user, req.params.id_docente, req.query)); } catch(e){next(e);} };
const porInstitucion    = async (req,res,next) => { try { ok(res, await svc.consultarInstitucion(req.user, req.query)); } catch(e){next(e);} };
const resumen           = async (req,res,next) => { try { ok(res, await svc.resumen(req.user, req.query), 'Resumen de asistencias.'); } catch(e){next(e);} };

module.exports = { entrada, salida, mia, porDocente, porInstitucion, resumen };