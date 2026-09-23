/**
 * tiempo.js - Utilidades de fecha/hora del servidor
 * Zona horaria: America/Lima (UTC-5, Peru)
 * La fecha/hora siempre proviene del servidor, nunca del cliente.
 */
const TIMEZONE = 'America/Lima';

/** Retorna la fecha actual del servidor en formato YYYY-MM-DD (hora Peru) */
function getFechaHoy() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
}

/** Retorna el timestamp actual del servidor */
function getAhora() {
  return new Date();
}

/**
 * Determina si la hora actual esta dentro del horario + tolerancia
 * @param {string} horaInicio  - "HH:MM:SS"
 * @param {number} toleranciaMin - minutos extra permitidos despues del inicio
 * @returns {{ dentro: boolean, estado: 'PRESENTE'|'TARDANZA'|'FUERA' }}
 */
function evaluarEstadoAsistencia(horaInicio, toleranciaMin) {
  const ahora = new Date();
  const [hh, mm] = horaInicio.split(':').map(Number);

  const inicioExacto = new Date(ahora);
  inicioExacto.setHours(hh, mm, 0, 0);

  const limiteConTolerancia = new Date(inicioExacto.getTime() + toleranciaMin * 60000);
  const limiteMaximo = new Date(inicioExacto.getTime() + 4 * 60 * 60000); // max 4h despues

  if (ahora <= limiteConTolerancia) return { estado: 'PRESENTE' };
  if (ahora <= limiteMaximo)        return { estado: 'TARDANZA' };
  return { estado: 'FUERA' };
}

module.exports = { getFechaHoy, getAhora, evaluarEstadoAsistencia, TIMEZONE };