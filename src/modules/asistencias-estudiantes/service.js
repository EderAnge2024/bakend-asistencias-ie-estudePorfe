/**
 * service.js - Asistencias Estudiantes
 * Registro via QR y manual.
 * La fecha/hora siempre proviene del servidor en zona horaria America/Lima (Perú).
 */
const repo     = require('./repository');
const qrSvc    = require('../qr/qr.service');
const matRepo  = require('../matriculas/matriculas.repository');
const confRepo = require('../configuracion/configuracion.repository');
const horRepo  = require('../horarios/horarios.repository');
const AppError = require('../../shared/errors/AppError');
const {
  getFechaHoy,
  getAhora,
  getComponentesHoraLima,
  evaluarEstadoEstudiante,
} = require('../../shared/utils/tiempo');
const { calcularDistanciaMetros } = require('../../shared/utils/geo');

/**
 * Determina de forma automática si corresponde PRESENTE o TARDANZA
 * según la hora actual en Perú (America/Lima) y los horarios/tolerancias configurados.
 * @param {number|string} id_institucion
 * @param {Date} [fechaRef]
 * @returns {Promise<'PRESENTE'|'TARDANZA'>}
 */
async function determinarEstadoEntrada(id_institucion, fechaRef = new Date()) {
  const { diaSemana } = getComponentesHoraLima(fechaRef);

  // 1. Buscar horario configurado para el día de la semana
  let horario = await horRepo.findVigentePorDia(id_institucion, diaSemana);

  // 2. Fallback: Si no hay horario específico para el día, buscar el primer horario activo de la institución
  if (!horario) {
    const todosHorarios = await horRepo.findAll(id_institucion, true);
    if (todosHorarios && todosHorarios.length > 0) {
      horario = todosHorarios[0];
    }
  }

  // 3. Fallback adicional de configuración institucional para tolerancia
  let tolerancia = 10;
  if (horario && horario.tolerancia_entrada_min != null) {
    tolerancia = horario.tolerancia_entrada_min;
  } else {
    const config = await confRepo.findByInstitucion(id_institucion);
    if (config && config.tolerancia_entrada_min != null) {
      tolerancia = config.tolerancia_entrada_min;
    }
  }

  // 4. Si hay horario con hora_inicio, evaluar hora en Lima con tolerancia
  if (horario && horario.hora_inicio) {
    return evaluarEstadoEstudiante(horario.hora_inicio, tolerancia, fechaRef);
  }

  // Si no hay horarios configurados en el sistema, por defecto es PRESENTE
  return 'PRESENTE';
}

/**
 * Valida si un docente tutor tiene asignado el aula del estudiante.
 * Los directores y administradores NO están restringidos por aula.
 */
