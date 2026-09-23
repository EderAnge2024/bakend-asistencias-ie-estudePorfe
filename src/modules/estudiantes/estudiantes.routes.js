const express = require('express');
const router  = express.Router();
const ctrl    = require('./estudiantes.controller');
const { autenticar } = require('../auth/auth.middleware');
const { authorize }  = require('../../shared/middleware/authorize');
const ADMIN = authorize('DIRECTOR','ADMIN','SUBDIRECTOR','SECRETARIO');
const DOCENTE = authorize('DOCENTE','DIRECTOR','ADMIN');

router.get('/mis-estudiantes', autenticar, DOCENTE, ctrl.listarMisEstudiantes);
router.post('/carga-masiva',    autenticar, ADMIN, ctrl.cargaMasiva);
router.get('/',              autenticar, ADMIN, ctrl.listar);
router.get('/:id',           autenticar, ADMIN, ctrl.obtener);
router.post('/',             autenticar, ADMIN, ctrl.crear);
router.put('/:id',           autenticar, ADMIN, ctrl.actualizar);
router.patch('/:id/estado',  autenticar, ADMIN, ctrl.toggleEstado);
module.exports = router;