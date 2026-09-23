-- MIGRACION 005 - ESTUDIANTES Y MATRICULAS
-- estudiantes: tabla propia del sistema de asistencias
-- matriculas: FK interna a estudiantes.id_estudiante
-- id_institucion en matriculas: referencia logica al sistema de monitoreo

BEGIN;

CREATE TABLE IF NOT EXISTS estudiantes (
    id_estudiante      BIGSERIAL    PRIMARY KEY,
    codigo_estudiante  VARCHAR(50)  UNIQUE,
    dni                VARCHAR(20),
    nombres            VARCHAR(100) NOT NULL,
    apellido_paterno   VARCHAR(100) NOT NULL,
    apellido_materno   VARCHAR(100),
    estado             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_codigo
    ON estudiantes(codigo_estudiante);

CREATE INDEX IF NOT EXISTS idx_estudiantes_dni
    ON estudiantes(dni);

CREATE INDEX IF NOT EXISTS idx_estudiantes_estado
    ON estudiantes(estado);

CREATE TABLE IF NOT EXISTS matriculas (
    id_matricula    BIGSERIAL    PRIMARY KEY,
    id_estudiante   BIGINT       NOT NULL
                        REFERENCES estudiantes(id_estudiante)
                        ON DELETE RESTRICT ON UPDATE CASCADE,
    id_institucion  BIGINT       NOT NULL,
    anio_lectivo    INTEGER      NOT NULL,
    nivel           VARCHAR(30)  NOT NULL,
    grado           VARCHAR(20)  NOT NULL,
    seccion         VARCHAR(20)  NOT NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO'
                        CONSTRAINT chk_matricula_estado
                        CHECK (estado IN ('ACTIVO','RETIRADO','TRASLADADO','CULMINADO')),
    fecha_matricula DATE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matriculas_estudiante
    ON matriculas(id_estudiante);

CREATE INDEX IF NOT EXISTS idx_matriculas_institucion
    ON matriculas(id_institucion);

CREATE INDEX IF NOT EXISTS idx_matriculas_anio
    ON matriculas(anio_lectivo);

CREATE INDEX IF NOT EXISTS idx_matriculas_grado
    ON matriculas(grado);

CREATE INDEX IF NOT EXISTS idx_matriculas_seccion
    ON matriculas(seccion);

CREATE INDEX IF NOT EXISTS idx_matriculas_estado
    ON matriculas(estado);

COMMIT;