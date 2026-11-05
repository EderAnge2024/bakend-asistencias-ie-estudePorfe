const db = require('../../config/database');

const findByEstudianteYFecha = async (id_estudiante, fecha) => {
  const { rows } = await db.query(
    'SELECT * FROM asistencias_estudiantes WHERE id_estudiante=$1 AND fecha=$2', [id_estudiante, fecha]
  );
  return rows[0] || null;
};

const registrar = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO asistencias_estudiantes
      (id_estudiante, id_matricula, fecha, hora_entrada, estado_asistencia, metodo_registro,
       token_qr_referencia, latitud, longitud, distancia_ie_metros, ip, dispositivo, observaciones,
       registrado_por, rol_registro)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      d.id_estudiante,
      d.id_matricula,
      d.fecha,
      d.hora_entrada,
      d.estado_asistencia,
      d.metodo_registro,
      d.token_qr_referencia || null,
      d.latitud || null,
      d.longitud || null,
      d.distancia_ie_metros || null,
      d.ip || null,
      d.dispositivo || null,
      d.observaciones || null,
      d.registrado_por || null,
      d.rol_registro || null,
    ]
  );
  return rows[0];
};

const registrarSalida = async (id_asistencia, hora_salida) => {
  const { rows } = await db.query(
    'UPDATE asistencias_estudiantes SET hora_salida=$1, updated_at=CURRENT_TIMESTAMP WHERE id_asistencia=$2 RETURNING *',
    [hora_salida, id_asistencia]
  );
  return rows[0] || null;
};

const findByEstudiante = async (id_estudiante, fecha_inicio, fecha_fin) => {
  const { rows } = await db.query(
    'SELECT * FROM asistencias_estudiantes WHERE id_estudiante=$1 AND fecha BETWEEN $2 AND $3 ORDER BY fecha DESC',
    [id_estudiante, fecha_inicio, fecha_fin]
  );
  return rows;
};

const findByInstitucion = async (id_institucion, filtros) => {
  let q = `SELECT ae.*, e.nombres, e.apellido_paterno, e.apellido_materno, e.dni, m.grado, m.seccion, m.nivel
           FROM asistencias_estudiantes ae
           JOIN estudiantes e ON ae.id_estudiante=e.id_estudiante
           JOIN matriculas m ON ae.id_matricula=m.id_matricula
           WHERE m.id_institucion=$1`;
  const vals = [id_institucion];
  let i = 2;
  if (filtros.fecha_inicio && filtros.fecha_fin) {
    q += ` AND ae.fecha BETWEEN $${i++} AND $${i++}`;
    vals.push(filtros.fecha_inicio);
    vals.push(filtros.fecha_fin);
  }
  if (filtros.nivel) {
    q += ` AND LOWER(TRIM(m.nivel))=LOWER(TRIM($${i++}))`;
    vals.push(filtros.nivel);
  }
  if (filtros.grado) {
    q += ` AND (REGEXP_REPLACE(m.grado, '[^0-9]', '', 'g') = REGEXP_REPLACE($${i}, '[^0-9]', '', 'g') OR m.grado ILIKE '%' || $${i} || '%')`;
    vals.push(filtros.grado);
    i++;
  }
  if (filtros.seccion) {
    q += ` AND UPPER(TRIM(m.seccion))=UPPER(TRIM($${i++}))`;
    vals.push(filtros.seccion);
  }
  if (filtros.estado) {
    q += ` AND ae.estado_asistencia=$${i++}`;
    vals.push(filtros.estado);
  }
  q += ' ORDER BY ae.fecha DESC, e.apellido_paterno';
  const { rows } = await db.query(q, vals);
  return rows;
};

/**
 * Búsqueda de estudiantes para el Director con estado de asistencia de hoy.
 * Permite buscar por Nombres, Apellidos, DNI o filtrar por Nivel, Grado y Sección.
 */
