const express = require('express');
const router  = express.Router();
const ctrl    = require('./qr.controller');
const { autenticar } = require('../auth/auth.middleware');
const { authorize }  = require('../../shared/middleware/authorize');
const ADMIN = authorize('DIRECTOR','ADMIN','SUBDIRECTOR','SECRETARIO','DOCENTE');

// Consultar QR por estudiante
router.get('/estudiante/:id_estudiante',              autenticar, ADMIN, ctrl.consultar);

// Generar QR (acepta POST /qr/generar { id_estudiante } o POST /qr/estudiante/:id_estudiante)
router.post('/generar',                               autenticar, ADMIN, ctrl.generar);
router.post('/estudiante/:id_estudiante',             autenticar, ADMIN, ctrl.generar);

// Renovar
router.put('/:id/estudiante/:id_estudiante/renovar',  autenticar, ADMIN, ctrl.renovar);

// Invalidar / Desactivar
router.patch('/:id/invalidar',                        autenticar, ADMIN, ctrl.desactivar);
router.patch('/:id/desactivar',                       autenticar, ADMIN, ctrl.desactivar);
router.delete('/:id/desactivar',                      autenticar, ADMIN, ctrl.desactivar);

// Validar
router.post('/validar',                               autenticar,        ctrl.validar);
router.get('/validar/:token',                        autenticar,        ctrl.validar);

module.exports = router;