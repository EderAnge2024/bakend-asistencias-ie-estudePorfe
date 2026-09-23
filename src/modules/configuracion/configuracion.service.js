const repo = require('./configuracion.repository');
const AppError = require('../../shared/errors/AppError');

const obtener = async (id_institucion) => {
  const c = await repo.findByInstitucion(id_institucion);
  if (!c) throw new AppError('La institucion no tiene configuracion registrada.','CONFIG_NOT_FOUND',404);
  return c;
};
const crear = async (id_institucion, d) => {
  if (!d.latitud_ie||!d.longitud_ie) throw new AppError('Latitud y longitud son obligatorias.','MISSING_COORDINATES');
  if (!d.radio_permitido_metros||d.radio_permitido_metros<10) throw new AppError('Radio minimo 10 metros.','INVALID_RADIUS');
  return repo.create({...d, id_institucion});
};
const actualizar = async (id_institucion, id, d) => {
  const c = await repo.findById(id);
  if (!c) throw new AppError('Configuracion no encontrada.','CONFIG_NOT_FOUND',404);
  if (String(c.id_institucion)!==String(id_institucion)) throw new AppError('Sin permisos.','FORBIDDEN',403);
  return repo.update(id, d);
};
const toggleEstado = async (id_institucion, id, estado) => {
  const c = await repo.findById(id);
  if (!c) throw new AppError('Configuracion no encontrada.','CONFIG_NOT_FOUND',404);
  if (String(c.id_institucion)!==String(id_institucion)) throw new AppError('Sin permisos.','FORBIDDEN',403);
  return repo.toggleEstado(id, estado);
};
module.exports = { obtener, crear, actualizar, toggleEstado };