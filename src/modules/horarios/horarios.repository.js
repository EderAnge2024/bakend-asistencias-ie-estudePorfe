const db = require('../../config/database');

const findAll = async (id_institucion, soloActivos = true) => {
  const cond = soloActivos ? 'AND estado = TRUE' : '';
  const { rows } = await db.query(
    `SELECT * FROM horarios_pedagogicos WHERE id_institucion = $1 ${cond} ORDER BY dia_semana, hora_inicio`,
    [id_institucion]
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM horarios_pedagogicos WHERE id_horario = $1', [id]);
  return rows[0] || null;
};

const create = async (d) => {
  const { rows } = await db.query(`
    INSERT INTO horarios_pedagogicos
      (id_institucion, dia_semana, hora_inicio, hora_fin, tolerancia_entrada_min, tolerancia_salida_min)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [d.id_institucion, d.dia_semana, d.hora_inicio, d.hora_fin,
     d.tolerancia_entrada_min ?? 10, d.tolerancia_salida_min ?? 10]
  );
  return rows[0];
};

const update = async (id, d) => {
  const campos = []; const vals = []; let i = 1;
  const permitidos = ['dia_semana','hora_inicio','hora_fin','tolerancia_entrada_min','tolerancia_salida_min','estado'];
  for (const k of permitidos) {
    if (d[k] !== undefined) { campos.push(`${k} = $${i++}`); vals.push(d[k]); }
  }
  if (!campos.length) return null;
  campos.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  const { rows } = await db.query(
    `UPDATE horarios_pedagogicos SET ${campos.join(', ')} WHERE id_horario = $${i} RETURNING *`, vals
  );
  return rows[0] || null;
};

const desactivar = async (id) => {
  const { rows } = await db.query(
    'UPDATE horarios_pedagogicos SET estado = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id_horario = $1 RETURNING *', [id]
  );
  return rows[0] || null;
};

const findVigentePorDia = async (id_institucion, dia_semana) => {
  const { rows } = await db.query(
    'SELECT * FROM horarios_pedagogicos WHERE id_institucion=$1 AND dia_semana=$2 AND estado=TRUE ORDER BY hora_inicio LIMIT 1',
    [id_institucion, dia_semana]
  );
  return rows[0] || null;
};

module.exports = { findAll, findById, create, update, desactivar, findVigentePorDia };