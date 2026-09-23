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

const cargaMasiva = async (usuario, listaEstudiantes) => {
  const { id_institucion } = usuario;
  const anioLectivoActual = new Date().getFullYear();
  const resultados = { insertados: 0, actualizados: 0, matriculados: 0, errores: [] };

  if (!Array.isArray(listaEstudiantes) || listaEstudiantes.length === 0) {
    throw new AppError('Debe enviar una lista de estudiantes válida.', 'INVALID_DATA', 400);
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < listaEstudiantes.length; i++) {
      const item = listaEstudiantes[i];

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

      // ──────────────────────────────────────────────────────────────────────
      // Parser de Grado y Sección — soporta todos los formatos SIAGIE:
      //   '1 "A"'  → grado: 1, seccion: A
      //   '3 "B"'  → grado: 3, seccion: B
      //   '3'      → grado: 3, seccion: columna Seccion o 'A' por defecto
      //   '1A'     → grado: 1, seccion: A
      //   'SEGUNDO A' → grado: 2 (si se mapea), seccion: A
      // ──────────────────────────────────────────────────────────────────────
      const rawGrado   = String(item.grado || item.Grado || item['GRADO'] || item['Grado y sección'] || item['GRADO Y SECCION'] || '1').trim();
      const rawSeccion = String(item.seccion || item.Seccion || item['SECCION'] || item['Sección'] || 'A').trim();

      // Extraer número del grado (por si viene '1 "A"', '3', '2B', etc.)
      const numMatch  = rawGrado.match(/\d+/);
      // Extraer letra de sección DENTRO del campo grado (ej: '1 "A"' → 'A')
      // Busca una letra suelta rodeada de espacios, comillas o final de cadena
      const letraMatch = rawGrado.match(/["']?([A-Za-z])["']?\s*$/) || rawGrado.match(/\s([A-Za-z])$/);

      const grado   = numMatch   ? numMatch[0]              : rawGrado;
      // Si la letra viene dentro del campo grado (ej: 1 "A") la usa,
      // si no, usa la columna Seccion (si existe) o 'A' por defecto
      const seccion = letraMatch ? letraMatch[1].toUpperCase() : rawSeccion.replace(/[^A-Za-z]/g, '').toUpperCase() || 'A';

      const nivel            = String(item.nivel || item.Nivel || item['NIVEL'] || 'Primaria').trim();
      const codigo_estudiante = String(item.codigo_estudiante || item.codigo || item['Codigo'] || item['CODIGO'] || '').trim();
      const anio_lectivo     = parseInt(item.anio_lectivo || item['Año Lectivo'] || anioLectivoActual);

      if (!nombres || !apellido_paterno) {
        resultados.errores.push(`Fila ${i + 1}: Nombres y Apellido Paterno son obligatorios.`);
        continue;
      }

      let estId = null;

      if (dni) {
        const { rows } = await client.query('SELECT id_estudiante FROM estudiantes WHERE dni = $1', [dni]);
        if (rows.length > 0) estId = rows[0].id_estudiante;
      }

      if (!estId && codigo_estudiante) {
        const { rows } = await client.query('SELECT id_estudiante FROM estudiantes WHERE codigo_estudiante = $1', [codigo_estudiante]);
        if (rows.length > 0) estId = rows[0].id_estudiante;
      }

      if (estId) {
        await client.query(
          `UPDATE estudiantes SET nombres=$1, apellido_paterno=$2, apellido_materno=$3, updated_at=CURRENT_TIMESTAMP WHERE id_estudiante=$4`,
          [nombres, apellido_paterno, apellido_materno || null, estId]
        );
        resultados.actualizados++;
      } else {
        const { rows } = await client.query(
          `INSERT INTO estudiantes (codigo_estudiante, dni, nombres, apellido_paterno, apellido_materno)
           VALUES ($1, $2, $3, $4, $5) RETURNING id_estudiante`,
          [codigo_estudiante || null, dni || null, nombres, apellido_paterno, apellido_materno || null]
        );
        estId = rows[0].id_estudiante;
        resultados.insertados++;
      }

      if (estId) {
        const { rows: matExist } = await client.query(
          `SELECT id_matricula FROM matriculas WHERE id_estudiante=$1 AND id_institucion=$2 AND anio_lectivo=$3 AND estado='ACTIVO'`,
          [estId, id_institucion, anio_lectivo]
        );

        if (matExist.length > 0) {
          await client.query(
            `UPDATE matriculas SET nivel=$1, grado=$2, seccion=$3, updated_at=CURRENT_TIMESTAMP WHERE id_matricula=$4`,
            [nivel, grado, seccion, matExist[0].id_matricula]
          );
        } else {
          await client.query(
            `INSERT INTO matriculas (id_estudiante, id_institucion, anio_lectivo, nivel, grado, seccion, estado)
             VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO')`,
            [estId, id_institucion, anio_lectivo, nivel, grado, seccion]
          );
        }
        resultados.matriculados++;
      }
    }

    await client.query('COMMIT');
    return resultados;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en cargaMasiva:', err);
    throw new AppError('Error durante la carga masiva de estudiantes.', 'IMPORT_ERROR', 500);
  } finally {
    client.release();
  }
};


module.exports = { listar, obtener, crear, actualizar, toggleEstado, listarMisEstudiantes, cargaMasiva };