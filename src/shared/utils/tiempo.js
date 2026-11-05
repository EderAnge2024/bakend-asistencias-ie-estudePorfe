/**
 * tiempo.js - Utilidades de fecha/hora del servidor
 * Zona horaria: America/Lima (UTC-5, Peru)
 * La fecha/hora siempre proviene del servidor, nunca del cliente.
 */
const TIMEZONE = 'America/Lima';

/** Retorna la fecha actual del servidor en formato YYYY-MM-DD (hora Peru) */
function getFechaHoy(fecha = new Date()) {
  return fecha.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
}

/** Retorna el timestamp actual del servidor */
function getAhora() {
  return new Date();
}

/**
 * Obtiene los componentes exactos de fecha y hora calculados en zona horaria America/Lima.
 * Resuelve cualquier discrepancia cuando el servidor corre en UTC u otra zona.
 * @param {Date} [fecha]
 * @returns {{ diaSemana: number, hora: number, minuto: number, segundo: number, minutosActuales: number, fechaStr: string, horaStr: string }}
 */
function getComponentesHoraLima(fecha = new Date()) {
  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });

  const partes = formateador.formatToParts(fecha);
  const mapa = {};
  for (const p of partes) {
    mapa[p.type] = p.value;
  }

  // Días de la semana en esquema institucional: 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab, 7=Dom
  const diasMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const diaSemana = diasMap[mapa.weekday] || 1;
  const hora = parseInt(mapa.hour, 10);
  const minuto = parseInt(mapa.minute, 10);
  const segundo = parseInt(mapa.second, 10);
  const minutosActuales = hora * 60 + minuto + (segundo / 60);

  const fechaStr = `${mapa.year}-${mapa.month}-${mapa.day}`;
  const horaStr = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:${String(segundo).padStart(2, '0')}`;

  return {
    diaSemana,
    hora,
    minuto,
    segundo,
    minutosActuales,
    fechaStr,
    horaStr,
  };
}

/**
 * Evalua de forma precisa si el estudiante está PRESENTE o TARDANZA según horario y tolerancia.
 * Utiliza estrictamente la hora peruana (America/Lima).
 * @param {string} horaInicio - "HH:MM:SS" o "HH:MM"
 * @param {number} toleranciaMin - minutos extra de tolerancia
 * @param {Date} [fechaActual] - Fecha de referencia (opcional, default servidor)
 * @returns {'PRESENTE'|'TARDANZA'}
 */
function evaluarEstadoEstudiante(horaInicio, toleranciaMin = 10, fechaActual = new Date()) {
  if (!horaInicio || typeof horaInicio !== 'string') return 'PRESENTE';

  const [hhStr, mmStr] = horaInicio.split(':');
  const hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr || '0', 10);

  if (isNaN(hh)) return 'PRESENTE';

  const tol = parseInt(toleranciaMin, 10) || 0;
  const minutosLimite = hh * 60 + mm + tol;

  const { minutosActuales } = getComponentesHoraLima(fechaActual);

  return minutosActuales <= minutosLimite ? 'PRESENTE' : 'TARDANZA';
}

/**
 * Determina si la hora actual esta dentro del horario + tolerancia (Docentes)
 * @param {string} horaInicio - "HH:MM:SS"
 * @param {number} toleranciaMin - minutos extra permitidos despues del inicio
 * @returns {{ dentro: boolean, estado: 'PRESENTE'|'TARDANZA'|'FUERA' }}
 */
function evaluarEstadoAsistencia(horaInicio, toleranciaMin) {
  if (!horaInicio || typeof horaInicio !== 'string') return { estado: 'PRESENTE' };
  const estado = evaluarEstadoEstudiante(horaInicio, toleranciaMin);
  return { estado };
}

module.exports = {
  getFechaHoy,
  getAhora,
  getComponentesHoraLima,
  evaluarEstadoEstudiante,
  evaluarEstadoAsistencia,
  TIMEZONE,
};
