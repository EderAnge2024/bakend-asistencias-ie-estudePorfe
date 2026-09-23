const express = require('express');
const router = express.Router();
const ctrl = require('./auth.controller');
const { autenticar } = require('./auth.middleware');
const { ok } = require('../../shared/utils/response');

// Login contra el sistema de monitoreo (DATABASE_URL)
router.post('/login', ctrl.login);

// Retorna la identidad del usuario autenticado
router.get('/me', autenticar, (req, res) => {
  ok(res, req.user, 'Identidad verificada correctamente.');
});

module.exports = router;