function validarPermisoDocenteTutor(usuario, matricula) {
  const rolUpper = (usuario.rol || '').toUpperCase();
  if (rolUpper === 'DOCENTE' || rolUpper === 'PROFESOR') {
    if (!usuario.tutor) {
      throw new AppError('Solo el docente tutor puede registrar asistencia de su aula asignada.', 'FORBIDDEN', 403);
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
}

async function registrarPorQR(usuario, body) {
  const { token_qr, latitud, longitud, dispositivo, observaciones } = body;
  const modo = (body.modo || '').toUpperCase(); // 'INGRESO' | 'SALIDA' | ''
  const ip = body.ip || null;
  const { id_institucion } = usuario;

  if (!token_qr || !token_qr.trim()) {
    throw new AppError('El código o token QR es requerido.', 'MISSING_QR_TOKEN', 400);
  }

  // 1-4. Validar QR
  const cred = await qrSvc.validar(token_qr.trim());
  const id_estudiante = cred.id_estudiante;

  // 5-6. Obtener matricula activa
  const matricula = await matRepo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!matricula) {
    throw new AppError('El estudiante no tiene matricula activa en esta institucion.', 'NO_ACTIVE_MATRICULA', 404);
  }

  // 7. Verificar institucion
  if (String(matricula.id_institucion) !== String(id_institucion)) {
    throw new AppError('El estudiante no pertenece a esta institucion.', 'WRONG_INSTITUTION', 403);
  }

  // 7.5 Si es docente tutor, validar aula
  validarPermisoDocenteTutor(usuario, matricula);

  // 8. Verificar asistencia hoy
  const ahora = getAhora();
  const fecha = getFechaHoy(ahora);
  const existente = await repo.findByEstudianteYFecha(id_estudiante, fecha);

  // MODO EXPLICITO 'INGRESO'
  if (modo === 'INGRESO') {
    if (existente) {
      const horaEnt = existente.hora_entrada
        ? new Date(existente.hora_entrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        : '--:--';
      throw new AppError(
        `El estudiante ya tiene ingreso registrado hoy a las ${horaEnt}. Cambie a "Modo Salida" para registrar su salida.`,
        'ALREADY_ENTERED',
        409
      );
    }
  } else if (modo === 'SALIDA') {
    // MODO EXPLICITO 'SALIDA'
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
    const actualizado = await repo.registrarSalida(existente.id_asistencia, ahora);
    return {
      ...actualizado,
      _accion: 'SALIDA',
      nombres: cred.nombres,
      apellido_paterno: cred.apellido_paterno,
      nivel: matricula.nivel,
      grado: matricula.grado,
      seccion: matricula.seccion,
    };
  } else {
    // MODO AUTOMATICO (retrocompatible)
    if (existente) {
      if (!existente.hora_salida) {
        const actualizado = await repo.registrarSalida(existente.id_asistencia, ahora);
        return {
          ...actualizado,
          _accion: 'SALIDA',
          nombres: cred.nombres,
          apellido_paterno: cred.apellido_paterno,
          nivel: matricula.nivel,
          grado: matricula.grado,
          seccion: matricula.seccion,
        };
      }
      throw new AppError(
        `Jornada completa registrada. Ingreso: ${
          existente.hora_entrada ? new Date(existente.hora_entrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--'
        }, Salida: ${
          new Date(existente.hora_salida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
        }`,
        'ATTENDANCE_COMPLETE',
        409
      );
    }
  }

  // 9. Determinar estado PRESENTE / TARDANZA automático según horario
  const estadoAsistencia = await determinarEstadoEntrada(id_institucion, ahora);

  // Calcular distancia si hay GPS
  let distanciaMetros = null;
  if (latitud !== undefined && longitud !== undefined) {
    const config = await confRepo.findByInstitucion(id_institucion);
    if (config && config.latitud_ie && config.longitud_ie) {
      distanciaMetros = calcularDistanciaMetros(
        parseFloat(config.latitud_ie), parseFloat(config.longitud_ie), parseFloat(latitud), parseFloat(longitud)
      );
    }
  }

  // 10. Registrar ingreso con usuario auditor
  const nuevo = await repo.registrar({
    id_estudiante,
    id_matricula        : matricula.id_matricula,
    fecha,
    hora_entrada        : ahora,
    estado_asistencia   : estadoAsistencia,
    metodo_registro     : 'QR',
    token_qr_referencia : token_qr,
    latitud             : latitud || null,
    longitud            : longitud || null,
    distancia_ie_metros : distanciaMetros,
    ip,
    dispositivo         : dispositivo || null,
    observaciones       : observaciones || null,
    registrado_por      : usuario.id_usuario || null,
    rol_registro        : usuario.rol || null,
  });

  return {
    ...nuevo,
    _accion: 'INGRESO',
    nombres: cred.nombres,
    apellido_paterno: cred.apellido_paterno,
    nivel: matricula.nivel,
    grado: matricula.grado,
    seccion: matricula.seccion,
  };
}

async function registrarManual(usuario, body) {
  const { id_institucion } = usuario;
  const { id_estudiante, observaciones } = body;
  const modo = (body.modo || '').toUpperCase();

  if (!id_estudiante) throw new AppError('id_estudiante es obligatorio.', 'MISSING_FIELDS');

  // Si se solicita explícitamente registrar salida manual
  if (modo === 'SALIDA') {
    return registrarSalida(usuario, id_estudiante);
  }

  const matricula = await matRepo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!matricula) throw new AppError('El estudiante no tiene matricula activa.', 'NO_ACTIVE_MATRICULA', 404);

  validarPermisoDocenteTutor(usuario, matricula);

  const ahora = getAhora();
  const fecha = getFechaHoy(ahora);
  const existente = await repo.findByEstudianteYFecha(id_estudiante, fecha);
  if (existente) {
    const horaEnt = existente.hora_entrada
      ? new Date(existente.hora_entrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      : '--:--';
    throw new AppError(
      `El estudiante ya tiene asistencia registrada hoy a las ${horaEnt} (${existente.estado_asistencia}).`,
      'DUPLICATE_ATTENDANCE',
      409
    );
  }

  // CÁLCULO DE ESTADO:
  // Si el usuario especifica explícitamente FALTA o JUSTIFICADO, se respeta la justificación o falta manual.
  // Si no se envía estado o es PRESENTE / AUTOMATICO, se calcula automáticamente según horario y tolerancia.
  let estadoFinal;
  const reqEstado = (body.estado_asistencia || '').toUpperCase();
  if (reqEstado === 'FALTA' || reqEstado === 'JUSTIFICADO') {
    estadoFinal = reqEstado;
  } else if (reqEstado === 'TARDANZA') {
    estadoFinal = 'TARDANZA';
  } else {
    estadoFinal = await determinarEstadoEntrada(id_institucion, ahora);
  }

  const nuevo = await repo.registrar({
    id_estudiante,
    id_matricula        : matricula.id_matricula,
    fecha,
    hora_entrada        : estadoFinal === 'FALTA' ? null : ahora,
    estado_asistencia   : estadoFinal,
    metodo_registro     : 'MANUAL',
    observaciones       : observaciones || null,
    registrado_por      : usuario.id_usuario || null,
    rol_registro        : usuario.rol || null,
  });

  return {
    ...nuevo,
    _accion: 'INGRESO',
    nivel: matricula.nivel,
    grado: matricula.grado,
    seccion: matricula.seccion,
  };
}

async function registrarSalida(usuario, id_estudiante) {
  const { id_institucion } = usuario;
  const matricula = await matRepo.findActivaByEstudiante(id_estudiante, id_institucion);
  if (!matricula) throw new AppError('El estudiante no tiene matricula activa.', 'NO_ACTIVE_MATRICULA', 404);

  validarPermisoDocenteTutor(usuario, matricula);

  const ahora = getAhora();
  const fecha = getFechaHoy(ahora);
  const reg = await repo.findByEstudianteYFecha(id_estudiante, fecha);
  if (!reg) throw new AppError('No hay asistencia registrada hoy para este estudiante.', 'NOT_FOUND', 404);
  if (reg.hora_salida) {
    const horaSal = new Date(reg.hora_salida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    throw new AppError(`El estudiante ya tiene salida registrada hoy a las ${horaSal}.`, 'DUPLICATE_EXIT', 409);
  }

  const actualizado = await repo.registrarSalida(reg.id_asistencia, ahora);
  return {
    ...actualizado,
    _accion: 'SALIDA',
    nivel: matricula.nivel,
    grado: matricula.grado,
    seccion: matricula.seccion,
  };
}

/**
 * Búsqueda de estudiantes para el Director con estado de asistencia hoy.
 */
async function buscarParaDirector(usuario, query) {
  const { id_institucion } = usuario;
  return repo.buscarEstudiantesParaAsistencia(id_institucion, {
    busqueda: query.busqueda,
    nivel: query.nivel,
    grado: query.grado,
    seccion: query.seccion,
    fecha: query.fecha,
  });
}

/**
 * cerrarDia - Marca FALTA a todos los estudiantes activos sin registro ese dia.
 */
async function cerrarDia(usuario, fecha) {
  const { id_institucion } = usuario;
  const fechaCierre = fecha || getFechaHoy();

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
        registrado_por   : usuario.id_usuario || null,
        rol_registro     : usuario.rol || 'SISTEMA',
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

module.exports = {
  determinarEstadoEntrada,
  registrarPorQR,
  registrarManual,
  registrarSalida,
  buscarParaDirector,
  cerrarDia,
  consultarPorEstudiante,
  consultarInstitucion,
  resumen,
  informeMensual,
};
