const db = require('../../config/database');
const dbMonitoreo = require('../../config/databaseMonitoreo');

const findByDocenteYFecha = async (id_docente, fecha) => {
  const { rows } = await db.query(
    'SELECT * FROM asistencias_docentes WHERE (id_docente=$1 OR id_docente::text=$1::text) AND fecha=$2',
    [id_docente, fecha]
  );
  return rows[0] || null;
};

const registrarEntrada = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO asistencias_docentes
      (id_docente,id_institucion,fecha,hora_entrada,estado_asistencia,metodo_entrada,
       latitud_entrada,longitud_entrada,distancia_entrada_metros,
       wifi_ssid_entrada,wifi_bssid_entrada,ip_entrada,dispositivo,nivel_seguridad,observaciones)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [d.id_docente,d.id_institucion,d.fecha,d.hora_entrada,d.estado_asistencia,d.metodo_entrada,
     d.latitud_entrada,d.longitud_entrada,d.distancia_entrada_metros,
     d.wifi_ssid_entrada,d.wifi_bssid_entrada,d.ip_entrada,d.dispositivo,d.nivel_seguridad,d.observaciones]
  );
  return rows[0];
};

const registrarSalida = async (id_asistencia, d) => {
  const { rows } = await db.query(`
    UPDATE asistencias_docentes SET
      hora_salida=$1, metodo_salida=$2,
      latitud_salida=$3, longitud_salida=$4, distancia_salida_metros=$5,
      wifi_ssid_salida=$6, wifi_bssid_salida=$7, ip_salida=$8,
      updated_at=CURRENT_TIMESTAMP
    WHERE id_asistencia=$9 RETURNING *`,
    [d.hora_salida,d.metodo_salida,d.latitud_salida,d.longitud_salida,d.distancia_salida_metros,
     d.wifi_ssid_salida,d.wifi_bssid_salida,d.ip_salida, id_asistencia]
  );
  return rows[0];
};

const findPropia = async (id_docente, fecha_inicio, fecha_fin) => {
  const { rows } = await db.query(
    `SELECT * FROM asistencias_docentes 
     WHERE (id_docente=$1 OR id_docente::text=$1::text) 
       AND fecha BETWEEN $2 AND $3 
     ORDER BY fecha DESC, hora_entrada DESC`,
    [id_docente, fecha_inicio, fecha_fin]
  );
  return rows;
};

const findByDocente = async (id_docente, id_institucion, fecha_inicio, fecha_fin) => {
  const { rows } = await db.query(
    `SELECT * FROM asistencias_docentes 
     WHERE (id_docente=$1 OR id_docente::text=$1::text) 
       AND (id_institucion=$2 OR id_institucion::text=$2::text) 
       AND fecha BETWEEN $3 AND $4 
     ORDER BY fecha DESC, hora_entrada DESC`,
    [id_docente, id_institucion, fecha_inicio, fecha_fin]
  );
  return rows;
};

const findByInstitucion = async (id_institucion, fecha_inicio, fecha_fin, estado) => {
  let q = `
    SELECT *
    FROM asistencias_docentes
    WHERE (id_institucion = $1 OR id_institucion::text = $1::text)
      AND fecha BETWEEN $2 AND $3
  `;
  const vals = [id_institucion, fecha_inicio, fecha_fin];
  if (estado) {
    q += ' AND estado_asistencia = $4';
    vals.push(estado);
  }
  q += ' ORDER BY fecha DESC, hora_entrada DESC';
  
  const { rows: asistencias } = await db.query(q, vals);

  // Si hay registros, enriquecer con nombres, apellidos y DNI consultando dbMonitoreo
  if (asistencias && asistencias.length > 0 && dbMonitoreo) {
    const docIds = [...new Set(asistencias.map(a => a.id_docente).filter(Boolean))];
    if (docIds.length > 0) {
      try {
        const { rows: docentes } = await dbMonitoreo.query(
          `SELECT d.id_docente, d.id_usuario, u.dni, u.nombres, u.apellidos
           FROM docentes d
           JOIN usuarios u ON d.id_usuario = u.id_usuario
           WHERE d.id_docente = ANY($1::bigint[]) OR d.id_usuario = ANY($1::bigint[])`,
          [docIds]
        );

        const mapa = {};
        docentes.forEach(d => {
          mapa[String(d.id_docente)] = d;
          if (d.id_usuario) mapa[String(d.id_usuario)] = d;
        });

        asistencias.forEach(a => {
          const doc = mapa[String(a.id_docente)];
          if (doc) {
            a.nombres = doc.nombres;
            a.apellidos = doc.apellidos;
            a.dni = doc.dni;
          }
        });
      } catch (errMon) {
        console.warn('[Asistencias Docentes] dbMonitoreo no disponible para nombres:', errMon.message);
      }
    }
  }

  return asistencias;
};

const resumenPorInstitucion = async (id_institucion, fecha_inicio, fecha_fin) => {
  const { rows } = await db.query(`
    SELECT estado_asistencia, COUNT(*) AS total
    FROM asistencias_docentes
    WHERE (id_institucion=$1 OR id_institucion::text=$1::text) AND fecha BETWEEN $2 AND $3
    GROUP BY estado_asistencia`,
    [id_institucion, fecha_inicio, fecha_fin]
  );
  return rows;
};

module.exports = {
  findByDocenteYFecha,
  registrarEntrada,
  registrarSalida,
  findPropia,
  findByDocente,
  findByInstitucion,
  resumenPorInstitucion
};