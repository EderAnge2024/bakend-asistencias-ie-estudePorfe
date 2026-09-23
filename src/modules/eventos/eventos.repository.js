const db = require('../../config/database');

const findAll = async ({ id_institucion, fecha, estado, tipo_evento }) => {
  let q = 'SELECT * FROM eventos_reuniones WHERE id_institucion=$1';
  const vals = [id_institucion]; let i = 2;
  if (fecha)       { q += ` AND fecha=$${i++}`;        vals.push(fecha); }
  if (estado)      { q += ` AND estado=$${i++}`;       vals.push(estado); }
  if (tipo_evento) { q += ` AND tipo_evento=$${i++}`;  vals.push(tipo_evento); }
  q += ' ORDER BY fecha DESC, hora_inicio';
  const { rows } = await db.query(q, vals);
  return rows;
};
const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM eventos_reuniones WHERE id_evento=$1',[id]);
  return rows[0]||null;
};
const create = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO eventos_reuniones (id_institucion,titulo,descripcion,fecha,hora_inicio,hora_fin,tipo_evento,estado)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [d.id_institucion,d.titulo,d.descripcion,d.fecha,d.hora_inicio,d.hora_fin,d.tipo_evento,d.estado||'ACTIVO']
  );
  return rows[0];
};
const update = async (id, d) => {
  const campos=[]; const vals=[]; let i=1;
  for (const k of ['titulo','descripcion','fecha','hora_inicio','hora_fin','tipo_evento']) {
    if (d[k]!==undefined) { campos.push(`${k}=$${i++}`); vals.push(d[k]); }
  }
  if (!campos.length) return null;
  campos.push('updated_at=CURRENT_TIMESTAMP'); vals.push(id);
  const { rows } = await db.query(`UPDATE eventos_reuniones SET ${campos.join(',')} WHERE id_evento=$${i} RETURNING *`, vals);
  return rows[0]||null;
};
const toggleEstado = async (id, estado) => {
  const { rows } = await db.query(
    'UPDATE eventos_reuniones SET estado=$1, updated_at=CURRENT_TIMESTAMP WHERE id_evento=$2 RETURNING *',[estado,id]
  );
  return rows[0]||null;
};
module.exports = { findAll, findById, create, update, toggleEstado };