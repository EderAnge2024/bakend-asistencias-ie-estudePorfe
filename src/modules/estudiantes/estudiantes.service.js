const db = require('../../config/database');
const repo = require('./estudiantes.repository');
const AppError = require('../../shared/errors/AppError');

const listar = async (q) => repo.findAll(q);

const obtener = async (id) => {
  const e = await repo.findById(id);
  if (!e) throw new AppError('Estudiante no encontrado.','NOT_FOUND',404);
  return e;
};

const crear = async (d) => {
  if (!d.nombres||!d.apellido_paterno) throw new AppError('nombres y apellido_paterno son obligatorios.','MISSING_FIELDS');
  if (d.dni) {
    const dup = await repo.findByDni(d.dni);
    if (dup) throw new AppError('Ya existe un estudiante con ese DNI.','DUPLICATE_DNI',409);
  }
  if (d.codigo_estudiante) {
    const dup = await repo.findByCodigo(d.codigo_estudiante);
    if (dup) throw new AppError('Ya existe un estudiante con ese codigo.','DUPLICATE_CODIGO',409);
  }
  return repo.create(d);
};

const actualizar = async (id, d) => {
  const e = await repo.findById(id);
  if (!e) throw new AppError('Estudiante no encontrado.','NOT_FOUND',404);
  return repo.update(id, d);
};

const toggleEstado = async (id, estado) => {
  if (typeof estado !== 'boolean') throw new AppError('estado debe ser boolean.','INVALID_ESTADO');
  const e = await repo.findById(id);
  if (!e) throw new AppError('Estudiante no encontrado.','NOT_FOUND',404);
  return repo.toggleEstado(id, estado);
};

const listarMisEstudiantes = async (user) => {
  if (!user.tutor) {
    throw new AppError('Solo el docente tutor de la sección puede acceder a esta lista.', 'FORBIDDEN', 403);
  }
  if (!user.nivel || !user.grado || !user.seccion) {
    throw new AppError('No tienes nivel, grado o sección asignados para tutoría.', 'MISSING_ASSIGNMENT', 400);
  }
  return repo.findMisEstudiantes(user.id_institucion, user.nivel, user.grado, user.seccion);
};

async function batchInsertEstudiantes(client, students) {
  if (students.length === 0) return [];
  const CHUNK_SIZE = 100;
  const insertedRows = [];

  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const s of chunk) {
      values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
      params.push(s.codigo_estudiante || null, s.dni || null, s.nombres, s.apellido_paterno, s.apellido_materno || null);
    }

    const sql = `
      INSERT INTO estudiantes (codigo_estudiante, dni, nombres, apellido_paterno, apellido_materno)
      VALUES ${values.join(', ')}
      RETURNING id_estudiante, codigo_estudiante, dni
    `;

    const { rows } = await client.query(sql, params);
    insertedRows.push(...rows);
  }
  return insertedRows;
}

async function batchUpdateEstudiantes(client, students) {
  if (students.length === 0) return;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const s of chunk) {
      values.push(`($${paramIdx++}::bigint, $${paramIdx++}::varchar, $${paramIdx++}::varchar, $${paramIdx++}::varchar)`);
      params.push(s.id_estudiante, s.nombres, s.apellido_paterno, s.apellido_materno || null);
    }

    const sql = `
      UPDATE estudiantes AS e
      SET nombres = v.nombres,
          apellido_paterno = v.apellido_paterno,
          apellido_materno = v.apellido_materno,
          updated_at = CURRENT_TIMESTAMP
      FROM (VALUES ${values.join(', ')}) AS v(id_estudiante, nombres, apellido_paterno, apellido_materno)
      WHERE e.id_estudiante = v.id_estudiante
    `;
    await client.query(sql, params);
  }
}

