const express = require('express');
const router = express.Router();
const ctrl = require('./auth.controller');
const { autenticar } = require('./auth.middleware');
const { ok } = require('../../shared/utils/response');
const dbMonitoreo = require('../../config/databaseMonitoreo');

// Login contra el sistema de monitoreo (DATABASE_URL)
router.post('/login', ctrl.login);

// Retorna la identidad del usuario autenticado, enriquecida con institucion_nombre
router.get('/me', autenticar, async (req, res, next) => {
  try {
    const user = { ...req.user };
    // Si el JWT no trae institucion_nombre, consultarlo desde la BD de monitoreo
    if (!user.institucion_nombre && user.id_institucion && dbMonitoreo) {
      try {
        const { rows } = await dbMonitoreo.query(
          'SELECT nombre FROM instituciones WHERE id_institucion = $1',
          [user.id_institucion]
        );
        if (rows[0]) user.institucion_nombre = rows[0].nombre;
      } catch (_) { /* falla silenciosa */ }
    }
    ok(res, user, 'Identidad verificada correctamente.');
  } catch (e) {
    next(e);
  }
});

module.exports = router;