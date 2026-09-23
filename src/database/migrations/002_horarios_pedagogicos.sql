-- MIGRACION 002 - HORARIOS PEDAGOGICOS
-- dia_semana: 1=Lunes 2=Martes 3=Miercoles 4=Jueves 5=Viernes 6=Sabado 7=Domingo

BEGIN;

CREATE TABLE IF NOT EXISTS horarios_pedagogicos (
    id_horario              BIGSERIAL   PRIMARY KEY,
    id_institucion          BIGINT      NOT NULL,
    dia_semana              SMALLINT    NOT NULL
                                CONSTRAINT chk_horario_dia_semana
                                CHECK (dia_semana BETWEEN 1 AND 7),
    hora_inicio             TIME        NOT NULL,
    hora_fin                TIME        NOT NULL,
    tolerancia_entrada_min  INTEGER     NOT NULL DEFAULT 10,
    tolerancia_salida_min   INTEGER     NOT NULL DEFAULT 10,
    estado                  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_horario_horas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_horarios_institucion
    ON horarios_pedagogicos(id_institucion);

CREATE INDEX IF NOT EXISTS idx_horarios_dia_semana
    ON horarios_pedagogicos(dia_semana);

COMMIT;