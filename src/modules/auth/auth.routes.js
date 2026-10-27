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
    
    // Consultar datos actualizados de institucion y docente desde la BD de monitoreo
    if (dbMonitoreo && (user.id_usuario || user.dni)) {
      try {
        const query = `
          SELECT u.id_usuario, u.id_institucion, i.nombre as institucion_nombre,
                 d.id_docente, d.nivel, d.grado, d.seccion, d.tutor, d.grado_tutoria
          FROM usuarios u
          LEFT JOIN instituciones i ON u.id_institucion = i.id_institucion
          LEFT JOIN docentes d ON u.id_usuario = d.id_usuario
          WHERE u.id_usuario = $1 OR u.dni = $2
        `;
        const { rows } = await dbMonitoreo.query(query, [user.id_usuario, user.dni]);
        if (rows[0]) {
          const row = rows[0];
          if (row.institucion_nombre) user.institucion_nombre = row.institucion_nombre;
          if (row.id_docente) user.id_docente = row.id_docente;
          if (row.nivel) user.nivel = row.nivel;

          const isTutor = Boolean(
            row.tutor === true ||
            String(row.tutor).toLowerCase() === 'true' ||
            String(row.tutor).toLowerCase() === 'si' ||
            String(row.tutor).toLowerCase() === 't' ||
            row.tutor === 1 ||
            row.tutor === '1' ||
            !!row.grado_tutoria
          );
          user.tutor = isTutor;

          if (row.grado_tutoria) {
            const str = String(row.grado_tutoria).trim();
            const matchNum = str.match(/\d+/);
            const matchLetra = str.match(/["']([A-Za-z])["']/) || str.match(/\b([A-Za-z])\b/);
            let sec = matchLetra ? matchLetra[1].toUpperCase() : null;
            if (!sec) {
              const s = row.seccion ? String(row.seccion).trim().toUpperCase() : 'A';
              sec = (s === 'UNICA' || s === 'ÚNICA') ? 'A' : s;
            }
            user.grado = matchNum ? matchNum[0] : row.grado;
            user.seccion = sec;
            user.grado_tutoria = row.grado_tutoria;
          } else {
            if (row.grado) user.grado = row.grado;
            if (row.seccion) user.seccion = row.seccion;
          }
        }
      } catch (_) { /* falla silenciosa */ }
    }
    ok(res, user, 'Identidad verificada correctamente.');
  } catch (e) {
    next(e);
  }
});

module.exports = router;