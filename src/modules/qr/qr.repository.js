const db = require('../../config/database');

const findByEstudiante = async (id_estudiante) => {
  const { rows } = await db.query(
    'SELECT * FROM credenciales_qr_estudiantes WHERE id_estudiante=$1 ORDER BY fecha_emision DESC',[id_estudiante]
  );
  return rows;
};
const findByToken = async (token_qr) => {
  const { rows } = await db.query(
    'SELECT c.*, e.nombres, e.apellido_paterno, e.apellido_materno, e.dni, e.codigo_estudiante, e.estado as est_estudiante FROM credenciales_qr_estudiantes c JOIN estudiantes e ON c.id_estudiante=e.id_estudiante WHERE c.token_qr=$1',
    [token_qr]
  );
  return rows[0]||null;
};
const findActivaByEstudiante = async (id_estudiante) => {
  const { rows } = await db.query(
    'SELECT * FROM credenciales_qr_estudiantes WHERE id_estudiante=$1 AND estado=TRUE ORDER BY fecha_emision DESC LIMIT 1',
    [id_estudiante]
  );
  return rows[0]||null;
};
const create = async (d) => {
  const { rows } = await db.query(
    'INSERT INTO credenciales_qr_estudiantes (id_estudiante,token_qr,fecha_expiracion) VALUES ($1,$2,$3) RETURNING *',
    [d.id_estudiante, d.token_qr, d.fecha_expiracion||null]
  );
  return rows[0];
};
const desactivarTodas = async (id_estudiante) => {
  await db.query(
    'UPDATE credenciales_qr_estudiantes SET estado=FALSE, updated_at=CURRENT_TIMESTAMP WHERE id_estudiante=$1 AND estado=TRUE',
    [id_estudiante]
  );
};
const toggleEstado = async (id, estado) => {
  const { rows } = await db.query(
    'UPDATE credenciales_qr_estudiantes SET estado=$1, updated_at=CURRENT_TIMESTAMP WHERE id_credencial=$2 RETURNING *',
    [estado, id]
  );
  return rows[0]||null;
};
module.exports = { findByEstudiante, findByToken, findActivaByEstudiante, create, desactivarTodas, toggleEstado };