const buscarEstudiantesParaAsistencia = async (id_institucion, { busqueda, nivel, grado, seccion, fecha }) => {
  const fechaConsulta = fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

  let q = `
    SELECT e.id_estudiante, e.codigo_estudiante, e.dni, e.nombres, e.apellido_paterno, e.apellido_materno,
           m.id_matricula, m.nivel, m.grado, m.seccion, m.anio_lectivo,
           ae.id_asistencia     AS _id_asistencia,
           ae.estado_asistencia AS _asistencia_hoy,
           ae.hora_entrada      AS _hora_entrada_hoy,
           ae.hora_salida       AS _hora_salida_hoy,
           ae.metodo_registro   AS _metodo_registro
    FROM estudiantes e
    JOIN matriculas m ON e.id_estudiante = m.id_estudiante
    LEFT JOIN asistencias_estudiantes ae
      ON ae.id_estudiante = e.id_estudiante
     AND ae.fecha = $2
    WHERE m.id_institucion = $1
      AND (m.estado = 'ACTIVO' OR m.estado = 'ACTIVA')
      AND e.estado = true
  `;

  const vals = [id_institucion, fechaConsulta];
  let i = 3;

  if (nivel && nivel.trim()) {
    q += ` AND LOWER(TRIM(m.nivel)) = LOWER(TRIM($${i++}))`;
    vals.push(nivel.trim());
  }

  if (grado && grado.trim()) {
    const soloNum = grado.replace(/[^0-9]/g, '');
    if (soloNum) {
      q += ` AND (REGEXP_REPLACE(m.grado, '[^0-9]', '', 'g') = $${i++})`;
      vals.push(soloNum);
    } else {
      q += ` AND m.grado ILIKE '%' || $${i++} || '%'`;
      vals.push(grado.trim());
    }
  }

  if (seccion && seccion.trim()) {
    const secStr = seccion.trim().toUpperCase();
    if (secStr !== 'TODAS' && secStr !== 'TODOS') {
      q += ` AND UPPER(TRIM(m.seccion)) = UPPER(TRIM($${i++}))`;
      vals.push(secStr);
    }
  }

  if (busqueda && busqueda.trim()) {
    const term = `%${busqueda.trim()}%`;
    q += ` AND (
      e.nombres ILIKE $${i}
      OR e.apellido_paterno ILIKE $${i}
      OR e.apellido_materno ILIKE $${i}
      OR (e.apellido_paterno || ' ' || COALESCE(e.apellido_materno, '') || ' ' || e.nombres) ILIKE $${i}
      OR e.dni ILIKE $${i}
      OR e.codigo_estudiante ILIKE $${i}
    )`;
    vals.push(term);
    i++;
  }

  q += ` ORDER BY m.nivel, m.grado, m.seccion, e.apellido_paterno, e.apellido_materno, e.nombres LIMIT 300`;

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
 * Informe mensual: matriz estudiante × día con iniciales P/T/F/J
 * Incluye cálculo de faltas acumuladas del año lectivo y alertas de 4, >4 y 54 (RETIRO).
 */
const findInformeMensual = async (id_institucion, mes, anio, filtros = {}) => {
  const fechaInicio = `${anio}-${String(mes).padStart(2,'0')}-01`;
  const ultimoDia   = new Date(anio, mes, 0).getDate();
  const fechaFin    = `${anio}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;

  let whereExtra = '';
  const valsEst = [id_institucion];
  let i = 2;
  if (filtros.nivel && String(filtros.nivel).trim() !== '' && String(filtros.nivel).toUpperCase() !== 'NIVEL') {
    whereExtra += ` AND LOWER(TRIM(m.nivel)) = LOWER(TRIM($${i++}))`;
    valsEst.push(String(filtros.nivel).trim());
  }

  if (filtros.grado && String(filtros.grado).trim() !== '') {
    const gradoStr = String(filtros.grado).trim();
    const soloNum = gradoStr.replace(/[^0-9]/g, '');
    if (soloNum && soloNum.length <= 2) {
      whereExtra += ` AND REGEXP_REPLACE(m.grado, '[^0-9]', '', 'g') = $${i++}`;
      valsEst.push(soloNum);
    } else if (!gradoStr.includes('-')) {
      whereExtra += ` AND (REGEXP_REPLACE(m.grado, '[^0-9]', '', 'g') = REGEXP_REPLACE($${i}, '[^0-9]', '', 'g') OR m.grado ILIKE '%' || $${i} || '%')`;
      valsEst.push(gradoStr);
      i++;
    }
  }

  if (filtros.seccion && String(filtros.seccion).trim() !== '') {
    const secStr = String(filtros.seccion).trim().toUpperCase();
    if (secStr !== 'UNICA' && secStr !== 'ÚNICA' && secStr !== 'TODAS' && secStr !== 'TODOS' && secStr !== 'TODOS/AS') {
      whereExtra += ` AND UPPER(TRIM(m.seccion)) = UPPER(TRIM($${i++}))`;
      valsEst.push(secStr);
    }
  }

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

  const idsEst = estudiantes.map(e => e.id_estudiante);

  // Asistencias del mes
  const { rows: asistencias } = await db.query(`
    SELECT ae.id_estudiante,
           EXTRACT(DAY FROM ae.fecha)::int AS dia,
           ae.estado_asistencia,
           ae.hora_entrada,
           ae.hora_salida
    FROM asistencias_estudiantes ae
    JOIN matriculas m ON ae.id_matricula = m.id_matricula
    WHERE m.id_institucion = $1
      AND ae.fecha BETWEEN $2 AND $3
      AND ae.id_estudiante = ANY($4::bigint[])
  `, [id_institucion, fechaInicio, fechaFin, idsEst]);

  // Faltas acumuladas del año lectivo para control de inasistencias acumuladas y RETIRO (>= 54)
  const { rows: faltasAnioRows } = await db.query(`
    SELECT ae.id_estudiante, COUNT(*) AS total_faltas_anio
    FROM asistencias_estudiantes ae
    JOIN matriculas m ON ae.id_matricula = m.id_matricula
    WHERE m.id_institucion = $1
      AND EXTRACT(YEAR FROM ae.fecha) = $2
      AND ae.estado_asistencia = 'FALTA'
      AND ae.id_estudiante = ANY($3::bigint[])
    GROUP BY ae.id_estudiante
  `, [id_institucion, anio, idsEst]);

  const mapaFaltasAnio = {};
  faltasAnioRows.forEach(r => {
    mapaFaltasAnio[r.id_estudiante] = parseInt(r.total_faltas_anio, 10) || 0;
  });

  const INICIAL = { PRESENTE: 'P', TARDANZA: 'T', FALTA: 'F', JUSTIFICADO: 'J' };
  const mapa = {};
  const mapaDetalle = {};

  asistencias.forEach(a => {
    if (!mapa[a.id_estudiante]) mapa[a.id_estudiante] = {};
    if (!mapaDetalle[a.id_estudiante]) mapaDetalle[a.id_estudiante] = {};
    mapa[a.id_estudiante][a.dia] = INICIAL[a.estado_asistencia] || a.estado_asistencia[0];
    mapaDetalle[a.id_estudiante][a.dia] = {
      estado: a.estado_asistencia,
      hora_entrada: a.hora_entrada,
      hora_salida: a.hora_salida,
      completa: Boolean(a.hora_entrada && a.hora_salida),
    };
  });

  return estudiantes.map(e => {
    const mapaEst = mapa[e.id_estudiante] || {};
    let fCountMes = 0;
    Object.values(mapaEst).forEach(val => { if (val === 'F') fCountMes++; });
    const faltasAcumuladas = Math.max(fCountMes, mapaFaltasAnio[e.id_estudiante] || 0);

    let alertaFaltas = 'NORMAL';
    if (faltasAcumuladas >= 54) {
      alertaFaltas = 'RETIRO';
    } else if (faltasAcumuladas > 4) {
      alertaFaltas = 'CRITICA';
    } else if (faltasAcumuladas === 4) {
      alertaFaltas = 'ALERTA';
    }

    return {
      ...e,
      dias: mapaEst,
      dias_detalle: mapaDetalle[e.id_estudiante] || {},
      total_completas: Object.values(mapaDetalle[e.id_estudiante] || {}).filter(d => d.completa).length,
      total_faltas_mes: fCountMes,
      total_faltas_acumuladas: faltasAcumuladas,
      alerta_faltas: alertaFaltas,
    };
  });
};

module.exports = {
  findByEstudianteYFecha,
  registrar,
  registrarSalida,
  findByEstudiante,
  findByInstitucion,
  buscarEstudiantesParaAsistencia,
  findSinRegistroPorFecha,
  findInformeMensual,
  resumen,
};
