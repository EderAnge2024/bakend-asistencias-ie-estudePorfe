const svc = require('./service');
const { ok, created } = require('../../shared/utils/response');
const registrarQR       = async (req,res,next) => { try { created(res, await svc.registrarPorQR(req.user, req.body), 'Asistencia QR registrada.'); } catch(e){next(e);} };
const registrarManual   = async (req,res,next) => { try { created(res, await svc.registrarManual(req.user, req.body), 'Asistencia manual registrada.'); } catch(e){next(e);} };
const salida            = async (req,res,next) => { try { ok(res, await svc.registrarSalida(req.user, req.params.id_estudiante), 'Salida registrada.'); } catch(e){next(e);} };
const porEstudiante     = async (req,res,next) => { try { ok(res, await svc.consultarPorEstudiante(req.params.id_estudiante, req.query)); } catch(e){next(e);} };
const porInstitucion    = async (req,res,next) => { try { ok(res, await svc.consultarInstitucion(req.user.id_institucion, req.query)); } catch(e){next(e);} };
const resumen           = async (req,res,next) => { try { ok(res, await svc.resumen(req.user.id_institucion, req.query), 'Resumen.'); } catch(e){next(e);} };
module.exports = { registrarQR, registrarManual, salida, porEstudiante, porInstitucion, resumen };