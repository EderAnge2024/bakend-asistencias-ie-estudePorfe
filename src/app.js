/**
 * app.js - Configuracion principal de Express
 * Sistema de Asistencias IE
 */
const express      = require('express');
const cors         = require('cors');
const errorHandler = require('./shared/middleware/errorHandler');

const app = express();

// -------------------------------------------------------
// Middlewares globales
// -------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------------------------------------
// Health check
// -------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ success: true, sistema: 'Sistema de Asistencias IE', ts: new Date().toISOString() });
});

// -------------------------------------------------------
// Ruta raíz - Bienvenida
// -------------------------------------------------------
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Sistema de Asistencias IE',
    version: 'v1',
    health: '/health',
    api: '/api/v1'
  });
});

// -------------------------------------------------------
// Rutas de la API v1
// -------------------------------------------------------
const BASE = '/api/v1';

app.use(`${BASE}/auth`,                    require('./modules/auth/auth.routes'));
app.use(`${BASE}/configuracion`,           require('./modules/configuracion/configuracion.routes'));
app.use(`${BASE}/horarios`,                require('./modules/horarios/horarios.routes'));
app.use(`${BASE}/eventos`,                 require('./modules/eventos/eventos.routes'));
const asistenciasDocentesRoutes = require('./modules/asistencias-docentes/routes');
const asistenciasEstudiantesRoutes = require('./modules/asistencias-estudiantes/routes');

app.use(`${BASE}/asistencias/docentes`,    asistenciasDocentesRoutes);
app.use(`${BASE}/asistencias/docente`,     asistenciasDocentesRoutes);
app.use(`${BASE}/asistencia/docentes`,     asistenciasDocentesRoutes);
app.use(`${BASE}/asistencia/docente`,      asistenciasDocentesRoutes);
app.use(`${BASE}/asistencias-docentes`,    asistenciasDocentesRoutes);
app.use(`${BASE}/asistencia-docentes`,     asistenciasDocentesRoutes);
app.use(`${BASE}/asistencia-docente`,      asistenciasDocentesRoutes);

app.use(`${BASE}/estudiantes`,             require('./modules/estudiantes/estudiantes.routes'));
app.use(`${BASE}/matriculas`,              require('./modules/matriculas/matriculas.routes'));
app.use(`${BASE}/qr`,                      require('./modules/qr/qr.routes'));

app.use(`${BASE}/asistencias/estudiantes`, asistenciasEstudiantesRoutes);
app.use(`${BASE}/asistencias/estudiante`,  asistenciasEstudiantesRoutes);
app.use(`${BASE}/asistencia/estudiantes`,  asistenciasEstudiantesRoutes);
app.use(`${BASE}/asistencia/estudiante`,   asistenciasEstudiantesRoutes);
app.use(`${BASE}/asistencias-estudiantes`, asistenciasEstudiantesRoutes);
app.use(`${BASE}/asistencia-estudiantes`,  asistenciasEstudiantesRoutes);
app.use(`${BASE}/asistencia-estudiante`,   asistenciasEstudiantesRoutes);

// -------------------------------------------------------
// 404
// -------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada.', error: 'NOT_FOUND' });
});

// -------------------------------------------------------
// Manejador global de errores (debe ir ultimo)
// -------------------------------------------------------
app.use(errorHandler);

module.exports = app;