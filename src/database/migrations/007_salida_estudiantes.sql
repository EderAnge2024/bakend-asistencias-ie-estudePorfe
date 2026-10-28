-- MIGRACION 007 - SOPORTE COMPLETO Y ASEGURAMIENTO DE COLUMNAS DE SALIDA
-- Asegura que la columna hora_salida exista al desplegar el sistema
-- Crea índices necesarios para búsquedas eficientes de jornada y salidas pendientes.
--
-- ES 100% IDEMPOTENTE, SEGURA Y REVERSIBLE:
-- - ADD COLUMN IF NOT EXISTS
-- - CREATE INDEX IF NOT EXISTS
-- No elimina ni modifica datos preexistentes.

BEGIN;

-- 1. Asegurar la columna hora_salida en asistencias_estudiantes
ALTER TABLE asistencias_estudiantes 
    ADD COLUMN IF NOT EXISTS hora_salida TIMESTAMP;

-- 2. Índice para consultas de registros con salida registrada o pendiente
CREATE INDEX IF NOT EXISTS idx_asistencia_est_hora_salida
    ON asistencias_estudiantes(hora_salida);

-- 3. Índice compuesto para búsquedas por estudiante y fecha
CREATE INDEX IF NOT EXISTS idx_asistencia_est_id_fecha
    ON asistencias_estudiantes(id_estudiante, fecha);

COMMIT;
