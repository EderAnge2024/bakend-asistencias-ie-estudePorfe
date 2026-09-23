-- MIGRACION 001 - ESQUEMA INICIAL Y configuracion_asistencia
-- IMPORTANTE: NO crea usuarios, docentes, roles, usuario_roles, instituciones
-- id_institucion e id_docente son referencias logicas (sin FK cross-database)

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version      VARCHAR(50)  PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    executed_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuracion_asistencia (
    id_configuracion         BIGSERIAL     PRIMARY KEY,
    id_institucion           BIGINT        NOT NULL,
    latitud_ie               DECIMAL(10,7) NOT NULL,
    longitud_ie              DECIMAL(10,7) NOT NULL,
    radio_permitido_metros   INTEGER       NOT NULL DEFAULT 100,
    wifi_ssid                VARCHAR(255),
    wifi_bssid               VARCHAR(255),
    tolerancia_entrada_min   INTEGER       NOT NULL DEFAULT 10,
    tolerancia_salida_min    INTEGER       NOT NULL DEFAULT 10,
    permitir_registro_manual BOOLEAN       NOT NULL DEFAULT FALSE,
    estado                   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_config_asistencia_institucion
    ON configuracion_asistencia(id_institucion);

COMMIT;