const svc = require('./matriculas.service');
const { ok, created } = require('../../shared/utils/response');
const listar        = async (req,res,next) => { try { ok(res, await svc.listar(req.user.id_institucion, req.query)); } catch(e){next(e);} };
const obtener       = async (req,res,next) => { try { ok(res, await svc.obtener(req.user.id_institucion, req.params.id)); } catch(e){next(e);} };
const crear         = async (req,res,next) => { try { created(res, await svc.crear(req.user.id_institucion, req.body), 'Matricula creada.'); } catch(e){next(e);} };
const actualizar    = async (req,res,next) => { try { ok(res, await svc.actualizar(req.user.id_institucion, req.params.id, req.body)); } catch(e){next(e);} };
const matriculaActiva = async (req,res,next) => { try { ok(res, await svc.matriculaActiva(req.user.id_institucion, req.params.id_estudiante)); } catch(e){next(e);} };
module.exports = { listar, obtener, crear, actualizar, matriculaActiva };