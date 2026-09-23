const db = require('../../config/database');

const findAll = async ({ id_institucion, anio_lectivo, nivel, grado, seccion, estado, page=1, limit=50 }) => {
  let q = `SELECT m.*, e.nombres, e.apellido_paterno, e.apellido_materno, e.dni, e.codigo_estudiante
           FROM matriculas m JOIN estudiantes e ON m.id_estudiante=e.id_estudiante WHERE m.id_institucion=$1`;
  const vals = [id_institucion]; let i = 2;
  if (anio_lectivo) { q += ` AND m.anio_lectivo=$${i++}`; vals.push(anio_lectivo); }
  if (nivel)        { q += ` AND m.nivel=$${i++}`;        vals.push(nivel); }
  if (grado)        { q += ` AND m.grado=$${i++}`;        vals.push(grado); }
  if (seccion)      { q += ` AND m.seccion=$${i++}`;      vals.push(seccion); }
  if (estado)       { q += ` AND m.estado=$${i++}`;       vals.push(estado); }
  q += ` ORDER BY m.grado, m.seccion, e.apellido_paterno LIMIT $${i++} OFFSET $${i++}`;
  vals.push(Number(limit)); vals.push((Number(page)-1)*Number(limit));
  const { rows } = await db.query(q, vals);
  return rows;
};
const findById = async (id) => {
  const { rows } = await db.query(`
    SELECT m.*, e.nombres, e.apellido_paterno, e.apellido_materno, e.dni
    FROM matriculas m JOIN estudiantes e ON m.id_estudiante=e.id_estudiante WHERE m.id_matricula=$1`, [id]);
  return rows[0]||null;
};
const findActivaByEstudiante = async (id_estudiante, id_institucion) => {
  const { rows } = await db.query(
    "SELECT * FROM matriculas WHERE id_estudiante=$1 AND id_institucion=$2 AND estado='ACTIVO' ORDER BY anio_lectivo DESC LIMIT 1",
    [id_estudiante, id_institucion]
  );
  return rows[0]||null;
};
const create = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO matriculas (id_estudiante,id_institucion,anio_lectivo,nivel,grado,seccion,estado,fecha_matricula)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [d.id_estudiante,d.id_institucion,d.anio_lectivo,d.nivel,d.grado,d.seccion,d.estado||'ACTIVO',d.fecha_matricula||null]
  );
  return rows[0];
};
const update = async (id, d) => {
  const campos=[]; const vals=[]; let i=1;
  for (const k of ['nivel','grado','seccion','estado','fecha_matricula']) {
    if (d[k]!==undefined) { campos.push(`${k}=$${i++}`); vals.push(d[k]); }
  }
  if (!campos.length) return null;
  campos.push('updated_at=CURRENT_TIMESTAMP'); vals.push(id);
  const { rows } = await db.query(`UPDATE matriculas SET ${campos.join(',')} WHERE id_matricula=$${i} RETURNING *`, vals);
  return rows[0]||null;
};
module.exports = { findAll, findById, findActivaByEstudiante, create, update };