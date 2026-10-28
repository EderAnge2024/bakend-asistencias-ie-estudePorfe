/**
 * service.js - Asistencias Estudiantes
 * Registro via QR y manual.
 * La fecha/hora siempre proviene del servidor.
 *
 * MEJORAS:
 * - registrarPorQR: ahora evalua PRESENTE vs TARDANZA segun el horario del dia
 * - cerrarDia: marca FALTA automaticamente a todos los estudiantes sin registro
 */
const repo    = require('./repository');
const qrSvc   = require('../qr/qr.service');
const matRepo = require('../matriculas/matriculas.repository');
const confRepo= require('../configuracion/configuracion.repository');
const horRepo = require('../horarios/horarios.repository');
const AppError = require('../../shared/errors/AppError');
const { getFechaHoy, getAhora } = require('../../shared/utils/tiempo');
const { calcularDistanciaMetros } = require('../../shared/utils/geo');

/** JS: 0=Dom,1=Lun...6=Sab -> nuestro esquema: 1=Lun...7=Dom */
function obtenerDiaSemana() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

/**
 * Evalua si la hora actual es PRESENTE o TARDANZA segun el horario configurado.
 * @param {string} horaInicio  - "HH:MM:SS"
 * @param {number} toleranciaMin - minutos extra permitidos
 * @returns {'PRESENTE'|'TARDANZA'}
 */
function evaluarEstadoEstudiante(horaInicio, toleranciaMin) {
  const ahora = new Date();
  const [hh, mm] = horaInicio.split(':').map(Number);

  const inicioExacto = new Date(ahora);
  inicioExacto.setHours(hh, mm, 0, 0);

  const limiteConTolerancia = new Date(inicioExacto.getTime() + toleranciaMin * 60000);

  return ahora <= limiteConTolerancia ? 'PRESENTE' : 'TARDANZA';
}

