-- MIGRACION 006 - CREDENCIALES QR Y ASISTENCIAS ESTUDIANTES
-- token_qr: token opaco seguro (UUID), NO almacena datos personales
-- UNIQUE(id_estudiante, fecha): un estudiante, un registro por dia
-- FK internas a estudiantes y matriculas

BEGIN;

CREATE TABLE IF NOT EXISTS credenciales_qr_estudiantes (
    id_credencial      BIGSERIAL    PRIMARY KEY,
    id_estudiante      BIGINT       NOT NULL
                           REFERENCES estudiantes(id_estudiante)
                           ON DELETE RESTRICT ON UPDATE CASCADE,
    token_qr           VARCHAR(255) NOT NULL UNIQUE,
    fecha_emision      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion   TIMESTAMP,
    estado             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_estudiante
    ON credenciales_qr_estudiantes(id_estudiante);

CREATE INDEX IF NOT EXISTS idx_qr_token
    ON credenciales_qr_estudiantes(token_qr);

CREATE INDEX IF NOT EXISTS idx_qr_estado
    ON credenciales_qr_estudiantes(estado);

CREATE TABLE IF NOT EXISTS asistencias_estudiantes (
    id_asistencia       BIGSERIAL    PRIMARY KEY,
    id_estudiante       BIGINT       NOT NULL
                            REFERENCES estudiantes(id_estudiante)
                            ON DELETE RESTRICT ON UPDATE CASCADE,
    id_matricula        BIGINT       NOT NULL
                            REFERENCES matriculas(id_matricula)
                            ON DELETE RESTRICT ON UPDATE CASCADE,
    fecha               DATE         NOT NULL,
    hora_entrada        TIMESTAMP,
    hora_salida         TIMESTAMP,
    estado_asistencia   VARCHAR(30)  NOT NULL DEFAULT 'PRESENTE'
                            CONSTRAINT chk_ae_estado
                            CHECK (estado_asistencia IN ('PRESENTE','TARDANZA','FALTA','JUSTIFICADO')),
    metodo_registro     VARCHAR(30)  NOT NULL
                            CONSTRAINT chk_ae_metodo
                            CHECK (metodo_registro IN ('QR','MANUAL','ADMINISTRATIVO')),
    token_qr_referencia VARCHAR(255),
    latitud             DECIMAL(10,7),
    longitud            DECIMAL(10,7),
    distancia_ie_metros DECIMAL(10,2),
    ip                  INET,
    dispositivo         TEXT,
    observaciones       TEXT,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_asistencia_estudiante_fecha UNIQUE (id_estudiante, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_est_estudiante
    ON asistencias_estudiantes(id_estudiante);

CREATE INDEX IF NOT EXISTS idx_asistencia_est_matricula
    ON asistencias_estudiantes(id_matricula);

CREATE INDEX IF NOT EXISTS idx_asistencia_est_fecha
    ON asistencias_estudiantes(fecha);

CREATE INDEX IF NOT EXISTS idx_asistencia_est_estado
    ON asistencias_estudiantes(estado_asistencia);

CREATE INDEX IF NOT EXISTS idx_asistencia_est_metodo
    ON asistencias_estudiantes(metodo_registro);

COMMIT;