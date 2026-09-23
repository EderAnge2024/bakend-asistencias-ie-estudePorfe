-- MIGRACION 004 - ASISTENCIAS DOCENTES
-- id_docente     = referencia LOGICA a docentes.id_docente del sistema de monitoreo
-- id_institucion = referencia LOGICA a instituciones.id_institucion del sistema de monitoreo
-- NO se crean FK cross-database
-- UNIQUE(id_docente, fecha): un docente, un registro por dia

BEGIN;

CREATE TABLE IF NOT EXISTS asistencias_docentes (
    id_asistencia              BIGSERIAL     PRIMARY KEY,
    id_docente                 BIGINT        NOT NULL,
    id_institucion             BIGINT        NOT NULL,
    fecha                      DATE          NOT NULL,
    hora_entrada               TIMESTAMP,
    hora_salida                TIMESTAMP,
    estado_asistencia          VARCHAR(30)   NOT NULL DEFAULT 'PRESENTE'
                                   CONSTRAINT chk_ad_estado
                                   CHECK (estado_asistencia IN ('PRESENTE','TARDANZA','FALTA','JUSTIFICADO')),
    metodo_entrada             VARCHAR(30)
                                   CONSTRAINT chk_ad_metodo_entrada
                                   CHECK (metodo_entrada IN ('GPS_WIFI','MANUAL','ADMINISTRATIVO')),
    metodo_salida              VARCHAR(30)
                                   CONSTRAINT chk_ad_metodo_salida
                                   CHECK (metodo_salida IN ('GPS_WIFI','MANUAL','ADMINISTRATIVO')),
    latitud_entrada            DECIMAL(10,7),
    longitud_entrada           DECIMAL(10,7),
    distancia_entrada_metros   DECIMAL(10,2),
    latitud_salida             DECIMAL(10,7),
    longitud_salida            DECIMAL(10,7),
    distancia_salida_metros    DECIMAL(10,2),
    wifi_ssid_entrada          VARCHAR(255),
    wifi_bssid_entrada         VARCHAR(255),
    wifi_ssid_salida           VARCHAR(255),
    wifi_bssid_salida          VARCHAR(255),
    ip_entrada                 INET,
    ip_salida                  INET,
    dispositivo                TEXT,
    nivel_seguridad            VARCHAR(30),
    observaciones              TEXT,
    created_at                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_asistencia_docente_fecha UNIQUE (id_docente, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_docentes_docente
    ON asistencias_docentes(id_docente);

CREATE INDEX IF NOT EXISTS idx_asistencia_docentes_institucion
    ON asistencias_docentes(id_institucion);

CREATE INDEX IF NOT EXISTS idx_asistencia_docentes_fecha
    ON asistencias_docentes(fecha);

CREATE INDEX IF NOT EXISTS idx_asistencia_docentes_estado
    ON asistencias_docentes(estado_asistencia);

COMMIT;