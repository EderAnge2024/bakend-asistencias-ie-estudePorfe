/**
 * service.js - Asistencias Estudiantes
 * Registro via QR y manual.
 * La fecha/hora siempre proviene del servidor.
 */
const repo    = require('./repository');
const qrSvc   = require('../qr/qr.service');
const matRepo = require('../matriculas/matriculas.repository');
const confRepo= require('../configuracion/configuracion.repository');
const AppError = require('../../shared/errors/AppError');
const { getFechaHoy, getAhora } = require('../../shared/utils/tiempo');
const { calcularDistanciaMetros } = require('../../shared/utils/geo');

async function registrarPorQR(usuario, body) {
  const { token_qr, latitud, longitud, dispositivo, observaciones } = body;
  const ip = body.ip || null;
  const { id_institucion } = usuario;

  // 1-4. Validar QR (activo, no expirado, estudiante activo)
  const cred = await qrSvc.validar(token_qr);
  const id_estudiante = cred.id_estudiante;

  // 5-6. Obtener matricula activa
  const matricula = await matRepo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!matricula) throw new AppError('El estudiante no tiene matricula activa en esta institucion.','NO_ACTIVE_MATRICULA',404);

  // 7. Verificar institucion
  if (String(matricula.id_institucion)!==String(id_institucion))
    throw new AppError('El estudiante no pertenece a esta institucion.','WRONG_INSTITUTION',403);

  // 7.5 Verificar grado/seccion si es docente
  if (usuario.rol === 'DOCENTE') {
    if (!usuario.tutor) {
      throw new AppError('Solo el docente tutor puede registrar asistencia de estudiantes.', 'FORBIDDEN', 403);
    }
    if (matricula.nivel !== usuario.nivel || matricula.grado !== usuario.grado || matricula.seccion !== usuario.seccion) {
      throw new AppError(`El estudiante pertenece a ${matricula.nivel} - ${matricula.grado} ${matricula.seccion}, pero usted tiene asignado ${usuario.nivel} - ${usuario.grado} ${usuario.seccion}.`, 'WRONG_SECTION', 403);
    }
  }

  // 8. Verificar si ya existe asistencia hoy
  const fecha = getFechaHoy();
  const existente = await repo.findByEstudianteYFecha(id_estudiante, fecha);
  if (existente) throw new AppError('El estudiante ya tiene asistencia registrada hoy.','DUPLICATE_ATTENDANCE',409);

  // Calcular distancia si hay GPS
  let distanciaMetros = null;
  if (latitud !== undefined && longitud !== undefined) {
    const config = await confRepo.findByInstitucion(id_institucion);
    if (config) distanciaMetros = calcularDistanciaMetros(
      parseFloat(config.latitud_ie), parseFloat(config.longitud_ie), parseFloat(latitud), parseFloat(longitud)
    );
  }

  // 9-12. Registrar asistencia
  return repo.registrar({
    id_estudiante, id_matricula: matricula.id_matricula, fecha,
    hora_entrada        : getAhora(),
    estado_asistencia   : 'PRESENTE',
    metodo_registro     : 'QR',
    token_qr_referencia : token_qr,
    latitud: latitud||null, longitud: longitud||null,
    distancia_ie_metros : distanciaMetros,
    ip, dispositivo: dispositivo||null,
    observaciones: observaciones||null,
  });
}

async function registrarManual(usuario, body) {
  const { id_institucion } = usuario;
  const { id_estudiante, estado_asistencia, observaciones } = body;
  if (!id_estudiante) throw new AppError('id_estudiante es obligatorio.','MISSING_FIELDS');

  const matricula = await matRepo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!matricula) throw new AppError('El estudiante no tiene matricula activa.','NO_ACTIVE_MATRICULA',404);

  if (usuario.rol === 'DOCENTE') {
    if (!usuario.tutor) {
      throw new AppError('Solo el docente tutor puede registrar asistencia de estudiantes.', 'FORBIDDEN', 403);
    }
    if (matricula.nivel !== usuario.nivel || matricula.grado !== usuario.grado || matricula.seccion !== usuario.seccion) {
      throw new AppError(`El estudiante pertenece a ${matricula.nivel} - ${matricula.grado} ${matricula.seccion}. No corresponde a su sección.`, 'WRONG_SECTION', 403);
    }
  }

  const fecha = getFechaHoy();
  const existente = await repo.findByEstudianteYFecha(id_estudiante, fecha);
  if (existente) throw new AppError('El estudiante ya tiene asistencia registrada hoy.','DUPLICATE_ATTENDANCE',409);

  const ESTADOS = ['PRESENTE','TARDANZA','FALTA','JUSTIFICADO'];
  const est = ESTADOS.includes(estado_asistencia) ? estado_asistencia : 'PRESENTE';

  return repo.registrar({
    id_estudiante, id_matricula: matricula.id_matricula, fecha,
    hora_entrada        : getAhora(),
    estado_asistencia   : est,
    metodo_registro     : 'MANUAL',
    observaciones       : observaciones||null,
  });
}

async function registrarSalida(usuario, id_estudiante) {
  const { id_institucion } = usuario;
  const matricula = await matRepo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!matricula) throw new AppError('El estudiante no tiene matricula activa.','NO_ACTIVE_MATRICULA',404);

  if (usuario.rol === 'DOCENTE') {
    if (!usuario.tutor) {
      throw new AppError('Solo el docente tutor puede registrar salida de estudiantes.', 'FORBIDDEN', 403);
    }
    if (matricula.nivel !== usuario.nivel || matricula.grado !== usuario.grado || matricula.seccion !== usuario.seccion) {
      throw new AppError(`El estudiante pertenece a ${matricula.nivel} - ${matricula.grado} ${matricula.seccion}. No corresponde a su sección.`, 'WRONG_SECTION', 403);
    }
  }

  const fecha = getFechaHoy();
  const reg = await repo.findByEstudianteYFecha(id_estudiante, fecha);
  if (!reg) throw new AppError('No hay asistencia registrada hoy para este estudiante.','NOT_FOUND',404);
  if (reg.hora_salida) throw new AppError('Ya tiene salida registrada.','DUPLICATE_EXIT',409);
  return repo.registrarSalida(reg.id_asistencia, getAhora());
}

const consultarPorEstudiante = async (id_estudiante, q) => {
  const hoy = getFechaHoy();
  return repo.findByEstudiante(id_estudiante, q.fecha_inicio||hoy, q.fecha_fin||hoy);
};

const consultarInstitucion = async (id_institucion, q) => {
  const hoy = getFechaHoy();
  return repo.findByInstitucion(id_institucion, {
    fecha_inicio: q.fecha_inicio||hoy, fecha_fin: q.fecha_fin||hoy,
    grado: q.grado, seccion: q.seccion, estado: q.estado
  });
};

const resumen = async (id_institucion, q) => {
  const hoy = getFechaHoy();
  return repo.resumen(id_institucion, q.fecha_inicio||hoy, q.fecha_fin||hoy);
};

module.exports = { registrarPorQR, registrarManual, registrarSalida, consultarPorEstudiante, consultarInstitucion, resumen };