async function batchInsertMatriculas(client, matriculas) {
  if (matriculas.length === 0) return;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < matriculas.length; i += CHUNK_SIZE) {
    const chunk = matriculas.slice(i, i + CHUNK_SIZE);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const m of chunk) {
      values.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, 'ACTIVO')`);
      params.push(m.id_estudiante, m.id_institucion, m.anio_lectivo, m.nivel, m.grado, m.seccion);
    }

    const sql = `
      INSERT INTO matriculas (id_estudiante, id_institucion, anio_lectivo, nivel, grado, seccion, estado)
      VALUES ${values.join(', ')}
    `;
    await client.query(sql, params);
  }
}

async function batchUpdateMatriculas(client, matriculas) {
  if (matriculas.length === 0) return;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < matriculas.length; i += CHUNK_SIZE) {
    const chunk = matriculas.slice(i, i + CHUNK_SIZE);
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const m of chunk) {
      values.push(`($${paramIdx++}::bigint, $${paramIdx++}::varchar, $${paramIdx++}::varchar, $${paramIdx++}::varchar)`);
      params.push(m.id_matricula, m.nivel, m.grado, m.seccion);
    }

    const sql = `
      UPDATE matriculas AS mat
      SET nivel = v.nivel,
          grado = v.grado,
          seccion = v.seccion,
          updated_at = CURRENT_TIMESTAMP
      FROM (VALUES ${values.join(', ')}) AS v(id_matricula, nivel, grado, seccion)
      WHERE mat.id_matricula = v.id_matricula
    `;
    await client.query(sql, params);
  }
}

const cargaMasiva = async (usuario, listaEstudiantes) => {
  const id_institucion = usuario?.id_institucion;
  if (!id_institucion) {
    throw new AppError('No se identificó la institución del usuario.', 'MISSING_INSTITUTION', 400);
  }

  const anioLectivoActual = new Date().getFullYear();
  const resultados = { insertados: 0, actualizados: 0, matriculados: 0, errores: [] };

  if (!Array.isArray(listaEstudiantes) || listaEstudiantes.length === 0) {
    throw new AppError('Debe enviar una lista de estudiantes válida.', 'INVALID_DATA', 400);
  }

  // 1. Limpieza y parseo de cada fila en memoria
  const parsedRows = [];
  for (let i = 0; i < listaEstudiantes.length; i++) {
    const item = listaEstudiantes[i];
    const filaNum = i + 1;

    // Detectar DNI
    const dni = String(item.dni || item.DNI || item['D N I'] || item.Dni || '').replace(/[^0-9]/g, '').trim();

    // Detectar Apellidos y Nombres (si vienen juntos en una sola columna 'Apellidos y nombres')
    let nombres = String(item.nombres || item.Nombres || item['NOMBRES'] || '').trim();
    let apellido_paterno = String(item.apellido_paterno || item['Apellido Paterno'] || item['APELLIDO PATERNO'] || '').trim();
    let apellido_materno = String(item.apellido_materno || item['Apellido Materno'] || item['APELLIDO MATERNO'] || '').trim();

    const apNombres = String(item['Apellidos y nombres'] || item['APELLIDOS Y NOMBRES'] || item['Apellidos y Nombres'] || item['ESTUDIANTE'] || item['Estudiante'] || '').trim();

    if (apNombres && (!nombres || !apellido_paterno)) {
      if (apNombres.includes(',')) {
        const [apellidosPart, nombresPart] = apNombres.split(',');
        nombres = nombresPart ? nombresPart.trim() : '';
        const aps = apellidosPart.trim().split(/\s+/);
        apellido_paterno = aps[0] || '';
        apellido_materno = aps.slice(1).join(' ') || '';
      } else {
        const partes = apNombres.split(/\s+/);
        if (partes.length >= 3) {
          apellido_paterno = partes[0];
          apellido_materno = partes[1];
          nombres = partes.slice(2).join(' ');
        } else if (partes.length === 2) {
          apellido_paterno = partes[0];
          nombres = partes[1];
        } else {
          nombres = apNombres;
        }
      }
    }

    if (!nombres || !apellido_paterno) {
      resultados.errores.push(`Fila ${filaNum}: Nombres y Apellido Paterno son obligatorios.`);
      continue;
    }

    // Parser de Grado y Sección
    const rawGrado   = String(item.grado || item.Grado || item['GRADO'] || item['Grado y sección'] || item['GRADO Y SECCION'] || '1').trim();
    const rawSeccion = String(item.seccion || item.Seccion || item['SECCION'] || item['Sección'] || 'A').trim();

    const numMatch  = rawGrado.match(/\d+/);
    const letraMatch = rawGrado.match(/["']?([A-Za-z])["']?\s*$/) || rawGrado.match(/\s([A-Za-z])$/);

    const grado   = numMatch   ? numMatch[0] : rawGrado;
    const seccion = letraMatch ? letraMatch[1].toUpperCase() : rawSeccion.replace(/[^A-Za-z]/g, '').toUpperCase() || 'A';

    const nivel             = String(item.nivel || item.Nivel || item['NIVEL'] || 'Primaria').trim();
    const codigo_estudiante = String(item.codigo_estudiante || item.codigo || item['Codigo'] || item['CODIGO'] || '').trim();
    const anio_lectivo      = parseInt(item.anio_lectivo || item['Año Lectivo'] || item['AÑO LECTIVO'] || item['Año'] || item['Anio'] || anioLectivoActual, 10) || anioLectivoActual;

    parsedRows.push({
      filaNum,
      dni: dni || null,
      codigo_estudiante: codigo_estudiante || null,
      nombres,
      apellido_paterno,
      apellido_materno: apellido_materno || null,
      nivel,
      grado,
      seccion,
      anio_lectivo
    });
  }

  if (parsedRows.length === 0) {
    return resultados;
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 2. Pre-cargar estudiantes existentes en UNA sola consulta
    const allDnis = parsedRows.map(r => r.dni).filter(Boolean);
    const allCodigos = parsedRows.map(r => r.codigo_estudiante).filter(Boolean);

    const studentMapByDni = new Map();
    const studentMapByCodigo = new Map();

    if (allDnis.length > 0 || allCodigos.length > 0) {
      const { rows: existingEst } = await client.query(
        `SELECT id_estudiante, dni, codigo_estudiante 
         FROM estudiantes 
         WHERE (dni = ANY($1::varchar[]) AND dni IS NOT NULL AND dni != '') 
            OR (codigo_estudiante = ANY($2::varchar[]) AND codigo_estudiante IS NOT NULL AND codigo_estudiante != '')`,
        [allDnis.length > 0 ? allDnis : ['__NONE__'], allCodigos.length > 0 ? allCodigos : ['__NONE__']]
      );

      for (const e of existingEst) {
        if (e.dni) studentMapByDni.set(String(e.dni).trim(), e.id_estudiante);
        if (e.codigo_estudiante) studentMapByCodigo.set(String(e.codigo_estudiante).trim(), e.id_estudiante);
      }
    }

    // 3. Separar en inserciones y actualizaciones (evitando duplicados en el mismo archivo)
    const toInsert = [];
    const toUpdate = [];

    for (const row of parsedRows) {
      let estId = null;
      if (row.dni && studentMapByDni.has(row.dni)) {
        estId = studentMapByDni.get(row.dni);
      } else if (row.codigo_estudiante && studentMapByCodigo.has(row.codigo_estudiante)) {
        estId = studentMapByCodigo.get(row.codigo_estudiante);
      }

      if (estId && estId !== 'PENDING') {
        row.id_estudiante = estId;
        toUpdate.push(row);
      } else if (!estId) {
        toInsert.push(row);
        if (row.dni) studentMapByDni.set(row.dni, 'PENDING');
        if (row.codigo_estudiante) studentMapByCodigo.set(row.codigo_estudiante, 'PENDING');
      }
    }

    // 4. Inserción masiva de nuevos estudiantes
    if (toInsert.length > 0) {
      const inserted = await batchInsertEstudiantes(client, toInsert);
      for (const ins of inserted) {
        const insDni = ins.dni ? String(ins.dni).trim() : null;
        const insCod = ins.codigo_estudiante ? String(ins.codigo_estudiante).trim() : null;
        if (insDni) studentMapByDni.set(insDni, ins.id_estudiante);
        if (insCod) studentMapByCodigo.set(insCod, ins.id_estudiante);

        const matchingRow = toInsert.find(r => 
          (insDni && r.dni === insDni) || (insCod && r.codigo_estudiante === insCod)
        );
        if (matchingRow) {
          matchingRow.id_estudiante = ins.id_estudiante;
        }
      }
      resultados.insertados += inserted.length;
    }

    // 5. Actualización masiva de estudiantes existentes
    if (toUpdate.length > 0) {
      await batchUpdateEstudiantes(client, toUpdate);
      resultados.actualizados += toUpdate.length;
    }

    // 6. Pre-cargar matrículas existentes para todos los estudiantes en UNA sola consulta
    const allEstIds = Array.from(new Set(parsedRows.map(r => r.id_estudiante).filter(Boolean)));
    const matriculaMap = new Map(); // key: `${id_estudiante}_${anio_lectivo}` -> id_matricula

    if (allEstIds.length > 0) {
      const { rows: existingMats } = await client.query(
        `SELECT id_matricula, id_estudiante, anio_lectivo 
         FROM matriculas 
         WHERE id_institucion = $1 AND id_estudiante = ANY($2::bigint[]) AND estado = 'ACTIVO'`,
        [id_institucion, allEstIds]
      );
      for (const m of existingMats) {
        matriculaMap.set(`${m.id_estudiante}_${m.anio_lectivo}`, m.id_matricula);
      }
    }

    // 7. Separar matrículas en insertar o actualizar
    const matsToInsert = [];
    const matsToUpdate = [];
    const processedMatKeys = new Set();

    for (const row of parsedRows) {
      if (!row.id_estudiante) continue;
      const matKey = `${row.id_estudiante}_${row.anio_lectivo}`;
      if (processedMatKeys.has(matKey)) continue;
      processedMatKeys.add(matKey);

      const idMatExist = matriculaMap.get(matKey);
      if (idMatExist) {
        matsToUpdate.push({
          id_matricula: idMatExist,
          nivel: row.nivel,
          grado: row.grado,
          seccion: row.seccion
        });
      } else {
        matsToInsert.push({
          id_estudiante: row.id_estudiante,
          id_institucion,
          anio_lectivo: row.anio_lectivo,
          nivel: row.nivel,
          grado: row.grado,
          seccion: row.seccion
        });
      }
    }

    if (matsToInsert.length > 0) {
      await batchInsertMatriculas(client, matsToInsert);
    }
    if (matsToUpdate.length > 0) {
      await batchUpdateMatriculas(client, matsToUpdate);
    }
    resultados.matriculados = matsToInsert.length + matsToUpdate.length;

    await client.query('COMMIT');
    return resultados;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en cargaMasiva:', err);
    throw new AppError('Error durante la carga masiva de estudiantes: ' + (err.message || 'error en BD'), 'IMPORT_ERROR', 500);
  } finally {
    client.release();
  }
};


module.exports = { listar, obtener, crear, actualizar, toggleEstado, listarMisEstudiantes, cargaMasiva };