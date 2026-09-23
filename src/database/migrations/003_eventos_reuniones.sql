-- MIGRACION 003 - EVENTOS Y REUNIONES
-- Tipos: REUNION | CAPACITACION | ACTIVIDAD | ASAMBLEA | OTRO
-- Estados: ACTIVO | FINALIZADO | CANCELADO

BEGIN;

CREATE TABLE IF NOT EXISTS eventos_reuniones (
    id_evento      BIGSERIAL    PRIMARY KEY,
    id_institucion BIGINT       NOT NULL,
    titulo         VARCHAR(200) NOT NULL,
    descripcion    TEXT,
    fecha          DATE         NOT NULL,
    hora_inicio    TIME         NOT NULL,
    hora_fin       TIME         NOT NULL,
    tipo_evento    VARCHAR(50)  NOT NULL
                       CONSTRAINT chk_evento_tipo
                       CHECK (tipo_evento IN ('REUNION','CAPACITACION','ACTIVIDAD','ASAMBLEA','OTRO')),
    estado         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO'
                       CONSTRAINT chk_evento_estado
                       CHECK (estado IN ('ACTIVO','FINALIZADO','CANCELADO')),
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_evento_horas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_eventos_institucion
    ON eventos_reuniones(id_institucion);

CREATE INDEX IF NOT EXISTS idx_eventos_fecha
    ON eventos_reuniones(fecha);

CREATE INDEX IF NOT EXISTS idx_eventos_estado
    ON eventos_reuniones(estado);

COMMIT;