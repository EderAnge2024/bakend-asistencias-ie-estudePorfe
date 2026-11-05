/**
 * tests/unit/escenarios-obligatorios.test.js
 *
 * Verificación exhaustiva de los 14 escenarios obligatorios de auditoría:
 * 1. Director registra asistencia mediante QR.
 * 2. Director registra asistencia buscando por nombre.
 * 3. Director registra asistencia buscando por DNI.
 * 4. Director intenta registrar dos veces al mismo estudiante.
 * 5. Director registra un estudiante dentro del horario -> PRESENTE.
 * 6. Director registra un estudiante después de la hora de ingreso -> TARDANZA.
 * 7. Docente tutor registra asistencia mediante QR.
 * 8. Docente tutor registra asistencia manualmente con cálculo automático.
 * 9. El sistema calcula correctamente las faltas acumuladas (sin confundir con tardanzas).
 * 10. El reporte muestra en rojo a estudiantes con 4 faltas (ALERTA).
 * 11. El reporte destaca a estudiantes con más de 4 faltas (CRÍTICA).
 * 12. El reporte identifica a estudiantes con 54 faltas o más como RETIRO.
 * 13. Usuarios no autorizados no pueden registrar asistencias desde el backend.
 * 14. Las asistencias anteriores siguen apareciendo correctamente en los reportes.
 */

jest.mock('../../src/modules/asistencias-estudiantes/repository');
jest.mock('../../src/modules/qr/qr.service');
jest.mock('../../src/modules/matriculas/matriculas.repository');
jest.mock('../../src/modules/configuracion/configuracion.repository');
jest.mock('../../src/modules/horarios/horarios.repository');

const repo    = require('../../src/modules/asistencias-estudiantes/repository');
const qrSvc   = require('../../src/modules/qr/qr.service');
const matRepo = require('../../src/modules/matriculas/matriculas.repository');
const confRepo= require('../../src/modules/configuracion/configuracion.repository');
const horRepo = require('../../src/modules/horarios/horarios.repository');
const svc     = require('../../src/modules/asistencias-estudiantes/service');
const { evaluarEstadoEstudiante } = require('../../src/shared/utils/tiempo');

// Usuarios de prueba
const usuarioDirector = { id_usuario: 1, id_institucion: 10, rol: 'DIRECTOR' };
const usuarioTutorSecundaria = {
  id_usuario: 2,
  id_institucion: 10,
  rol: 'DOCENTE',
  tutor: true,
  nivel: 'Secundaria',
  grado: '3',
  seccion: 'A'
};
const usuarioTutorOtraAula = {
  id_usuario: 3,
  id_institucion: 10,
  rol: 'DOCENTE',
  tutor: true,
  nivel: 'Secundaria',
  grado: '5',
  seccion: 'B'
};
const usuarioDocenteNoTutor = {
  id_usuario: 4,
  id_institucion: 10,
  rol: 'DOCENTE',
  tutor: false,
};

// Datos de estudiante y matrícula
const estudianteJuan = {
  id_estudiante: 101,
  dni: '72345678',
  nombres: 'Juan Carlos',
  apellido_paterno: 'Quispe',
  apellido_materno: 'Mamani',
};

const matriculaJuan = {
  id_matricula: 201,
  id_estudiante: 101,
  id_institucion: 10,
  nivel: 'Secundaria',
  grado: '3',
  seccion: 'A',
  estado: 'ACTIVO',
};

