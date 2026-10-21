const db = require('../../config/database');

const findAll = async ({ busqueda, estado, page=1, limit=50 }) => {
  let q = 'SELECT * FROM estudiantes WHERE 1=1';
  const vals = []; let i = 1;
  if (estado !== undefined) { q += ` AND estado=$${i++}`; vals.push(estado === 'true' || estado === true); }
  if (busqueda) {
    q += ` AND (nombres ILIKE $${i} OR apellido_paterno ILIKE $${i} OR apellido_materno ILIKE $${i} OR dni=$${i+1} OR codigo_estudiante=$${i+1})`;
    vals.push(`%${busqueda}%`); i++; vals.push(busqueda); i++;
  }
  q += ` ORDER BY apellido_paterno, apellido_materno, nombres LIMIT $${i++} OFFSET $${i++}`;
  vals.push(Number(limit)); vals.push((Number(page)-1)*Number(limit));
  const { rows } = await db.query(q, vals);
  return rows;
};
const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM estudiantes WHERE id_estudiante=$1',[id]);
  return rows[0]||null;
};
const findByDni = async (dni) => {
  const { rows } = await db.query('SELECT * FROM estudiantes WHERE dni=$1',[dni]);
  return rows[0]||null;
};
const findByCodigo = async (codigo) => {
  const { rows } = await db.query('SELECT * FROM estudiantes WHERE codigo_estudiante=$1',[codigo]);
  return rows[0]||null;
};
const create = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO estudiantes (codigo_estudiante,dni,nombres,apellido_paterno,apellido_materno)
    VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [d.codigo_estudiante||null,d.dni||null,d.nombres,d.apellido_paterno,d.apellido_materno||null]
  );
  return rows[0];
};
const update = async (id, d) => {
  const campos=[]; const vals=[]; let i=1;
  for (const k of ['codigo_estudiante','dni','nombres','apellido_paterno','apellido_materno']) {
    if (d[k]!==undefined) { campos.push(`${k}=$${i++}`); vals.push(d[k]); }
  }
  if (!campos.length) return null;
  campos.push('updated_at=CURRENT_TIMESTAMP'); vals.push(id);
  const { rows } = await db.query(`UPDATE estudiantes SET ${campos.join(',')} WHERE id_estudiante=$${i} RETURNING *`, vals);
  return rows[0]||null;
};
const toggleEstado = async (id, estado) => {
  const { rows } = await db.query(
    'UPDATE estudiantes SET estado=$1, updated_at=CURRENT_TIMESTAMP WHERE id_estudiante=$2 RETURNING *',[estado,id]
  );
  return rows[0]||null;
};

const findMisEstudiantes = async (id_institucion, nivel, grado, seccion) => {
  // CORRECCIÓN: Se agrega filtro por nivel para separar correctamente
  // estudiantes de Primaria y Secundaria cuando coinciden grado y sección.
  // También incluye el estado de asistencia del día actual via LEFT JOIN.
  const query = `
    SELECT e.*, m.id_matricula, m.nivel, m.grado, m.seccion,
           ae.estado_asistencia AS _asistencia_hoy,
           ae.hora_entrada      AS _hora_entrada_hoy
    FROM estudiantes e
    JOIN matriculas m ON e.id_estudiante = m.id_estudiante
    LEFT JOIN asistencias_estudiantes ae
      ON ae.id_estudiante = e.id_estudiante
     AND ae.fecha = CURRENT_DATE
    WHERE m.id_institucion = $1
      AND (
        $2::text IS NULL OR $2 = ''
        OR LOWER(TRIM(m.nivel)) = LOWER(TRIM($2))
      )
      AND (
        $3::text IS NULL OR $3 = ''
        OR REGEXP_REPLACE(m.grado, '[^0-9]', '', 'g') = REGEXP_REPLACE($3, '[^0-9]', '', 'g')
        OR m.grado ILIKE '%' || $3 || '%'
      )
      AND (
        $4::text IS NULL OR $4 = ''
        OR UPPER(TRIM(m.seccion)) = UPPER(TRIM($4))
      )
      AND m.estado = 'ACTIVO'
      AND e.estado = true
    ORDER BY e.apellido_paterno, e.apellido_materno, e.nombres
  `;
  const { rows } = await db.query(query, [id_institucion, nivel, grado, seccion]);
  return rows;
};


module.exports = { findAll, findById, findByDni, findByCodigo, create, update, toggleEstado, findMisEstudiantes };