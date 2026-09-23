/**
 * service.js - Asistencias Docentes
 * Toda la logica de negocio de registro de asistencia de docentes.
 * La fecha/hora siempre viene del servidor.
 * La validacion de geofence se realiza en el backend.
 */
const repo      = require('./repository');
const confRepo  = require('../configuracion/configuracion.repository');
const horRepo   = require('../horarios/horarios.repository');
const AppError  = require('../../shared/errors/AppError');
const { calcularDistanciaMetros } = require('../../shared/utils/geo');
const { getFechaHoy, getAhora, evaluarEstadoAsistencia } = require('../../shared/utils/tiempo');

function obtenerDiaSemana() {
  // JS: 0=Dom,1=Lun...6=Sab -> nuestro esquema: 1=Lun...7=Dom
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

async function registrarEntrada(usuario, body) {
  const { id_docente, id_institucion } = usuario;
  const { latitud, longitud, wifi_ssid, wifi_bssid, dispositivo } = body;
  const ip = body.ip_entrada || null;

  // 1. Obtener configuracion de la IE
  const config = await confRepo.findByInstitucion(id_institucion);
  if (!config || !config.estado)
    throw new AppError('La institucion no tiene configuracion de asistencia activa.','CONFIG_NOT_FOUND',404);

  // 2. Fecha del servidor
  const fecha = getFechaHoy();
  const ahora = getAhora();

  // 3. Verificar que no exista entrada hoy
  const existente = await repo.findByDocenteYFecha(id_docente, fecha);
  if (existente)
    throw new AppError('Ya tiene una asistencia registrada para hoy.','DUPLICATE_ATTENDANCE',409);

  // 4. Validacion GPS (si se proporcionan coordenadas)
  let distanciaMetros = null;
  let nivelSeguridad  = 'BAJO';
  let metodo          = 'MANUAL';

  if (latitud !== undefined && longitud !== undefined) {
    distanciaMetros = calcularDistanciaMetros(
      parseFloat(config.latitud_ie), parseFloat(config.longitud_ie),
      parseFloat(latitud), parseFloat(longitud)
    );
    if (distanciaMetros > config.radio_permitido_metros) {
      throw new AppError(
        `Usted esta fuera de la IE. Distancia actual: ${distanciaMetros}m. Radio permitido: ${config.radio_permitido_metros}m.`,
        'OUTSIDE_GEOFENCE', 422
      );
    }
    metodo = 'GPS_WIFI';
    nivelSeguridad = distanciaMetros <= config.radio_permitido_metros * 0.5 ? 'ALTO' : 'MEDIO';
  } else if (!config.permitir_registro_manual) {
    throw new AppError('Debe proporcionar coordenadas GPS para registrar asistencia.','GPS_REQUIRED',422);
  }

  // 5. Determinar estado PRESENTE / TARDANZA usando horario del dia
  const diaSemana = obtenerDiaSemana();
  const horario   = await horRepo.findVigentePorDia(id_institucion, diaSemana);
  let estadoAsistencia = 'PRESENTE';

  if (horario) {
    const eval_ = evaluarEstadoAsistencia(horario.hora_inicio, config.tolerancia_entrada_min);
    estadoAsistencia = eval_.estado === 'FUERA' ? 'TARDANZA' : eval_.estado;
  }

  // 6. Registrar
  const registro = await repo.registrarEntrada({
    id_docente, id_institucion, fecha,
    hora_entrada          : ahora,
    estado_asistencia     : estadoAsistencia,
    metodo_entrada        : metodo,
    latitud_entrada       : latitud   || null,
    longitud_entrada      : longitud  || null,
    distancia_entrada_metros: distanciaMetros,
    wifi_ssid_entrada     : wifi_ssid  || config.wifi_ssid  || null,
    wifi_bssid_entrada    : wifi_bssid || config.wifi_bssid || null,
    ip_entrada            : ip,
    dispositivo           : dispositivo || null,
    nivel_seguridad       : nivelSeguridad,
    observaciones         : body.observaciones || null,
  });

  return registro;
}

async function registrarSalida(usuario, body) {
  const { id_docente, id_institucion } = usuario;
  const { latitud, longitud, wifi_ssid, wifi_bssid, dispositivo } = body;
  const ip = body.ip_salida || null;
  const fecha = getFechaHoy();
  const ahora = getAhora();

  // Verificar que exista entrada
  const existente = await repo.findByDocenteYFecha(id_docente, fecha);
  if (!existente)
    throw new AppError('No tiene entrada registrada hoy.','NO_ENTRY_FOUND',404);
  if (existente.hora_salida)
    throw new AppError('Ya tiene salida registrada hoy.','DUPLICATE_EXIT',409);

  // Validacion GPS de salida (opcional)
  let distanciaMetros = null;
  if (latitud !== undefined && longitud !== undefined) {
    const config = await confRepo.findByInstitucion(id_institucion);
    if (config) {
      distanciaMetros = calcularDistanciaMetros(
        parseFloat(config.latitud_ie), parseFloat(config.longitud_ie),
        parseFloat(latitud), parseFloat(longitud)
      );
    }
  }

  return repo.registrarSalida(existente.id_asistencia, {
    hora_salida          : ahora,
    metodo_salida        : (latitud!==undefined&&longitud!==undefined) ? 'GPS_WIFI' : 'MANUAL',
    latitud_salida       : latitud  || null,
    longitud_salida      : longitud || null,
    distancia_salida_metros: distanciaMetros,
    wifi_ssid_salida     : wifi_ssid  || null,
    wifi_bssid_salida    : wifi_bssid || null,
    ip_salida            : ip,
  });
}

async function consultarPropia(usuario, query) {
  const { id_docente } = usuario;
  const hoy = getFechaHoy();
  const fecha_inicio = query.fecha_inicio || hoy;
  const fecha_fin    = query.fecha_fin    || hoy;
  return repo.findPropia(id_docente, fecha_inicio, fecha_fin);
}

async function consultarPorDocente(usuario, id_docente, query) {
  const { id_institucion } = usuario;
  const hoy = getFechaHoy();
  const fecha_inicio = query.fecha_inicio || hoy;
  const fecha_fin    = query.fecha_fin    || hoy;
  return repo.findByDocente(id_docente, id_institucion, fecha_inicio, fecha_fin);
}

async function consultarInstitucion(usuario, query) {
  const { id_institucion } = usuario;
  const hoy = getFechaHoy();
  const fecha_inicio = query.fecha_inicio || hoy;
  const fecha_fin    = query.fecha_fin    || hoy;
  return repo.findByInstitucion(id_institucion, fecha_inicio, fecha_fin, query.estado);
}

async function resumen(usuario, query) {
  const hoy = getFechaHoy();
  const fecha_inicio = query.fecha_inicio || hoy;
  const fecha_fin    = query.fecha_fin    || hoy;
  return repo.resumenPorInstitucion(usuario.id_institucion, fecha_inicio, fecha_fin);
}

module.exports = { registrarEntrada, registrarSalida, consultarPropia, consultarPorDocente, consultarInstitucion, resumen };