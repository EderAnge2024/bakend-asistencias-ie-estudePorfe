const service = require('./horarios.service');
const { ok, created } = require('../../shared/utils/response');

const listar    = async (req, res, next) => { try { ok(res, await service.listar(req.user.id_institucion, req.query.activos), 'Horarios obtenidos.'); } catch(e){next(e);} };
const obtener   = async (req, res, next) => { try { ok(res, await service.obtener(req.user.id_institucion, req.params.id)); } catch(e){next(e);} };
const crear     = async (req, res, next) => { try { created(res, await service.crear(req.user.id_institucion, req.body), 'Horario creado.'); } catch(e){next(e);} };
const actualizar= async (req, res, next) => { try { ok(res, await service.actualizar(req.user.id_institucion, req.params.id, req.body), 'Horario actualizado.'); } catch(e){next(e);} };
const desactivar= async (req, res, next) => { try { ok(res, await service.desactivar(req.user.id_institucion, req.params.id), 'Horario desactivado.'); } catch(e){next(e);} };

module.exports = { listar, obtener, crear, actualizar, desactivar };