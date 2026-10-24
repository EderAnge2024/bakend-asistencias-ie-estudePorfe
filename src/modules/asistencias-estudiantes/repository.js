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
  if (filtros.nivel)   { q += ` AND LOWER(TRIM(m.nivel))=LOWER(TRIM($${i++}))`; vals.push(filtros.nivel); }
  if (filtros.grado)   { q += ` AND (REGEXP_REPLACE(m.grado, '[^0-9]', '', 'g') = REGEXP_REPLACE($${i}, '[^0-9]', '', 'g') OR m.grado ILIKE '%' || $${i} || '%')`; vals.push(filtros.grado); i++; }
  if (filtros.seccion) { q += ` AND UPPER(TRIM(m.seccion))=UPPER(TRIM($${i++}))`; vals.push(filtros.seccion); }
  if (filtros.estado)  { q += ` AND ae.estado_asistencia=$${i++}`; vals.push(filtros.estado); }
  q += ' ORDER BY ae.fecha DESC, e.apellido_paterno';
  const { rows } = await db.query(q, vals);
  return rows;
};

/**
 * Devuelve todos los estudiantes con matricula activa en la institucion
 * que NO tienen asistencia registrada en la fecha indicada.
 */
const findSinRegistroPorFecha = async (id_institucion, fecha) => {
  const { rows } = await db.query(`
    SELECT m.id_matricula, m.id_estudiante, e.nombres, e.apellido_paterno
    FROM matriculas m
    JOIN estudiantes e ON m.id_estudiante = e.id_estudiante
    WHERE m.id_institucion = $1
      AND (m.estado = 'ACTIVO' OR m.estado = 'ACTIVA')
      AND m.id_estudiante NOT IN (
        SELECT ae.id_estudiante
        FROM asistencias_estudiantes ae
        WHERE ae.fecha = $2
          AND ae.id_matricula IN (
            SELECT id_matricula FROM matriculas WHERE id_institucion = $1
          )
      )
  `, [id_institucion, fecha]);
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

/**
 * Informe mensual: matriz estudiante × día con iniciales P/T/F/J.
 * Retorna: [{ id_estudiante, dni, nombres, apellido_paterno, apellido_materno,
 *             nivel, grado, seccion, dias: { "1":"P","5":"T",...} }]
 */
const findInformeMensual = async (id_institucion, mes, anio, filtros = {}) => {
  // Calcular primer y último día del mes
  const fechaInicio = `${anio}-${String(mes).padStart(2,'0')}-01`;
  const ultimoDia   = new Date(anio, mes, 0).getDate();
  const fechaFin    = `${anio}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;

  let whereExtra = '';
  const valsEst = [id_institucion];
  let i = 2;
  if (filtros.nivel)   { whereExtra += ` AND LOWER(TRIM(m.nivel)) = LOWER(TRIM($${i++}))`;   valsEst.push(filtros.nivel); }
  if (filtros.grado)   { whereExtra += ` AND REGEXP_REPLACE(m.grado, '[^0-9]', '', 'g') = REGEXP_REPLACE($${i++}, '[^0-9]', '', 'g')`; valsEst.push(filtros.grado); }
  if (filtros.seccion) { whereExtra += ` AND UPPER(TRIM(m.seccion)) = UPPER(TRIM($${i++}))`;  valsEst.push(filtros.seccion); }

  // Todos los estudiantes matriculados en la institución
  const qEst = `
    SELECT e.id_estudiante, e.dni, e.nombres, e.apellido_paterno, e.apellido_materno,
           m.nivel, m.grado, m.seccion
    FROM matriculas m
    JOIN estudiantes e ON m.id_estudiante = e.id_estudiante
    WHERE m.id_institucion = $1
      AND (m.estado = 'ACTIVO' OR m.estado = 'ACTIVA')
      ${whereExtra}
    ORDER BY m.nivel, m.grado, m.seccion, e.apellido_paterno, e.apellido_materno, e.nombres
  `;
  const { rows: estudiantes } = await db.query(qEst, valsEst);

  if (estudiantes.length === 0) return [];

  // Asistencias del mes para esta institución
  const idsEst = estudiantes.map(e => e.id_estudiante);
  const { rows: asistencias } = await db.query(`
    SELECT ae.id_estudiante,
           EXTRACT(DAY FROM ae.fecha)::int AS dia,
           ae.estado_asistencia
    FROM asistencias_estudiantes ae
    JOIN matriculas m ON ae.id_matricula = m.id_matricula
    WHERE m.id_institucion = $1
      AND ae.fecha BETWEEN $2 AND $3
      AND ae.id_estudiante = ANY($4::int[])
  `, [id_institucion, fechaInicio, fechaFin, idsEst]);

  // Mapa: id_estudiante → { dia → inicial }
  const INICIAL = { PRESENTE: 'P', TARDANZA: 'T', FALTA: 'F', JUSTIFICADO: 'J' };
  const mapa = {};
  asistencias.forEach(a => {
    if (!mapa[a.id_estudiante]) mapa[a.id_estudiante] = {};
    mapa[a.id_estudiante][a.dia] = INICIAL[a.estado_asistencia] || a.estado_asistencia[0];
  });

  return estudiantes.map(e => ({
    ...e,
    dias: mapa[e.id_estudiante] || {},
  }));
};

module.exports = { findByEstudianteYFecha, registrar, registrarSalida, findByEstudiante, findByInstitucion, findSinRegistroPorFecha, findInformeMensual, resumen };