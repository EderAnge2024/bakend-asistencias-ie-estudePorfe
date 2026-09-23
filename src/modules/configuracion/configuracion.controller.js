const svc = require('./configuracion.service');
const { ok, created, badRequest } = require('../../shared/utils/response');
const obtener     = async (req,res,next) => { try { ok(res, await svc.obtener(req.user.id_institucion), 'Configuracion obtenida.'); } catch(e){next(e);} };
const crear       = async (req,res,next) => { try { created(res, await svc.crear(req.user.id_institucion, req.body), 'Configuracion creada.'); } catch(e){next(e);} };
const actualizar  = async (req,res,next) => { try { ok(res, await svc.actualizar(req.user.id_institucion, req.params.id, req.body), 'Actualizado.'); } catch(e){next(e);} };
const toggleEstado= async (req,res,next) => {
  try {
    if (typeof req.body.estado !== 'boolean') return badRequest(res,'El campo estado debe ser boolean.','INVALID_ESTADO');
    ok(res, await svc.toggleEstado(req.user.id_institucion, req.params.id, req.body.estado), 'Estado actualizado.');
  } catch(e){next(e);}
};
module.exports = { obtener, crear, actualizar, toggleEstado };