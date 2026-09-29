-- =========================================================
-- PomoPet - Modelo de datos (PostgreSQL 16)
-- =========================================================

-- ---------- USUARIOS ----------

CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    correo        VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,          -- RNF-05: nunca texto plano
    descanso_largo_min SMALLINT NOT NULL DEFAULT 15
        CHECK (descanso_largo_min BETWEEN 15 AND 30),    -- RF-10
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT correo_formato CHECK (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
-- Correo único sin importar mayúsculas (Ana@UNA.ac.cr = ana@una.ac.cr)
CREATE UNIQUE INDEX usuarios_correo_unico ON usuarios (LOWER(correo));

-- ---------- MASCOTAS ----------

-- Catálogo: especies que el usuario puede elegir al crear su cuenta
CREATE TABLE especies_mascota (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(50)  NOT NULL UNIQUE,   -- nombre de la carpeta de imágenes en el frontend
    nombre      VARCHAR(100) NOT NULL,
    descripcion TEXT         NOT NULL
);

-- Una mascota por usuario (la llave primaria es usuario_id)
-- La etapa de evolución y el estado NO se guardan: se calculan (XP total y sesión actual)
CREATE TABLE mascotas (
    usuario_id INT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    especie_id INT NOT NULL REFERENCES especies_mascota(id),   -- no deja borrar una especie en uso
    nombre     VARCHAR(50) NOT NULL CHECK (length(trim(nombre)) > 0),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mascotas_especie_idx ON mascotas (especie_id);

-- ---------- MATERIAS ----------

CREATE TABLE materias (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre          VARCHAR(100) NOT NULL CHECK (length(trim(nombre)) > 0),
    color           CHAR(7) NOT NULL DEFAULT '#888888' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    horas_semanales SMALLINT CHECK (horas_semanales BETWEEN 0 AND 168),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Nombre único por usuario sin importar mayúsculas ni espacios 
CREATE UNIQUE INDEX materias_nombre_unico ON materias (usuario_id, LOWER(trim(nombre)));

-- ---------- JEFES FINALES ----------

CREATE TABLE jefes_finales (
    id           SERIAL PRIMARY KEY,
    materia_id   INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    nombre       VARCHAR(100) NOT NULL CHECK (length(trim(nombre)) > 0),
    hp_total     INT NOT NULL CHECK (hp_total > 0),          -- RF-12: HP en pomodoros
    fecha_limite DATE,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- hp_actual y derrotado se calculan en la vista v_estado_jefe
    UNIQUE (id, materia_id)   -- permite que sesiones valide jefe + materia juntos
);
CREATE INDEX jefes_finales_materia_idx ON jefes_finales (materia_id);

-- ---------- SESIONES ----------

CREATE TABLE sesiones (
    id            SERIAL PRIMARY KEY,
    materia_id    INT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    jefe_id       INT,
    inicio        TIMESTAMPTZ NOT NULL DEFAULT now(),    -- RF-09: lo fija el servidor
    fin           TIMESTAMPTZ,
    estado        VARCHAR(20) NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'completada', 'cancelada')),    -- RF-11
    -- el jefe debe pertenecer a la MISMA materia de la sesión
    FOREIGN KEY (jefe_id, materia_id)
        REFERENCES jefes_finales(id, materia_id) ON DELETE SET NULL (jefe_id),
    -- en curso <=> sin fin
    CHECK ((estado = 'en_curso') = (fin IS NULL)),
    CHECK (fin IS NULL OR fin >= inicio)
);
CREATE INDEX sesiones_materia_idx ON sesiones (materia_id);
CREATE INDEX sesiones_jefe_idx ON sesiones (jefe_id);

-- ---------- PAUSAS ----------

-- RF-01 / RF-09: el tiempo en pausa no cuenta como tiempo estudiado
CREATE TABLE pausas (
    id        SERIAL PRIMARY KEY,
    sesion_id INT NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    inicio    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin       TIMESTAMPTZ,                      -- NULL = la pausa sigue activa
    CHECK (fin IS NULL OR fin >= inicio)
);
CREATE INDEX pausas_sesion_idx ON pausas (sesion_id);
-- Una sesión solo puede tener una pausa abierta a la vez
CREATE UNIQUE INDEX pausas_una_abierta ON pausas (sesion_id) WHERE fin IS NULL;

-- ---------- LOGROS ----------

-- Catálogo: la lista de logros que existen en el juego
CREATE TABLE logros (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(50)  NOT NULL UNIQUE,
    nombre      VARCHAR(100) NOT NULL,
    descripcion TEXT         NOT NULL
);

-- Qué logros ha desbloqueado cada usuario (relación muchos a muchos)
CREATE TABLE logros_usuario (
    usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    logro_id    INT NOT NULL REFERENCES logros(id)   ON DELETE CASCADE,
    obtenido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, logro_id)
);

-- ---------- TRIGGER ----------
-- ---------- RF-02: tope de 20 materias por usuario ----------

CREATE FUNCTION validar_tope_materias() RETURNS trigger AS $$
BEGIN
    -- bloquea al usuario para que dos inserts simultáneos no pasen ambos
    PERFORM 1 FROM usuarios WHERE id = NEW.usuario_id FOR UPDATE;

    IF (SELECT COUNT(*) FROM materias WHERE usuario_id = NEW.usuario_id AND id <> NEW.id) >= 20 THEN
        RAISE EXCEPTION 'El usuario % ya tiene 20 materias (RF-02)', NEW.usuario_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER materias_tope_20
    BEFORE INSERT OR UPDATE OF usuario_id ON materias
    FOR EACH ROW EXECUTE FUNCTION validar_tope_materias();
    
-- ---------- VISTAS ----------

-- Progreso por materia. El XP no se guarda: lo calcula el backend (100 x pomodoro, RF-03)
CREATE VIEW v_progreso_materia AS
SELECT m.id AS materia_id,
       m.usuario_id,
       m.nombre,
       COUNT(s.id) FILTER (WHERE s.estado = 'completada') AS pomodoros_completados,
       COUNT(s.id) FILTER (WHERE s.estado = 'cancelada')  AS pomodoros_cancelados,
       -- minutos de sesiones completadas, restando el tiempo en pausa
       COALESCE(SUM(EXTRACT(EPOCH FROM (s.fin - s.inicio - COALESCE(p.pausado, interval '0'))) / 60)
                FILTER (WHERE s.estado = 'completada'), 0)::INT AS minutos_estudiados
FROM materias m
LEFT JOIN sesiones s ON s.materia_id = m.id
LEFT JOIN LATERAL (
    SELECT SUM(pa.fin - pa.inicio) AS pausado
    FROM pausas pa
    WHERE pa.sesion_id = s.id
) p ON true
GROUP BY m.id;

-- Estado del Jefe Final (RF-06, RF-12): cada pomodoro completado le quita 1 HP
CREATE VIEW v_estado_jefe AS
SELECT j.id AS jefe_id,
       j.materia_id,
       j.nombre,
       j.hp_total,
       j.fecha_limite,
       COUNT(s.id)::INT                          AS pomodoros_recibidos,
       GREATEST(j.hp_total - COUNT(s.id), 0)::INT AS hp_actual,
       COUNT(s.id) >= j.hp_total                  AS derrotado
FROM jefes_finales j
LEFT JOIN sesiones s ON s.jefe_id = j.id AND s.estado = 'completada'
GROUP BY j.id;
