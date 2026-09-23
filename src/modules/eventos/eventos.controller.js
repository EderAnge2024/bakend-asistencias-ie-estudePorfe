const svc = require('./eventos.service');
const { ok, created } = require('../../shared/utils/response');
const listar      = async (req,res,next) => { try { ok(res, await svc.listar(req.user.id_institucion, req.query)); } catch(e){next(e);} };
const obtener     = async (req,res,next) => { try { ok(res, await svc.obtener(req.user.id_institucion, req.params.id)); } catch(e){next(e);} };
const crear       = async (req,res,next) => { try { created(res, await svc.crear(req.user.id_institucion, req.body), 'Evento creado.'); } catch(e){next(e);} };
const actualizar  = async (req,res,next) => { try { ok(res, await svc.actualizar(req.user.id_institucion, req.params.id, req.body), 'Evento actualizado.'); } catch(e){next(e);} };
const toggleEstado= async (req,res,next) => { try { ok(res, await svc.toggleEstado(req.user.id_institucion, req.params.id, req.body.estado)); } catch(e){next(e);} };
module.exports = { listar, obtener, crear, actualizar, toggleEstado };