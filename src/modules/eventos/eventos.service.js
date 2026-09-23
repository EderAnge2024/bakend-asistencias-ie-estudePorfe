const repo = require('./eventos.repository');
const AppError = require('../../shared/errors/AppError');
const TIPOS = ['REUNION','CAPACITACION','ACTIVIDAD','ASAMBLEA','OTRO'];
const ESTADOS = ['ACTIVO','FINALIZADO','CANCELADO'];

const listar  = async (id_institucion, filtros) => repo.findAll({id_institucion, ...filtros});
const obtener = async (id_institucion, id) => {
  const e = await repo.findById(id);
  if (!e) throw new AppError('Evento no encontrado.','NOT_FOUND',404);
  if (String(e.id_institucion)!==String(id_institucion)) throw new AppError('Sin permisos.','FORBIDDEN',403);
  return e;
};
const crear = async (id_institucion, d) => {
  if (!d.titulo||!d.fecha||!d.hora_inicio||!d.hora_fin||!d.tipo_evento)
    throw new AppError('titulo, fecha, hora_inicio, hora_fin y tipo_evento son obligatorios.','MISSING_FIELDS');
  if (!TIPOS.includes(d.tipo_evento)) throw new AppError(`tipo_evento invalido. Use: ${TIPOS.join('|')}.`,'INVALID_TIPO');
  if (d.hora_fin<=d.hora_inicio) throw new AppError('hora_fin debe ser mayor que hora_inicio.','INVALID_TIME');
  return repo.create({...d, id_institucion});
};
const actualizar = async (id_institucion, id, d) => {
  const e = await repo.findById(id);
  if (!e) throw new AppError('Evento no encontrado.','NOT_FOUND',404);
  if (String(e.id_institucion)!==String(id_institucion)) throw new AppError('Sin permisos.','FORBIDDEN',403);
  if (d.tipo_evento && !TIPOS.includes(d.tipo_evento)) throw new AppError('tipo_evento invalido.','INVALID_TIPO');
  return repo.update(id, d);
};
const toggleEstado = async (id_institucion, id, estado) => {
  if (!ESTADOS.includes(estado)) throw new AppError(`Estado invalido. Use: ${ESTADOS.join('|')}.`,'INVALID_ESTADO');
  const e = await repo.findById(id);
  if (!e) throw new AppError('Evento no encontrado.','NOT_FOUND',404);
  if (String(e.id_institucion)!==String(id_institucion)) throw new AppError('Sin permisos.','FORBIDDEN',403);
  return repo.toggleEstado(id, estado);
};
module.exports = { listar, obtener, crear, actualizar, toggleEstado };