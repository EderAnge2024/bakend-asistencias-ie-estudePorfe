const express = require('express');
const router  = express.Router();
const ctrl    = require('./horarios.controller');
const { autenticar } = require('../auth/auth.middleware');
const { authorize }  = require('../../shared/middleware/authorize');
const ADMIN = authorize('DIRECTOR','ADMIN','SUBDIRECTOR');

router.get('/',         autenticar,        ctrl.listar);
router.get('/:id',      autenticar,        ctrl.obtener);
router.post('/',        autenticar, ADMIN, ctrl.crear);
router.put('/:id',      autenticar, ADMIN, ctrl.actualizar);
router.delete('/:id',   autenticar, ADMIN, ctrl.desactivar);

module.exports = router;