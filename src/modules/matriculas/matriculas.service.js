const repo    = require('./matriculas.repository');
const estRepo = require('../estudiantes/estudiantes.repository');
const dbMonitoreo = require('../../config/databaseMonitoreo');
const AppError = require('../../shared/errors/AppError');

async function buscarTutorAsignado(id_institucion, grado, seccion) {
  if (!id_institucion || !grado) return null;
  const gradoLimpio = String(grado).replace(/[^0-9]/g, '');
  const seccionLimpia = seccion ? String(seccion).trim().toUpperCase() : '';

  try {
    const { rows } = await dbMonitoreo.query(
      `SELECT id_docente, dni, nombres, apellidos, grado_tutoria, nivel, correo 
       FROM docentes 
       WHERE (id_institucion = $1 OR id_institucion::text = $1::text) 
         AND (tutor = TRUE OR tutor::text = 'true')`,
      [id_institucion]
    );

    if (!rows || !rows.length) return null;

    let tutorEncontrado = null;

    for (const doc of rows) {
      if (!doc.grado_tutoria) continue;
      const str = String(doc.grado_tutoria).trim();
      const matchNum = str.match(/\d+/);
      const matchLetra = str.match(/[A-Za-z]/);

      const docGrado = matchNum ? matchNum[0] : '';
      const docSeccion = matchLetra ? matchLetra[0].toUpperCase() : '';

      if (docGrado === gradoLimpio) {
        if (seccionLimpia && docSeccion === seccionLimpia) {
          return doc;
        }
        if (!tutorEncontrado) tutorEncontrado = doc;
      }
    }

    return tutorEncontrado;
  } catch (err) {
    console.error('Error buscando tutor asignado:', err);
    return null;
  }
}

const listar = async (id_institucion, q) => {
  const lista = await repo.findAll({ id_institucion, ...q });
  const enriquecidas = await Promise.all(lista.map(async (m) => {
    const tutor = await buscarTutorAsignado(id_institucion, m.grado, m.seccion);
    return { ...m, tutor_asignado: tutor };
  }));
  return enriquecidas;
};

const obtener = async (id_institucion, id) => {
  const m = await repo.findById(id);
  if (!m) throw new AppError('Matricula no encontrada.', 'NOT_FOUND', 404);
  if (String(m.id_institucion) !== String(id_institucion)) throw new AppError('Sin permisos.', 'FORBIDDEN', 403);
  const tutor = await buscarTutorAsignado(id_institucion, m.grado, m.seccion);
  return { ...m, tutor_asignado: tutor };
};

const crear = async (id_institucion, d) => {
  if (!d.id_estudiante || !d.anio_lectivo || !d.nivel || !d.grado || !d.seccion)
    throw new AppError('id_estudiante, anio_lectivo, nivel, grado y seccion son obligatorios.', 'MISSING_FIELDS');
  const est = await estRepo.findById(d.id_estudiante);
  if (!est) throw new AppError('Estudiante no encontrado.', 'STUDENT_NOT_FOUND', 404);
  const nueva = await repo.create({ ...d, id_institucion });
  const tutor = await buscarTutorAsignado(id_institucion, nueva.grado, nueva.seccion);
  return { ...nueva, tutor_asignado: tutor };
};

const actualizar = async (id_institucion, id, d) => {
  const m = await repo.findById(id);
  if (!m) throw new AppError('Matricula no encontrada.', 'NOT_FOUND', 404);
  if (String(m.id_institucion) !== String(id_institucion)) throw new AppError('Sin permisos.', 'FORBIDDEN', 403);
  const act = await repo.update(id, d);
  const tutor = await buscarTutorAsignado(id_institucion, act.grado, act.seccion);
  return { ...act, tutor_asignado: tutor };
};

const matriculaActiva = async (id_institucion, id_estudiante) => {
  const m = await repo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!m) throw new AppError('El estudiante no tiene matricula activa.', 'NO_ACTIVE_MATRICULA', 404);
  const tutor = await buscarTutorAsignado(id_institucion, m.grado, m.seccion);
  return { ...m, tutor_asignado: tutor };
};

module.exports = { listar, obtener, crear, actualizar, matriculaActiva, buscarTutorAsignado };