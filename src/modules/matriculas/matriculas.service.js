const repo    = require('./matriculas.repository');
const estRepo = require('../estudiantes/estudiantes.repository');
const dbMonitoreo = require('../../config/databaseMonitoreo');
const AppError = require('../../shared/errors/AppError');

function parseGradoTutoria(gradoTutoria) {
  if (!gradoTutoria) return { grado: '', seccion: '' };
  const str = String(gradoTutoria).trim();
  const matchNum = str.match(/\d+/);
  const matchLetra = str.match(/["']([A-Za-z])["']/) || str.match(/\b([A-Za-z])\b/) || str.match(/([A-Za-z])/);
  return {
    grado: matchNum ? matchNum[0] : '',
    seccion: matchLetra ? matchLetra[1].toUpperCase() : ''
  };
}

function encontrarTutorEnLista(tutores, nivel, grado, seccion) {
  if (!tutores || !tutores.length || !grado) return null;
  const nivelLimpio = nivel ? String(nivel).trim().toLowerCase() : '';
  const gradoLimpio = String(grado).replace(/[^0-9]/g, '');
  const seccionLimpia = seccion ? String(seccion).replace(/[^A-Za-z]/g, '').toUpperCase() : '';

  for (const doc of tutores) {
    if (!doc.grado_tutoria) continue;

    // 1. Validar Nivel (Primaria vs Secundaria)
    const docNivel = (doc.nivel || '').trim().toLowerCase();
    if (nivelLimpio && docNivel && docNivel !== nivelLimpio) continue;

    // 2. Extraer grado y sección del docente tutor
    const parsed = parseGradoTutoria(doc.grado_tutoria);

    // 3. Validar Grado
    if (parsed.grado !== gradoLimpio) continue;

    // 4. Validar Sección (coincidencia exacta entre el aula del alumno y la tutoría asignada)
    if (seccionLimpia && parsed.seccion && parsed.seccion !== seccionLimpia) continue;

    return doc;
  }
  return null;
}

async function buscarTutorAsignado(id_institucion, nivel, grado, seccion) {
  if (!id_institucion || !grado) return null;
  try {
    const { rows } = await dbMonitoreo.query(
      `SELECT id_docente, dni, nombres, apellidos, grado_tutoria, nivel, correo 
       FROM docentes 
       WHERE (id_institucion = $1 OR id_institucion::text = $1::text) 
         AND (tutor = TRUE OR tutor::text = 'true')`,
      [id_institucion]
    );

    return encontrarTutorEnLista(rows, nivel, grado, seccion);
  } catch (err) {
    console.error('Error buscando tutor asignado:', err);
    return null;
  }
}

const listar = async (id_institucion, q) => {
  const lista = await repo.findAll({ id_institucion, ...q });
  let tutores = [];
  try {
    const { rows } = await dbMonitoreo.query(
      `SELECT id_docente, dni, nombres, apellidos, grado_tutoria, nivel, correo 
       FROM docentes 
       WHERE (id_institucion = $1 OR id_institucion::text = $1::text) 
         AND (tutor = TRUE OR tutor::text = 'true')`,
      [id_institucion]
    );
    tutores = rows;
  } catch (err) {
    console.error('Error pre-cargando tutores en listar matriculas:', err);
  }

  return lista.map(m => ({
    ...m,
    tutor_asignado: encontrarTutorEnLista(tutores, m.nivel, m.grado, m.seccion)
  }));
};

const obtener = async (id_institucion, id) => {
  const m = await repo.findById(id);
  if (!m) throw new AppError('Matricula no encontrada.', 'NOT_FOUND', 404);
  if (String(m.id_institucion) !== String(id_institucion)) throw new AppError('Sin permisos.', 'FORBIDDEN', 403);
  const tutor = await buscarTutorAsignado(id_institucion, m.nivel, m.grado, m.seccion);
  return { ...m, tutor_asignado: tutor };
};

const crear = async (id_institucion, d) => {
  if (!d.id_estudiante || !d.anio_lectivo || !d.nivel || !d.grado || !d.seccion)
    throw new AppError('id_estudiante, anio_lectivo, nivel, grado y seccion son obligatorios.', 'MISSING_FIELDS');
  const est = await estRepo.findById(d.id_estudiante);
  if (!est) throw new AppError('Estudiante no encontrado.', 'STUDENT_NOT_FOUND', 404);
  const nueva = await repo.create({ ...d, id_institucion });
  const tutor = await buscarTutorAsignado(id_institucion, nueva.nivel, nueva.grado, nueva.seccion);
  return { ...nueva, tutor_asignado: tutor };
};

const actualizar = async (id_institucion, id, d) => {
  const m = await repo.findById(id);
  if (!m) throw new AppError('Matricula no encontrada.', 'NOT_FOUND', 404);
  if (String(m.id_institucion) !== String(id_institucion)) throw new AppError('Sin permisos.', 'FORBIDDEN', 403);
  const act = await repo.update(id, d);
  const tutor = await buscarTutorAsignado(id_institucion, act.nivel, act.grado, act.seccion);
  return { ...act, tutor_asignado: tutor };
};

const matriculaActiva = async (id_institucion, id_estudiante) => {
  const m = await repo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!m) throw new AppError('El estudiante no tiene matricula activa.', 'NO_ACTIVE_MATRICULA', 404);
  const tutor = await buscarTutorAsignado(id_institucion, m.nivel, m.grado, m.seccion);
  return { ...m, tutor_asignado: tutor };
};

module.exports = { listar, obtener, crear, actualizar, matriculaActiva, buscarTutorAsignado };