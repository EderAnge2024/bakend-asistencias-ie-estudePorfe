const db = require('../../config/database');

const findByInstitucion = async (id_institucion) => {
  const { rows } = await db.query(
    'SELECT * FROM configuracion_asistencia WHERE id_institucion = $1 ORDER BY id_configuracion DESC LIMIT 1',
    [id_institucion]
  );
  return rows[0] || null;
};
const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM configuracion_asistencia WHERE id_configuracion = $1', [id]);
  return rows[0] || null;
};
const create = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO configuracion_asistencia
      (id_institucion,latitud_ie,longitud_ie,radio_permitido_metros,wifi_ssid,wifi_bssid,tolerancia_entrada_min,tolerancia_salida_min,permitir_registro_manual)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [d.id_institucion,d.latitud_ie,d.longitud_ie,d.radio_permitido_metros,
     d.wifi_ssid,d.wifi_bssid,d.tolerancia_entrada_min??10,d.tolerancia_salida_min??10,d.permitir_registro_manual??false]
  );
  return rows[0];
};
const update = async (id, d) => {
  const campos=[]; const vals=[]; let i=1;
  for (const k of ['latitud_ie','longitud_ie','radio_permitido_metros','wifi_ssid','wifi_bssid','tolerancia_entrada_min','tolerancia_salida_min','permitir_registro_manual','estado']) {
    if (d[k] !== undefined) { campos.push(`${k}=$${i++}`); vals.push(d[k]); }
  }
  if (!campos.length) return null;
  campos.push('updated_at=CURRENT_TIMESTAMP'); vals.push(id);
  const { rows } = await db.query(`UPDATE configuracion_asistencia SET ${campos.join(',')} WHERE id_configuracion=$${i} RETURNING *`, vals);
  return rows[0]||null;
};
const toggleEstado = async (id, estado) => {
  const { rows } = await db.query(
    'UPDATE configuracion_asistencia SET estado=$1, updated_at=CURRENT_TIMESTAMP WHERE id_configuracion=$2 RETURNING *',[estado,id]
  );
  return rows[0]||null;
};
module.exports = { findByInstitucion, findById, create, update, toggleEstado };