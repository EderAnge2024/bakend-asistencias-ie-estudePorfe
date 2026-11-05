-- MIGRACION 008 - AUDITORIA DE USUARIO RESPONSABLE DE ASISTENCIA
-- Permite registrar qué usuario (Director, Docente Tutor, Administrador) registró la asistencia.
-- Es 100% idempotente, segura y compatible hacia atrás.

BEGIN;

ALTER TABLE asistencias_estudiantes 
    ADD COLUMN IF NOT EXISTS registrado_por BIGINT,
    ADD COLUMN IF NOT EXISTS rol_registro VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_asistencia_est_registrado_por
    ON asistencias_estudiantes(registrado_por);

COMMIT;
