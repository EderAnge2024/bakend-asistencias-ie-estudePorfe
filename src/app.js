/**
 * app.js - Configuracion principal de Express
 * Sistema de Asistencias IE
 */
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const errorHandler = require('./shared/middleware/errorHandler');

const app = express();

// -------------------------------------------------------
// CORS – Whitelist explícita (APK Capacitor + desarrollo)
// Peticiones sin Origin (nativas Android, health checks de Render) → permitidas
// -------------------------------------------------------
const origenesPermitidos = [
  'http://localhost',           // APK Capacitor Android (HTTP)
  'https://localhost',          // APK Capacitor Android (HTTPS - WebView moderno)
  'capacitor://localhost',      // APK Capacitor (iOS / Android alt)
  'http://localhost:5173',      // Vite dev frontend
  'https://localhost:5173',
  'http://localhost:3000',      // Dev local alternativo
  'https://localhost:3000',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Sin origin → petición nativa (APK sin WebView, Render health check) → OK
    if (!origin) return callback(null, true);
    if (origenesPermitidos.includes(origin)) return callback(null, true);
    // Bloquear cualquier otro origen desconocido
    return callback(new Error(`Origen no autorizado: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,   // No se usan cookies; JWT va en header
}));

// -------------------------------------------------------
// Helmet – Cabeceras de seguridad HTTP
// CSP desactivado (API REST, sin HTML propio)
// crossOriginResourcePolicy abierto para Capacitor WebView
// -------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// -------------------------------------------------------
// Rate Limit – SOLO para login (protección contra fuerza bruta)
// 10 intentos por IP cada 15 minutos; NO afecta QR ni otras rutas
// -------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                    // Máximo 10 intentos por IP
  standardHeaders: true,      // Incluye RateLimit-* headers estándar
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar logins exitosos
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Demasiados intentos de inicio de sesión. Espera 15 minutos e intenta nuevamente.',
  },
});

// -------------------------------------------------------
// Middlewares globales
// -------------------------------------------------------
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

app.use(`${BASE}/auth`,                    loginLimiter, require('./modules/auth/auth.routes'));
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