const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbMonitoreo = require('../../config/databaseMonitoreo');
const { JWT_SECRET } = require('../../config/security');
const AppError = require('../../shared/errors/AppError');

function parseGradoTutoria(gradoTutoria, fallbackGrado, fallbackSeccion) {
  if (!gradoTutoria) return { grado: fallbackGrado, seccion: fallbackSeccion };
  const str = String(gradoTutoria).trim();
  const matchNum = str.match(/\d+/);
  const matchLetra = str.match(/[A-Za-z]/);
  return {
    grado: matchNum ? matchNum[0] : fallbackGrado,
    seccion: matchLetra ? matchLetra[0].toUpperCase() : fallbackSeccion
  };
}

/**
 * Autentica un usuario contra la BD externa del sistema de monitoreo
 * (DATABASE_URL).
 */
const login = async (dni, password) => {
  if (!dni || !password) {
    throw new AppError('DNI y contraseña son obligatorios.', 'MISSING_CREDENTIALS', 400);
  }

  // Consulta exacta a la estructura de la BD de monitoreo
  // Se agrega LEFT JOIN docentes para capturar el id_docente y su asignación
  const query = `
    SELECT u.id_usuario, u.dni, u.nombres, u.apellidos, u.correo, u.password, u.id_institucion, u.estado,
           r.nombre as rol, i.nombre as institucion_nombre,
           d.id_docente, d.nivel, d.grado, d.seccion, d.tutor, d.grado_tutoria
    FROM usuarios u
    JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
    JOIN roles r ON ur.id_rol = r.id_rol
    LEFT JOIN instituciones i ON u.id_institucion = i.id_institucion
    LEFT JOIN docentes d ON u.id_usuario = d.id_usuario
    WHERE u.dni = $1 AND u.estado = TRUE
  `;

  const { rows } = await dbMonitoreo.query(query, [dni]);
  const user = rows[0];

  if (!user) {
    throw new AppError('Usuario no encontrado o inactivo.', 'USER_NOT_FOUND', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Contraseña incorrecta.', 'INVALID_PASSWORD', 401);
  }

  // Determinar grado y sección reales de tutoría (ej. grado_tutoria = '2 "B"' -> grado: '2', seccion: 'B')
  let gradoFinal = user.grado || null;
  let seccionFinal = user.seccion || null;

  if (user.tutor && user.grado_tutoria) {
    const parsed = parseGradoTutoria(user.grado_tutoria, user.grado, user.seccion);
    gradoFinal = parsed.grado;
    seccionFinal = parsed.seccion;
  }

  // Generar JWT usando el secreto compartido
  const token = jwt.sign(
    { 
      id_usuario: user.id_usuario,
      id: user.id_usuario,
      id_docente: user.id_docente || null,
      id_institucion: user.id_institucion,
      dni: user.dni,
      nombres: user.nombres,
      apellidos: user.apellidos,
      rol: user.rol,
      role: user.rol,
      nivel: user.nivel || null,
      grado: gradoFinal,
      seccion: seccionFinal,
      tutor: user.tutor || false,
      grado_tutoria: user.grado_tutoria || null
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    user: {
      id_usuario: user.id_usuario,
      id_docente: user.id_docente || null,
      id_institucion: user.id_institucion,
      dni: user.dni,
      nombres: user.nombres,
      apellidos: user.apellidos,
      rol: user.rol,
      institucion_nombre: user.institucion_nombre,
      nivel: user.nivel || null,
      grado: gradoFinal,
      seccion: seccionFinal,
      tutor: user.tutor || false,
      grado_tutoria: user.grado_tutoria || null
    }
  };
};

module.exports = { login };