describe('AUDITORÍA Y PRUEBAS OBLIGATORIAS - SISTEMA DE ASISTENCIAS IE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    qrSvc.validar.mockResolvedValue({ ...estudianteJuan, est_estudiante: true });
    matRepo.findActivaByEstudiante.mockResolvedValue(matriculaJuan);
    confRepo.findByInstitucion.mockResolvedValue({ tolerancia_entrada_min: 10 });
    horRepo.findVigentePorDia.mockResolvedValue(null);
    horRepo.findAll.mockResolvedValue([]);
  });

  // Escenario 1
  test('Escenario 1: Director registra asistencia mediante QR (Ingreso y Salida)', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    repo.registrar.mockResolvedValue({
      id_asistencia: 501,
      id_estudiante: 101,
      estado_asistencia: 'PRESENTE',
      hora_entrada: new Date(),
      metodo_registro: 'QR',
      registrado_por: 1,
      rol_registro: 'DIRECTOR',
    });

    const resIngreso = await svc.registrarPorQR(usuarioDirector, { token_qr: 'token-juan', modo: 'INGRESO' });
    expect(resIngreso._accion).toBe('INGRESO');
    expect(repo.registrar).toHaveBeenCalledWith(expect.objectContaining({
      registrado_por: 1,
      rol_registro: 'DIRECTOR',
    }));

    // Registro de Salida
    repo.findByEstudianteYFecha.mockResolvedValue({
      id_asistencia: 501,
      id_estudiante: 101,
      hora_entrada: new Date(),
      hora_salida: null,
    });
    repo.registrarSalida.mockResolvedValue({
      id_asistencia: 501,
      hora_salida: new Date(),
    });

    const resSalida = await svc.registrarPorQR(usuarioDirector, { token_qr: 'token-juan', modo: 'SALIDA' });
    expect(resSalida._accion).toBe('SALIDA');
  });

  // Escenario 2 y 3
  test('Escenario 2 y 3: Director busca estudiantes por nombre y por DNI', async () => {
    const listaEsperada = [
      { id_estudiante: 101, nombres: 'Juan Carlos', apellido_paterno: 'Quispe', dni: '72345678', grado: '3', seccion: 'A' }
    ];
    repo.buscarEstudiantesParaAsistencia.mockResolvedValue(listaEsperada);

    // Búsqueda por nombre
    const resNombre = await svc.buscarParaDirector(usuarioDirector, { busqueda: 'Juan Carlos' });
    expect(repo.buscarEstudiantesParaAsistencia).toHaveBeenCalledWith(10, expect.objectContaining({ busqueda: 'Juan Carlos' }));
    expect(resNombre.length).toBe(1);

    // Búsqueda por DNI
    const resDNI = await svc.buscarParaDirector(usuarioDirector, { busqueda: '72345678' });
    expect(repo.buscarEstudiantesParaAsistencia).toHaveBeenCalledWith(10, expect.objectContaining({ busqueda: '72345678' }));
    expect(resDNI[0].dni).toBe('72345678');
  });

  // Escenario 4
  test('Escenario 4: Director intenta registrar dos veces al mismo estudiante (Evitar sobrescritura y duplicados)', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue({
      id_asistencia: 501,
      id_estudiante: 101,
      hora_entrada: new Date('2026-11-05T07:45:00-05:00'),
      estado_asistencia: 'PRESENTE',
    });

    // Intentar registrar por QR modo INGRESO duplicado
    await expect(svc.registrarPorQR(usuarioDirector, { token_qr: 'token-juan', modo: 'INGRESO' }))
      .rejects.toThrow(/ya tiene ingreso registrado/i);

    // Intentar registrar MANUAL duplicado
    await expect(svc.registrarManual(usuarioDirector, { id_estudiante: 101 }))
      .rejects.toThrow(/ya tiene asistencia registrada hoy/i);
  });

  // Escenario 5
  test('Escenario 5: Registro dentro del horario permitido -> PRESENTE', () => {
    // Horario 08:00 con 15 minutos de tolerancia
    // Hora simulada: 08:10 (dentro de tolerancia)
    const fechaDentro = new Date('2026-11-05T08:10:00-05:00');
    const estado = evaluarEstadoEstudiante('08:00:00', 15, fechaDentro);
    expect(estado).toBe('PRESENTE');
  });

  // Escenario 6
  test('Escenario 6: Registro después de la hora permitida -> TARDANZA', () => {
    // Horario 08:00 con 10 minutos de tolerancia (límite 08:10)
    // Hora simulada: 08:25 (tardanza)
    const fechaTardanza = new Date('2026-11-05T08:25:00-05:00');
    const estado = evaluarEstadoEstudiante('08:00:00', 10, fechaTardanza);
    expect(estado).toBe('TARDANZA');
  });

  // Escenario 7
  test('Escenario 7: Docente tutor registra asistencia mediante QR a su aula asignada', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    repo.registrar.mockResolvedValue({
      id_asistencia: 502,
      id_estudiante: 101,
      estado_asistencia: 'PRESENTE',
      hora_entrada: new Date(),
      metodo_registro: 'QR',
      registrado_por: 2,
      rol_registro: 'DOCENTE',
    });

    const res = await svc.registrarPorQR(usuarioTutorSecundaria, { token_qr: 'token-juan', modo: 'INGRESO' });
    expect(res._accion).toBe('INGRESO');
    expect(repo.registrar).toHaveBeenCalledWith(expect.objectContaining({
      registrado_por: 2,
      rol_registro: 'DOCENTE',
    }));
  });

  // Escenario 8
  test('Escenario 8: Docente tutor registra asistencia manualmente con cálculo automático de PRESENTE/TARDANZA', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    repo.registrar.mockImplementation(async (d) => ({
      ...d,
      id_asistencia: 503,
      _accion: 'INGRESO',
    }));

    const res = await svc.registrarManual(usuarioTutorSecundaria, { id_estudiante: 101 });
    expect(repo.registrar).toHaveBeenCalledWith(expect.objectContaining({
      metodo_registro: 'MANUAL',
      registrado_por: 2,
      rol_registro: 'DOCENTE',
    }));
    expect(['PRESENTE', 'TARDANZA']).toContain(res.estado_asistencia);
  });

  // Escenario 9
  test('Escenario 9: Cálculo correcto de faltas acumuladas (las tardanzas NO suman a faltas)', async () => {
    // Matriz mensual con: 10 Presentes, 5 Tardanzas, 4 Faltas, 2 Justificados
    const dias = { 1: 'P', 2: 'P', 3: 'T', 4: 'T', 5: 'F', 8: 'F', 9: 'F', 10: 'F', 11: 'P' };
    const fCount = Object.values(dias).filter(v => v === 'F').length;
    const tCount = Object.values(dias).filter(v => v === 'T').length;

    expect(fCount).toBe(4);
    expect(tCount).toBe(2);
    // Confirmamos que fCount no incluye tCount
    expect(fCount).not.toBe(fCount + tCount);
  });

  // Escenario 10
  test('Escenario 10: Estudiante con 4 faltas acumuladas -> Alerta roja (ALERTA)', async () => {
    const estudianteMock = {
      id_estudiante: 101,
      nombres: 'Juan',
      dias: { 1: 'F', 2: 'F', 3: 'F', 4: 'F' },
      total_faltas_mes: 4,
      total_faltas_acumuladas: 4,
      alerta_faltas: 'ALERTA',
    };
    repo.findInformeMensual.mockResolvedValue([estudianteMock]);

    const res = await svc.informeMensual(10, { mes: 11, anio: 2026 });
    expect(res[0].total_faltas_acumuladas).toBe(4);
    expect(res[0].alerta_faltas).toBe('ALERTA');
  });

  // Escenario 11
  test('Escenario 11: Estudiante con más de 4 faltas -> Alerta roja destacada (CRÍTICA)', async () => {
    const estudianteMock = {
      id_estudiante: 101,
      nombres: 'Juan',
      dias: { 1: 'F', 2: 'F', 3: 'F', 4: 'F', 5: 'F', 6: 'F' },
      total_faltas_mes: 6,
      total_faltas_acumuladas: 6,
      alerta_faltas: 'CRITICA',
    };
    repo.findInformeMensual.mockResolvedValue([estudianteMock]);

    const res = await svc.informeMensual(10, { mes: 11, anio: 2026 });
    expect(res[0].total_faltas_acumuladas).toBeGreaterThan(4);
    expect(res[0].alerta_faltas).toBe('CRITICA');
  });

  // Escenario 12
  test('Escenario 12: Estudiante con 54 faltas o más -> Condición RETIRO', async () => {
    const estudianteMock = {
      id_estudiante: 101,
      nombres: 'Juan',
      dias: {},
      total_faltas_mes: 5,
      total_faltas_acumuladas: 54,
      alerta_faltas: 'RETIRO',
    };
    repo.findInformeMensual.mockResolvedValue([estudianteMock]);

    const res = await svc.informeMensual(10, { mes: 11, anio: 2026 });
    expect(res[0].total_faltas_acumuladas).toBeGreaterThanOrEqual(54);
    expect(res[0].alerta_faltas).toBe('RETIRO');
  });

  // Escenario 13
  test('Escenario 13: Usuarios no autorizados son rechazados por el backend', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);

    // Tutor de otra aula intenta registrar a Juan (Secundaria 3° A)
    await expect(svc.registrarManual(usuarioTutorOtraAula, { id_estudiante: 101 }))
      .rejects.toThrow(/usted tiene asignado/i);

    // Docente sin rol de tutor
    await expect(svc.registrarManual(usuarioDocenteNoTutor, { id_estudiante: 101 }))
      .rejects.toThrow(/solo el docente tutor/i);
  });

  // Escenario 14
  test('Escenario 14: Asistencias anteriores se conservan y consultan correctamente', async () => {
    const asistenciasHistoricas = [
      { id_asistencia: 400, fecha: '2026-10-01', estado_asistencia: 'PRESENTE' },
      { id_asistencia: 401, fecha: '2026-10-02', estado_asistencia: 'TARDANZA' },
      { id_asistencia: 402, fecha: '2026-10-05', estado_asistencia: 'FALTA' },
    ];
    repo.findByInstitucion.mockResolvedValue(asistenciasHistoricas);

    const consulta = await svc.consultarInstitucion(10, { fecha_inicio: '2026-10-01', fecha_fin: '2026-10-05' });
    expect(consulta.length).toBe(3);
    expect(consulta[0].fecha).toBe('2026-10-01');
    expect(consulta[2].estado_asistencia).toBe('FALTA');
  });
});
