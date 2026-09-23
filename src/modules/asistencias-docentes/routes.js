const express = require('express');
const router  = express.Router();
const ctrl    = require('./controller');
const { autenticar } = require('../auth/auth.middleware');
const { authorize }  = require('../../shared/middleware/authorize');
const ADMIN = authorize('DIRECTOR','ADMIN','SUBDIRECTOR','ESPECIALISTA','SECRETARIO');

router.post('/entrada',              autenticar,        ctrl.entrada);
router.post('/salida',               autenticar,        ctrl.salida);
router.get('/mia',                   autenticar,        ctrl.mia);
router.get('/docente/:id_docente',   autenticar, ADMIN, ctrl.porDocente);
router.get('/',                      autenticar, ADMIN, ctrl.porInstitucion);
router.get('/resumen',               autenticar, ADMIN, ctrl.resumen);

module.exports = router;