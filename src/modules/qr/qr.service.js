const { v4: uuidv4 } = require('uuid');
const repo    = require('./qr.repository');
const estRepo = require('../estudiantes/estudiantes.repository');
const AppError = require('../../shared/errors/AppError');

const consultar = async (id_estudiante) => {
  const activa = await repo.findActivaByEstudiante(id_estudiante);
  if (activa) return activa;
  const lista = await repo.findByEstudiante(id_estudiante);
  return lista[0] || null;
};

const generar = async (id_estudiante, diasValidez) => {
  if (!id_estudiante) throw new AppError('El ID del estudiante es requerido.', 'STUDENT_ID_REQUIRED', 400);
  const est = await estRepo.findById(id_estudiante);
  if (!est) throw new AppError('Estudiante no encontrado.', 'STUDENT_NOT_FOUND', 404);
  if (!est.estado) throw new AppError('El estudiante esta inactivo.', 'STUDENT_INACTIVE', 400);

  // Invalidar credenciales anteriores activas
  await repo.desactivarTodas(id_estudiante);

  // Generar token opaco seguro (UUID v4)
  const token_qr = uuidv4();
  let fecha_expiracion = null;
  if (diasValidez && diasValidez > 0) {
    fecha_expiracion = new Date(Date.now() + diasValidez * 86400000);
  }
  return repo.create({ id_estudiante, token_qr, fecha_expiracion });
};

const renovar = async (id_credencial, id_estudiante, diasValidez) => {
  await repo.desactivarTodas(id_estudiante);
  return generar(id_estudiante, diasValidez);
};

const toggleEstado = async (id) => {
  const cred = await repo.toggleEstado(id, false); // desactivar
  if (!cred) throw new AppError('Credencial no encontrada.', 'NOT_FOUND', 404);
  return cred;
};

const validar = async (token_qr) => {
  if (!token_qr) throw new AppError('El token QR es requerido.', 'TOKEN_REQUIRED', 400);
  const cred = await repo.findByToken(token_qr);
  if (!cred) throw new AppError('QR invalido o no registrado.', 'QR_INVALID', 400);
  if (!cred.estado) throw new AppError('QR desactivado.', 'QR_DISABLED', 400);
  if (cred.fecha_expiracion && new Date() > new Date(cred.fecha_expiracion))
    throw new AppError('QR expirado.', 'QR_EXPIRED', 400);
  if (!cred.est_estudiante) throw new AppError('El estudiante asociado esta inactivo.', 'STUDENT_INACTIVE', 400);
  return cred;
};

module.exports = { consultar, generar, renovar, toggleEstado, validar };