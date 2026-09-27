-- =========================================================
-- PomoPet - Modelo de datos (PostgreSQL 16)
-- =========================================================

-- ---------- USUARIOS ----------

CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    correo        VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,          -- RNF-05: nunca texto plano
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
    CONSTRAINT correo_formato CHECK (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
-- Correo único sin importar mayúsculas (Ana@UNA.ac.cr = ana@una.ac.cr)
CREATE UNIQUE INDEX usuarios_correo_unico ON usuarios (LOWER(correo));
-- ---------- MATERIAS ----------

CREATE TABLE materias (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre          VARCHAR(100) NOT NULL CHECK (length(trim(nombre)) > 0),
    color           CHAR(7) NOT NULL DEFAULT '#888888' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    horas_semanales SMALLINT CHECK (horas_semanales BETWEEN 0 AND 168),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, nombre)
);

CREATE TABLE jefes_finales (
    id           SERIAL PRIMARY KEY,
    materia_id   INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    nombre       VARCHAR(100) NOT NULL,
    hp_total     INT NOT NULL CHECK (hp_total > 0),   -- RF-12: HP en pomodoros
    hp_actual    INT NOT NULL CHECK (hp_actual >= 0),
    fecha_limite DATE,
    derrotado    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE sesiones (
    id          SERIAL PRIMARY KEY,
    materia_id  INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    jefe_id     INT REFERENCES jefes_finales(id) ON DELETE SET NULL,
    inicio      TIMESTAMPTZ NOT NULL,
    fin         TIMESTAMPTZ,
    estado      VARCHAR(20) NOT NULL DEFAULT 'en_curso'
                CHECK (estado IN ('en_curso', 'completada', 'cancelada')),
    xp_otorgado INT NOT NULL DEFAULT 0
);