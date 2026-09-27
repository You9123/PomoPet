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

-- ---------- JEFES FINALES ----------

CREATE TABLE jefes_finales (
    id           SERIAL PRIMARY KEY,
    materia_id   INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    nombre       VARCHAR(100) NOT NULL,
    hp_total     INT NOT NULL CHECK (hp_total > 0),          -- RF-12: HP en pomodoros
    hp_actual    INT NOT NULL CHECK (hp_actual >= 0),
    fecha_limite DATE,
    derrotado    BOOLEAN GENERATED ALWAYS AS (hp_actual = 0) STORED,  -- RF-12
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (hp_actual <= hp_total),
    UNIQUE (id, materia_id)   -- permite que sesiones valide jefe + materia juntos
);
CREATE INDEX jefes_finales_materia_idx ON jefes_finales (materia_id);

-- ---------- Sesiones ----------

CREATE TABLE sesiones (
    id            SERIAL PRIMARY KEY,
    materia_id    INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    jefe_id       INT,
    inicio        TIMESTAMPTZ NOT NULL DEFAULT now(),    -- RF-09: lo fija el servidor
    fin           TIMESTAMPTZ,
    estado        VARCHAR(20) NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'completada', 'cancelada')),    -- RF-11
    xp_otorgado   INT NOT NULL DEFAULT 0 CHECK (xp_otorgado >= 0),
    -- el jefe debe pertenecer a la MISMA materia de la sesión
    FOREIGN KEY (jefe_id, materia_id) 
        REFERENCES jefes_finales(id, materia_id) ON DELETE SET NULL (jefe_id),
    -- en curso <=> sin fin
    CHECK ((estado = 'en_curso') = (fin IS NULL)),
    CHECK (fin IS NULL OR fin >= inicio),
    -- RF-11: solo una sesión completada puede dar XP
    CHECK (estado = 'completada' OR xp_otorgado = 0)
);
CREATE INDEX sesiones_materia_idx ON sesiones (materia_id);
CREATE INDEX sesiones_jefe_idx ON sesiones (jefe_id);