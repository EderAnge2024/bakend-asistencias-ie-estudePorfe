const db = require('../../config/database');

const findByEstudianteYFecha = async (id_estudiante, fecha) => {
  const { rows } = await db.query(
    'SELECT * FROM asistencias_estudiantes WHERE id_estudiante=$1 AND fecha=$2',[id_estudiante,fecha]
  );
  return rows[0]||null;
};

const registrar = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO asistencias_estudiantes
      (id_estudiante,id_matricula,fecha,hora_entrada,estado_asistencia,metodo_registro,
       token_qr_referencia,latitud,longitud,distancia_ie_metros,ip,dispositivo,observaciones)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [d.id_estudiante,d.id_matricula,d.fecha,d.hora_entrada,d.estado_asistencia,d.metodo_registro,
     d.token_qr_referencia||null,d.latitud||null,d.longitud||null,d.distancia_ie_metros||null,
     d.ip||null,d.dispositivo||null,d.observaciones||null]
  );
  return rows[0];
};

const registrarSalida = async (id_asistencia, hora_salida) => {
  const { rows } = await db.query(
    'UPDATE asistencias_estudiantes SET hora_salida=$1, updated_at=CURRENT_TIMESTAMP WHERE id_asistencia=$2 RETURNING *',
    [hora_salida, id_asistencia]
  );
  return rows[0]||null;
};

const findByEstudiante = async (id_estudiante, fecha_inicio, fecha_fin) => {
  const { rows } = await db.query(
    'SELECT * FROM asistencias_estudiantes WHERE id_estudiante=$1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha DESC',
    [id_estudiante, fecha_inicio, fecha_fin]
  );
  return rows;
};

const findByInstitucion = async (id_institucion, filtros) => {
  let q = `SELECT ae.*, e.nombres, e.apellido_paterno, e.dni, m.grado, m.seccion, m.nivel
           FROM asistencias_estudiantes ae
           JOIN estudiantes e ON ae.id_estudiante=e.id_estudiante
           JOIN matriculas m ON ae.id_matricula=m.id_matricula
           WHERE m.id_institucion=$1`;
  const vals=[id_institucion]; let i=2;
  if (filtros.fecha_inicio && filtros.fecha_fin) { q += ` AND ae.fecha BETWEEN $${i++} AND $${i++}`; vals.push(filtros.fecha_inicio); vals.push(filtros.fecha_fin); }
  if (filtros.grado)   { q += ` AND m.grado=$${i++}`;  vals.push(filtros.grado); }
  if (filtros.seccion) { q += ` AND m.seccion=$${i++}`; vals.push(filtros.seccion); }
  if (filtros.estado)  { q += ` AND ae.estado_asistencia=$${i++}`; vals.push(filtros.estado); }
  q += ' ORDER BY ae.fecha DESC, e.apellido_paterno';
  const { rows } = await db.query(q, vals);
  return rows;
};

const resumen = async (id_institucion, fecha_inicio, fecha_fin) => {
  const { rows } = await db.query(`
    SELECT ae.estado_asistencia, COUNT(*) AS total
    FROM asistencias_estudiantes ae
    JOIN matriculas m ON ae.id_matricula=m.id_matricula
    WHERE m.id_institucion=$1 AND ae.fecha BETWEEN $2 AND $3
    GROUP BY ae.estado_asistencia`,
    [id_institucion, fecha_inicio, fecha_fin]
  );
  return rows;
};

module.exports = { findByEstudianteYFecha, registrar, registrarSalida, findByEstudiante, findByInstitucion, resumen };