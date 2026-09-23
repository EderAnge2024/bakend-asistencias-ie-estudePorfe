const repo = require('./horarios.repository');
const AppError = require('../../shared/errors/AppError');

const DIAS_VALIDOS = [1,2,3,4,5,6,7];

const listar = async (id_institucion, soloActivos) => repo.findAll(id_institucion, soloActivos !== 'false');

const obtener = async (id_institucion, id) => {
  const h = await repo.findById(id);
  if (!h) throw new AppError('Horario no encontrado.', 'NOT_FOUND', 404);
  if (String(h.id_institucion) !== String(id_institucion))
    throw new AppError('No pertenece a su institucion.', 'FORBIDDEN', 403);
  return h;
};

const crear = async (id_institucion, datos) => {
  const { dia_semana, hora_inicio, hora_fin } = datos;
  if (!DIAS_VALIDOS.includes(Number(dia_semana)))
    throw new AppError('dia_semana debe ser 1 (Lunes) a 7 (Domingo).', 'INVALID_DAY');
  if (!hora_inicio || !hora_fin)
    throw new AppError('hora_inicio y hora_fin son obligatorias.', 'MISSING_TIMES');
  if (hora_fin <= hora_inicio)
    throw new AppError('hora_fin debe ser mayor que hora_inicio.', 'INVALID_TIME_RANGE');
  return repo.create({ ...datos, id_institucion });
};

const actualizar = async (id_institucion, id, datos) => {
  const h = await repo.findById(id);
  if (!h) throw new AppError('Horario no encontrado.', 'NOT_FOUND', 404);
  if (String(h.id_institucion) !== String(id_institucion))
    throw new AppError('No pertenece a su institucion.', 'FORBIDDEN', 403);
  if (datos.dia_semana && !DIAS_VALIDOS.includes(Number(datos.dia_semana)))
    throw new AppError('dia_semana invalido.', 'INVALID_DAY');
  return repo.update(id, datos);
};

const desactivar = async (id_institucion, id) => {
  const h = await repo.findById(id);
  if (!h) throw new AppError('Horario no encontrado.', 'NOT_FOUND', 404);
  if (String(h.id_institucion) !== String(id_institucion))
    throw new AppError('No pertenece a su institucion.', 'FORBIDDEN', 403);
  return repo.desactivar(id);
};

module.exports = { listar, obtener, crear, actualizar, desactivar };