async function registrarPorQR(usuario, body) {
  const { token_qr, latitud, longitud, dispositivo, observaciones } = body;
  const modo = (body.modo || '').toUpperCase(); // 'INGRESO' | 'SALIDA' | ''
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

  // 7.5 Verificar grado/seccion/nivel si es docente tutor
  if (usuario.rol === 'DOCENTE' || usuario.rol === 'docente') {
    if (!usuario.tutor) {
      throw new AppError('Solo el docente tutor puede registrar asistencia de estudiantes.', 'FORBIDDEN', 403);
    }
    const nivelMatch = !usuario.nivel || !matricula.nivel ||
      matricula.nivel.trim().toLowerCase() === usuario.nivel.trim().toLowerCase();
    const gradoMatch = !usuario.grado || !matricula.grado ||
      matricula.grado.replace(/[^0-9]/g, '') === usuario.grado.replace(/[^0-9]/g, '');
    const seccionMatch = !usuario.seccion || !matricula.seccion ||
      matricula.seccion.trim().toUpperCase() === usuario.seccion.trim().toUpperCase();
    if (!nivelMatch || !gradoMatch || !seccionMatch) {
      throw new AppError(
        `El estudiante pertenece a ${matricula.nivel} - ${matricula.grado} ${matricula.seccion}, pero usted tiene asignado ${usuario.nivel} - ${usuario.grado} ${usuario.seccion}.`,
        'WRONG_SECTION', 403
      );
    }
  }

  // 8. Verificar si ya existe asistencia hoy
  const fecha = getFechaHoy();
  const existente = await repo.findByEstudianteYFecha(id_estudiante, fecha);

  // MODO EXPLICITO 'INGRESO': Solo registrar ingreso; rechazar si ya ingresó
  if (modo === 'INGRESO') {
    if (existente) {
      const horaEnt = existente.hora_entrada
        ? new Date(existente.hora_entrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '--:--';
      throw new AppError(
        `El estudiante ya tiene ingreso registrado hoy a las ${horaEnt}. Cambie al botón "Modo Salida" si desea registrar su salida.`,
        'ALREADY_ENTERED',
        409
      );
    }
  } else if (modo === 'SALIDA') {
    // MODO EXPLICITO 'SALIDA': Solo registrar salida; requiere ingreso previo
    if (!existente) {
      throw new AppError(
        'No se puede registrar salida: el estudiante no registra ingreso el día de hoy.',
        'NO_ENTRY_RECORDED',
        400
      );
    }
    if (existente.hora_salida) {
      const horaSal = new Date(existente.hora_salida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      throw new AppError(
        `El estudiante ya tiene salida registrada hoy a las ${horaSal}.`,
        'ALREADY_EXITED',
        409
      );
    }
    const actualizado = await repo.registrarSalida(existente.id_asistencia, getAhora());
    return {
      ...actualizado,
      _accion: 'SALIDA',
      nombres: cred.nombres,
      apellido_paterno: cred.apellido_paterno,
    };
  } else {
    // MODO AUTOMATICO (retrocompatible): 1.° escaneo ingreso, 2.° escaneo salida
    if (existente) {
      if (!existente.hora_salida) {
        const actualizado = await repo.registrarSalida(existente.id_asistencia, getAhora());
        return {
          ...actualizado,
          _accion: 'SALIDA',
          nombres: cred.nombres,
          apellido_paterno: cred.apellido_paterno,
        };
      }
      throw new AppError(
        `Jornada completa registrada. Ingreso: ${
          existente.hora_entrada ? new Date(existente.hora_entrada).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '--'
        }, Salida: ${
          new Date(existente.hora_salida).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})
        }`,
        'ATTENDANCE_COMPLETE',
        409
      );
    }
  }

  // 9. Determinar estado PRESENTE / TARDANZA usando horario del dia
  const diaSemana = obtenerDiaSemana();
  const horario   = await horRepo.findVigentePorDia(id_institucion, diaSemana);
  let estadoAsistencia = 'PRESENTE';
  if (horario) {
    const tolerancia = horario.tolerancia_entrada_min != null ? horario.tolerancia_entrada_min : 10;
    estadoAsistencia = evaluarEstadoEstudiante(horario.hora_inicio, tolerancia);
  }

  // Calcular distancia si hay GPS
  let distanciaMetros = null;
  if (latitud !== undefined && longitud !== undefined) {
    const config = await confRepo.findByInstitucion(id_institucion);
    if (config) distanciaMetros = calcularDistanciaMetros(
      parseFloat(config.latitud_ie), parseFloat(config.longitud_ie), parseFloat(latitud), parseFloat(longitud)
    );
  }

  // 10. Registrar asistencia con estado calculado (PRESENTE o TARDANZA)
  const nuevo = await repo.registrar({
    id_estudiante, id_matricula: matricula.id_matricula, fecha,
    hora_entrada        : getAhora(),
    estado_asistencia   : estadoAsistencia,
    metodo_registro     : 'QR',
    token_qr_referencia : token_qr,
    latitud: latitud||null, longitud: longitud||null,
    distancia_ie_metros : distanciaMetros,
    ip, dispositivo: dispositivo||null,
    observaciones: observaciones||null,
  });

  return {
    ...nuevo,
    _accion: 'INGRESO',
    nombres: cred.nombres,
    apellido_paterno: cred.apellido_paterno,
  };
}

async function registrarManual(usuario, body) {
  const { id_institucion } = usuario;
  const { id_estudiante, estado_asistencia, observaciones } = body;
  const modo = (body.modo || '').toUpperCase();
  if (!id_estudiante) throw new AppError('id_estudiante es obligatorio.','MISSING_FIELDS');

  // Si se solicita explícitamente registrar salida manual
  if (modo === 'SALIDA') {
    return registrarSalida(usuario, id_estudiante);
  }

  const matricula = await matRepo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!matricula) throw new AppError('El estudiante no tiene matricula activa.','NO_ACTIVE_MATRICULA',404);

  if (usuario.rol === 'DOCENTE' || usuario.rol === 'docente') {
    if (!usuario.tutor) {
      throw new AppError('Solo el docente tutor puede registrar asistencia de estudiantes.', 'FORBIDDEN', 403);
    }
    const nivelMatch = !usuario.nivel || !matricula.nivel ||
      matricula.nivel.trim().toLowerCase() === usuario.nivel.trim().toLowerCase();
    const gradoMatch = !usuario.grado || !matricula.grado ||
      matricula.grado.replace(/[^0-9]/g, '') === usuario.grado.replace(/[^0-9]/g, '');
    const seccionMatch = !usuario.seccion || !matricula.seccion ||
      matricula.seccion.trim().toUpperCase() === usuario.seccion.trim().toUpperCase();
    if (!nivelMatch || !gradoMatch || !seccionMatch) {
      throw new AppError(
        `El estudiante pertenece a ${matricula.nivel} - ${matricula.grado} ${matricula.seccion}. No corresponde a su sección.`,
        'WRONG_SECTION', 403
      );
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

  if (usuario.rol === 'DOCENTE' || usuario.rol === 'docente') {
    if (!usuario.tutor) {
      throw new AppError('Solo el docente tutor puede registrar salida de estudiantes.', 'FORBIDDEN', 403);
    }
    const nivelMatch = !usuario.nivel || !matricula.nivel ||
      matricula.nivel.trim().toLowerCase() === usuario.nivel.trim().toLowerCase();
    const gradoMatch = !usuario.grado || !matricula.grado ||
      matricula.grado.replace(/[^0-9]/g, '') === usuario.grado.replace(/[^0-9]/g, '');
    const seccionMatch = !usuario.seccion || !matricula.seccion ||
      matricula.seccion.trim().toUpperCase() === usuario.seccion.trim().toUpperCase();
    if (!nivelMatch || !gradoMatch || !seccionMatch) {
      throw new AppError(
        `El estudiante pertenece a ${matricula.nivel} - ${matricula.grado} ${matricula.seccion}. No corresponde a su sección.`,
        'WRONG_SECTION', 403
      );
    }
  }

  const fecha = getFechaHoy();
  const reg = await repo.findByEstudianteYFecha(id_estudiante, fecha);
  if (!reg) throw new AppError('No hay asistencia registrada hoy para este estudiante.','NOT_FOUND',404);
  if (reg.hora_salida) throw new AppError('Ya tiene salida registrada.','DUPLICATE_EXIT',409);
  return repo.registrarSalida(reg.id_asistencia, getAhora());
}

/**
 * cerrarDia - Marca FALTA a todos los estudiantes activos sin registro ese dia.
 * Puede ejecutarse manualmente (director) o como tarea programada.
 * @param {object} usuario   - usuario autenticado con id_institucion
 * @param {string} [fecha]   - YYYY-MM-DD; si no se pasa, se usa la fecha de hoy
 */
async function cerrarDia(usuario, fecha) {
  const { id_institucion } = usuario;
  const fechaCierre = fecha || getFechaHoy();

  // Obtener todos los estudiantes activos sin registro ese dia
  const sinRegistro = await repo.findSinRegistroPorFecha(id_institucion, fechaCierre);

  if (sinRegistro.length === 0) {
    return {
      marcados : 0,
      detalles : [],
      mensaje  : 'Todos los estudiantes ya tienen asistencia registrada para esa fecha.',
    };
  }

  const resultados = [];
  for (const est of sinRegistro) {
    try {
      await repo.registrar({
        id_estudiante    : est.id_estudiante,
        id_matricula     : est.id_matricula,
        fecha            : fechaCierre,
        hora_entrada     : null,
        estado_asistencia: 'FALTA',
        metodo_registro  : 'ADMINISTRATIVO',
        observaciones    : 'Marcado automático por cierre de día',
      });
      resultados.push({ id_estudiante: est.id_estudiante, nombres: est.nombres, estado: 'FALTA', ok: true });
    } catch (e) {
      resultados.push({ id_estudiante: est.id_estudiante, nombres: est.nombres, estado: 'ERROR', ok: false, error: e.message });
    }
  }

  const marcados = resultados.filter(r => r.ok).length;
  return { marcados, detalles: resultados, mensaje: `Se marcaron ${marcados} falta(s) por cierre de día.` };
}

const informeMensual = async (id_institucion, query) => {
  const mes  = parseInt(query.mes  || new Date().getMonth() + 1, 10);
  const anio = parseInt(query.anio || new Date().getFullYear(), 10);
  const filtros = {
    nivel:   query.nivel   || null,
    grado:   query.grado   || null,
    seccion: query.seccion || null,
  };
  // Limpiar nulos
  Object.keys(filtros).forEach(k => { if (!filtros[k]) delete filtros[k]; });
  return repo.findInformeMensual(id_institucion, mes, anio, filtros);
};

const consultarPorEstudiante = async (id_estudiante, q) => {
  const hoy = getFechaHoy();
  return repo.findByEstudiante(id_estudiante, q.fecha_inicio || hoy, q.fecha_fin || hoy);
};

const consultarInstitucion = async (id_institucion, q) => {
  const hoy = getFechaHoy();
  return repo.findByInstitucion(id_institucion, {
    fecha_inicio: q.fecha_inicio || hoy,
    fecha_fin:    q.fecha_fin || hoy,
    nivel:        q.nivel,
    grado:        q.grado,
    seccion:      q.seccion,
    estado:       q.estado,
  });
};

const resumen = async (id_institucion, q) => {
  const hoy = getFechaHoy();
  const rows = await repo.resumen(id_institucion, q.fecha_inicio || hoy, q.fecha_fin || hoy);

  const mapa = { presentes: 0, tardanzas: 0, faltas: 0, justificados: 0 };
  let totalGeneral = 0;
  rows.forEach(r => {
    const n = parseInt(r.total, 10) || 0;
    totalGeneral += n;
    const estado = (r.estado_asistencia || '').toUpperCase();
    if (estado === 'PRESENTE')         mapa.presentes    += n;
    else if (estado === 'TARDANZA')    mapa.tardanzas    += n;
    else if (estado === 'FALTA')       mapa.faltas       += n;
    else if (estado === 'JUSTIFICADO') mapa.justificados += n;
  });
  return {
    presentes:    mapa.presentes,
    tardanzas:    mapa.tardanzas,
    faltas:       mapa.faltas,
    justificados: mapa.justificados,
    total:        totalGeneral,
  };
};

module.exports = { registrarPorQR, registrarManual, registrarSalida, cerrarDia, consultarPorEstudiante, consultarInstitucion, resumen, informeMensual };