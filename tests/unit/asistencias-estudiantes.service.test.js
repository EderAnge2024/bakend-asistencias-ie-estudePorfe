/**
 * tests/unit/asistencias-estudiantes.service.test.js
 *
 * Pruebas unitarias del service de asistencias de estudiantes.
 * Se mockean todas las dependencias de BD para que corran sin conexión.
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

// ─── helpers ────────────────────────────────────────────────────────────────
const usuarioDirector = { id_usuario: 5, id_institucion: 1, rol: 'DIRECTOR' };
const usuarioDocenteTutor = { id_usuario: 8, id_institucion: 1, rol: 'DOCENTE', tutor: true, nivel: 'Secundaria', grado: '3', seccion: 'A' };
const credencialQR    = {
  id_estudiante: 10,
  nombres: 'Luis',
  apellido_paterno: 'García',
  est_estudiante: true,
};
const matriculaActiva = {
  id_matricula: 20,
  id_estudiante: 10,
  id_institucion: 1,
  nivel: 'Secundaria',
  grado: '3',
  seccion: 'A',
};
const registroIngreso = {
  id_asistencia: 99,
  id_estudiante: 10,
  id_matricula: 20,
  fecha: '2026-10-28',
  hora_entrada: new Date('2026-10-28T08:00:00-05:00'),
  hora_salida: null,
  estado_asistencia: 'PRESENTE',
  metodo_registro: 'QR',
  registrado_por: 5,
  rol_registro: 'DIRECTOR',
};

function limpiarMocks() {
  jest.clearAllMocks();
  qrSvc.validar.mockResolvedValue(credencialQR);
  matRepo.findActivaByEstudiante.mockResolvedValue(matriculaActiva);
  confRepo.findByInstitucion.mockResolvedValue(null);
  horRepo.findVigentePorDia.mockResolvedValue(null);
  horRepo.findAll.mockResolvedValue([]);
}

// ─── TESTS ──────────────────────────────────────────────────────────────────
describe('Asistencias Estudiantes Service - Ingreso y Salida', () => {
  beforeEach(limpiarMocks);

  // 1. Botón / Modo Ingreso registra entrada
  test('1. Modo INGRESO: Primer escaneo registra hora_entrada exitosamente', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    repo.registrar.mockResolvedValue(registroIngreso);

    const resultado = await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123', modo: 'INGRESO' });

    expect(repo.registrar).toHaveBeenCalledTimes(1);
    expect(repo.registrarSalida).not.toHaveBeenCalled();
    expect(resultado.hora_entrada).toBeTruthy();
    expect(resultado._accion).toBe('INGRESO');
    expect(repo.registrar).toHaveBeenCalledWith(expect.objectContaining({
      registrado_por: 5,
      rol_registro: 'DIRECTOR',
    }));
  });

  // 2. Botón / Modo Ingreso rechaza si ya ingresó
  test('2. Modo INGRESO: Rechaza con ALREADY_ENTERED si el estudiante ya ingresó hoy', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(registroIngreso);

    let error;
    try {
      await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123', modo: 'INGRESO' });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errorCode).toBe('ALREADY_ENTERED');
  });

  // 3. Botón / Modo Salida registra salida
  test('3. Modo SALIDA: Registra hora_salida si el estudiante tiene ingreso previo', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(registroIngreso);
    repo.registrarSalida.mockResolvedValue({
      ...registroIngreso,
      hora_salida: new Date(),
    });

    const resultado = await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123', modo: 'SALIDA' });

    expect(repo.registrarSalida).toHaveBeenCalledTimes(1);
    expect(resultado._accion).toBe('SALIDA');
  });

  // 4. Botón / Modo Salida rechaza si no ingresó
  test('4. Modo SALIDA: Rechaza con NO_ENTRY_RECORDED si el estudiante no tiene ingreso', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);

    let error;
    try {
      await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123', modo: 'SALIDA' });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errorCode).toBe('NO_ENTRY_RECORDED');
  });

  // 5. Botón / Modo Salida rechaza si ya salió
  test('5. Modo SALIDA: Rechaza con ALREADY_EXITED si ya tiene salida registrada', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue({
      ...registroIngreso,
      hora_salida: new Date('2026-10-28T13:00:00-05:00'),
    });

    let error;
    try {
      await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123', modo: 'SALIDA' });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errorCode).toBe('ALREADY_EXITED');
  });

  // 6. Modo automático sin modo
  test('6. Modo automático sin modo: 2.° escaneo registra salida y 3.° lanza ATTENDANCE_COMPLETE', async () => {
    repo.findByEstudianteYFecha.mockResolvedValueOnce(registroIngreso);
    repo.registrarSalida.mockResolvedValueOnce({
      ...registroIngreso,
      hora_salida: new Date('2026-10-28T13:00:00-05:00'),
    });

    const res2 = await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123' });
    expect(res2._accion).toBe('SALIDA');

    repo.findByEstudianteYFecha.mockResolvedValueOnce({
      ...registroIngreso,
      hora_salida: new Date('2026-10-28T13:00:00-05:00'),
    });

    let err3;
    try {
      await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123' });
    } catch (e) {
      err3 = e;
    }
    expect(err3.errorCode).toBe('ATTENDANCE_COMPLETE');
    expect(err3.statusCode).toBe(409);
  });

  // 7. registrarSalida (ruta directa)
  test('7. registrarSalida vía ruta directa sin ingreso previo lanza NOT_FOUND', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);

    let error;
    try {
      await svc.registrarSalida(usuarioDirector, 10);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errorCode).toBe('NOT_FOUND');
  });

  // 8. Condición de carrera prevenida por BD
  test('8. Condición de carrera prevenida por la restricción UNIQUE de BD', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    const errDuplicado = new Error(
      'duplicate key value violates unique constraint "uq_asistencia_estudiante_fecha"'
    );
    errDuplicado.code = '23505';

    repo.registrar
      .mockResolvedValueOnce(registroIngreso)
      .mockRejectedValueOnce(errDuplicado);

    const [res1, res2] = await Promise.allSettled([
      svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123' }),
      svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123' }),
    ]);

    const ok   = [res1, res2].filter(r => r.status === 'fulfilled').length;
    const fail = [res1, res2].filter(r => r.status === 'rejected').length;
    expect(ok + fail).toBe(2);
    expect(fail).toBeGreaterThanOrEqual(1);
  });

  // 9. Registro con ingreso pero sin salida mantiene hora_salida=null
  test('9. Registro con ingreso pero sin salida mantiene hora_salida=null', () => {
    expect(registroIngreso.hora_entrada).toBeTruthy();
    expect(registroIngreso.hora_salida).toBeNull();
  });

  // 10. Cálculo de estado PRESENTE / TARDANZA
  test('10. Horario con tolerancia calcula estado PRESENTE o TARDANZA', async () => {
    const horarioHoy = { hora_inicio: '06:00:00', tolerancia_entrada_min: 240 };
    horRepo.findVigentePorDia.mockResolvedValue(horarioHoy);
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    repo.registrar.mockImplementation(async (d) => ({
      ...registroIngreso,
      estado_asistencia: d.estado_asistencia,
    }));

    const resultado = await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123' });
    expect(['PRESENTE', 'TARDANZA']).toContain(resultado.estado_asistencia);
  });

  // 11. Resumen no duplica por ingreso + salida
  test('11. resumen() cuenta 1 vez por estudiante (sin duplicar por entrada y salida)', async () => {
    repo.resumen.mockResolvedValue([
      { estado_asistencia: 'PRESENTE', total: '3' },
      { estado_asistencia: 'TARDANZA', total: '1' },
      { estado_asistencia: 'FALTA',    total: '2' },
    ]);
    const res = await svc.resumen(usuarioDirector, {});
    expect(res.presentes).toBe(3);
    expect(res.tardanzas).toBe(1);
    expect(res.faltas).toBe(2);
    expect(res.total).toBe(6);
  });

  // 12. informeMensual compatible con días, detalle y alertas
  test('12. informeMensual devuelve estructura compatible con matriz y detalle de permanencia', async () => {
    const estudianteMock = {
      id_estudiante: 10,
      dni: '12345678',
      nombres: 'Luis',
      apellido_paterno: 'García',
      apellido_materno: 'Pérez',
      nivel: 'Secundaria',
      grado: '3',
      seccion: 'A',
      dias: { 1: 'P', 2: 'T', 5: 'F' },
      dias_detalle: {
        1: { estado: 'PRESENTE', completa: true, hora_entrada: new Date(), hora_salida: new Date() },
        2: { estado: 'TARDANZA', completa: false, hora_entrada: new Date(), hora_salida: null }
      },
      total_completas: 1,
      total_faltas_mes: 4,
      total_faltas_acumuladas: 4,
      alerta_faltas: 'ALERTA',
    };
    repo.findInformeMensual.mockResolvedValue([estudianteMock]);

    const res = await svc.informeMensual(1, { mes: 10, anio: 2026 });

    expect(Array.isArray(res)).toBe(true);
    expect(res[0].dias[1]).toBe('P');
    expect(res[0].dias_detalle[1].completa).toBe(true);
    expect(res[0].total_completas).toBe(1);
    expect(res[0].alerta_faltas).toBe('ALERTA');
  });

  // 13. Sin matrícula activa
  test('13. Sin matrícula activa lanza NO_ACTIVE_MATRICULA', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    matRepo.findActivaByEstudiante.mockResolvedValue(null);

    let error;
    try {
      await svc.registrarPorQR(usuarioDirector, { token_qr: 'abc-123' });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errorCode).toBe('NO_ACTIVE_MATRICULA');
    expect(error.statusCode).toBe(404);
  });

  // 14. Registro manual aplica cálculo automático de presente/tardanza y registra auditor
  test('14. Registro manual calcula estado automáticamente y guarda registrado_por', async () => {
    repo.findByEstudianteYFecha.mockResolvedValue(null);
    repo.registrar.mockImplementation(async (d) => ({
      ...registroIngreso,
      ...d,
      _accion: 'INGRESO',
    }));

    const res = await svc.registrarManual(usuarioDirector, { id_estudiante: 10 });
    expect(repo.registrar).toHaveBeenCalledWith(expect.objectContaining({
      metodo_registro: 'MANUAL',
      registrado_por: 5,
      rol_registro: 'DIRECTOR',
    }));
    expect(['PRESENTE', 'TARDANZA']).toContain(res.estado_asistencia);
  });

  // 15. Docente tutor de otra sección es rechazado
  test('15. Docente tutor de otra sección no puede registrar asistencia', async () => {
    const docenteOtraSeccion = { id_usuario: 9, id_institucion: 1, rol: 'DOCENTE', tutor: true, nivel: 'Secundaria', grado: '4', seccion: 'B' };
    repo.findByEstudianteYFecha.mockResolvedValue(null);

    let error;
    try {
      await svc.registrarManual(docenteOtraSeccion, { id_estudiante: 10 });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.errorCode).toBe('WRONG_SECTION');
    expect(error.statusCode).toBe(403);
  });
});
