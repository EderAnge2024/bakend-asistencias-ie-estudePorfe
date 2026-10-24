/**
 * cronCierreDia.js
 * Tarea programada que cierra el día automáticamente a las 00:00
 * para todas las instituciones activas.
 *
 * Lógica:
 *  1. Obtiene todas las instituciones con configuración activa
 *  2. Por cada institución, marca FALTA a docentes y estudiantes sin registro
 *  3. Solo actúa si el día tiene horario configurado (día lectivo)
 */
const cron    = require('node-cron');
const db      = require('../config/database');
const horRepo = require('../modules/horarios/horarios.repository');
const svcEst  = require('../modules/asistencias-estudiantes/service');
const svcDoc  = require('../modules/asistencias-docentes/service');

/** JS: 0=Dom → nuestro esquema: 1=Lun...7=Dom */
function diaSemanaHoy() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function getFechaAyer() {
  // El cron corre a las 00:00, así que "ayer" es el día que acaba de terminar
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

async function obtenerInstitucionesActivas() {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT id_institucion FROM configuracion_asistencia WHERE estado = true`
    );
    return rows.map(r => r.id_institucion);
  } catch (e) {
    console.error('[CronCierreDia] Error al obtener instituciones:', e.message);
    return [];
  }
}

async function ejecutarCierreDia() {
  const fecha    = getFechaAyer();
  const diaSem   = diaSemanaHoy() === 1 ? 7 : diaSemanaHoy() - 1; // día de ayer
  const ahora    = new Date().toLocaleTimeString('es-PE');

  console.log(`[CronCierreDia] ⏰ Iniciando cierre de día para ${fecha} (${ahora})`);

  const instituciones = await obtenerInstitucionesActivas();
  if (instituciones.length === 0) {
    console.log('[CronCierreDia] Sin instituciones activas. Nada que hacer.');
    return;
  }

  let totalEst = 0;
  let totalDoc = 0;

  for (const id_institucion of instituciones) {
    try {
      // Verificar si ayer fue día lectivo (tiene horario configurado)
      const horario = await horRepo.findVigentePorDia(id_institucion, diaSem);
      if (!horario) {
        console.log(`[CronCierreDia] IE ${id_institucion}: sin horario para el día ${diaSem}, se omite.`);
        continue;
      }

      const usuarioFicticio = { id_institucion };

      // Cerrar estudiantes
      try {
        const resEst = await svcEst.cerrarDia(usuarioFicticio, fecha);
        totalEst += resEst.marcados || 0;
        console.log(`[CronCierreDia] IE ${id_institucion} - Estudiantes: ${resEst.marcados} faltas marcadas. ${resEst.mensaje}`);
      } catch (eEst) {
        console.error(`[CronCierreDia] IE ${id_institucion} - Error en estudiantes:`, eEst.message);
      }

      // Cerrar docentes
      try {
        const resDoc = await svcDoc.cerrarDia(usuarioFicticio, fecha);
        totalDoc += resDoc.marcados || 0;
        console.log(`[CronCierreDia] IE ${id_institucion} - Docentes: ${resDoc.marcados} faltas marcadas. ${resDoc.mensaje}`);
      } catch (eDoc) {
        console.error(`[CronCierreDia] IE ${id_institucion} - Error en docentes:`, eDoc.message);
      }

    } catch (e) {
      console.error(`[CronCierreDia] Error en IE ${id_institucion}:`, e.message);
    }
  }

  console.log(`[CronCierreDia] ✅ Cierre completado: ${totalEst} falta(s) de estudiantes, ${totalDoc} falta(s) de docentes.`);
}

/**
 * Registra el cron job.
 * Se ejecuta a las 00:00 (medianoche) todos los días.
 * Zona horaria America/Lima para sincronizar con la IE.
 */
function iniciarCron() {
  // '0 0 * * *' = a las 00:00 horas cada día
  cron.schedule('0 0 * * *', ejecutarCierreDia, {
    timezone: 'America/Lima',
  });
  console.log('[CronCierreDia] 🕛 Cron programado: cierre automático a las 00:00 (Lima)');
}

module.exports = { iniciarCron, ejecutarCierreDia };
