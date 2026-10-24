const express = require('express');
const router  = express.Router();
const ctrl    = require('./controller');
const { autenticar } = require('../auth/auth.middleware');
const { authorize }  = require('../../shared/middleware/authorize');

const ADMIN = authorize('DIRECTOR','ADMIN','ADMINISTRADOR','SUBDIRECTOR','ESPECIALISTA','SECRETARIO','DOCENTE');
const SOLO_ADMIN = authorize('DIRECTOR','ADMIN','ADMINISTRADOR','SUBDIRECTOR','SECRETARIO');

router.post('/qr',                               autenticar,             ctrl.registrarQR);
router.post('/registro-qr',                      autenticar,             ctrl.registrarQR);
router.post('/manual',                           autenticar, ADMIN,      ctrl.registrarManual);
router.post('/registro-manual',                  autenticar, ADMIN,      ctrl.registrarManual);
router.post('/salida/:id_estudiante',            autenticar, ADMIN,      ctrl.salida);
router.post('/:id_estudiante/salida',            autenticar, ADMIN,      ctrl.salida);
router.post('/cerrar-dia',                       autenticar, SOLO_ADMIN, ctrl.cerrarDia);

router.get('/informe-mensual',                   autenticar, ADMIN,      ctrl.informeMensual);
router.get('/estudiante/:id_estudiante',         autenticar, ADMIN,      ctrl.porEstudiante);
router.get('/institucion',                       autenticar, ADMIN,      ctrl.porInstitucion);
router.get('/',                                  autenticar, ADMIN,      ctrl.porInstitucion);
router.get('/historial',                         autenticar, ADMIN,      ctrl.porInstitucion);
router.get('/resumen',                           autenticar, ADMIN,      ctrl.resumen);

module.exports = router;