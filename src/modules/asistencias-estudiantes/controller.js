const svc = require('./service');
const { ok, created } = require('../../shared/utils/response');

/**
 * POST /qr  y  POST /registro-qr
 * Primer escaneo  → 201 Created  (ingreso)
 * Segundo escaneo → 200 OK       (salida, marcado con _accion='SALIDA')
 * Ya completo     → 409 lanzado por el service (AppError ATTENDANCE_COMPLETE)
 */
const registrarQR = async (req, res, next) => {
  try {
    const data = await svc.registrarPorQR(req.user, req.body);
    if (data._accion === 'SALIDA') {
      ok(res, data, 'Salida registrada.');
    } else {
      created(res, data, 'Ingreso registrado.');
    }
  } catch (e) { next(e); }
};

const registrarManual   = async (req,res,next) => { try { created(res, await svc.registrarManual(req.user, req.body), 'Asistencia manual registrada.'); } catch(e){next(e);} };
const salida            = async (req,res,next) => { try { ok(res, await svc.registrarSalida(req.user, req.params.id_estudiante), 'Salida registrada.'); } catch(e){next(e);} };
const porEstudiante     = async (req,res,next) => { try { ok(res, await svc.consultarPorEstudiante(req.params.id_estudiante, req.query)); } catch(e){next(e);} };
const porInstitucion    = async (req,res,next) => { try { ok(res, await svc.consultarInstitucion(req.user.id_institucion, req.query)); } catch(e){next(e);} };
const resumen           = async (req,res,next) => { try { ok(res, await svc.resumen(req.user.id_institucion, req.query), 'Resumen.'); } catch(e){next(e);} };
const cerrarDia         = async (req,res,next) => { try { ok(res, await svc.cerrarDia(req.user, req.body?.fecha), 'Cierre de día completado.'); } catch(e){next(e);} };
const informeMensual    = async (req,res,next) => { try { ok(res, await svc.informeMensual(req.user.id_institucion, req.query), 'Informe mensual.'); } catch(e){next(e);} };
module.exports = { registrarQR, registrarManual, salida, porEstudiante, porInstitucion, resumen, cerrarDia, informeMensual };
