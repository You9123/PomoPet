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

-- Catálogo: colores disponibles de cada especie. `codigo` es la carpeta de las imágenes:
-- frontend/public/mascotas/<especie>/<codigo>/. Cada especie tiene siempre la variante 'clasico'.
-- Se genera con `npm run sprites:variantes` (04_variantes.sql).
CREATE TABLE variantes_mascota (
    especie_id INT         NOT NULL REFERENCES especies_mascota(id),
    codigo     VARCHAR(30) NOT NULL,
    nombre     VARCHAR(50) NOT NULL,
    muestra    CHAR(7)     NOT NULL CHECK (muestra ~ '^#[0-9A-Fa-f]{6}$'),  -- color del selector
    orden      SMALLINT    NOT NULL,
    PRIMARY KEY (especie_id, codigo)
);

-- Una mascota por usuario (la llave primaria es usuario_id)
-- La etapa de evolución y el estado NO se guardan: se calculan (XP total y sesión actual)
CREATE TABLE mascotas (
    usuario_id INT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    especie_id INT NOT NULL REFERENCES especies_mascota(id),   -- no deja borrar una especie en uso
    variante   VARCHAR(30) NOT NULL DEFAULT 'clasico',
    nombre     VARCHAR(50) NOT NULL CHECK (length(trim(nombre)) > 0),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- el color tiene que ser uno de los de SU especie
    FOREIGN KEY (especie_id, variante) REFERENCES variantes_mascota (especie_id, codigo)
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
-- Nombre único por usuario sin importar mayúsculas, espacios ni tildes ("Cálculo" = "calculo").
-- Se usa translate() y no la extensión unaccent porque esta convierte la ñ en n ("Año" = "Ano").
CREATE UNIQUE INDEX materias_nombre_unico ON materias (usuario_id, LOWER(translate(trim(nombre), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')));

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

-- ---------- INTELIGENCIA ARTIFICIAL (issue #38) ----------

-- Consejos de la mascota (RF-14). Se guardan para mostrar el último y contar el tope de 3 por día.
CREATE TABLE consejos_ia (
    id         SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto      TEXT NOT NULL CHECK (length(trim(texto)) > 0),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX consejos_ia_usuario_idx ON consejos_ia (usuario_id, creado_en);

-- Quiz contra el Jefe Final (RF-15): uno por sesión. Los apuntes del estudiante NO se guardan.
-- Que la sesión esté completada y tenga un jefe vivo lo valida el backend al crearlo.
CREATE TABLE quizzes (
    id            SERIAL PRIMARY KEY,
    sesion_id     INT NOT NULL UNIQUE REFERENCES sesiones(id) ON DELETE CASCADE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    respondido_en TIMESTAMPTZ,                  -- NULL = todavía sin responder
    aciertos      SMALLINT CHECK (aciertos BETWEEN 0 AND 5),
    -- respondido <=> tiene aciertos
    CHECK ((respondido_en IS NULL) = (aciertos IS NULL)),
    CHECK (respondido_en IS NULL OR respondido_en >= creado_en)
);

-- Las 5 preguntas de cada quiz. `orden` y `correcta` son índices desde 0, igual que en la API.
CREATE TABLE quiz_preguntas (
    quiz_id   INT      NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    orden     SMALLINT NOT NULL CHECK (orden BETWEEN 0 AND 4),
    enunciado TEXT     NOT NULL CHECK (length(trim(enunciado)) > 0),
    opcion_0  TEXT     NOT NULL,
    opcion_1  TEXT     NOT NULL,
    opcion_2  TEXT     NOT NULL,
    opcion_3  TEXT     NOT NULL,
    correcta  SMALLINT NOT NULL CHECK (correcta BETWEEN 0 AND 3),
    PRIMARY KEY (quiz_id, orden)
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

-- Estado del Jefe Final (RF-06, RF-12): cada pomodoro completado le quita 1 HP, y cada quiz
-- respondido con 4 o más aciertos le quita 1 HP extra (RF-16).
-- Como quizzes.sesion_id es UNIQUE, unir los quizzes no repite sesiones: COUNT(s.id) no cambia.
-- dano_quiz va de última porque CREATE OR REPLACE VIEW solo admite columnas nuevas al final.
CREATE VIEW v_estado_jefe AS
SELECT j.id AS jefe_id,
       j.materia_id,
       j.nombre,
       j.hp_total,
       j.fecha_limite,
       COUNT(s.id)::INT                                       AS pomodoros_recibidos,
       GREATEST(j.hp_total - COUNT(s.id) - COUNT(q.id), 0)::INT AS hp_actual,
       COUNT(s.id) + COUNT(q.id) >= j.hp_total                 AS derrotado,
       COUNT(q.id)::INT                                       AS dano_quiz
FROM jefes_finales j
LEFT JOIN sesiones s ON s.jefe_id = j.id AND s.estado = 'completada'
LEFT JOIN quizzes q  ON q.sesion_id = s.id AND q.aciertos >= 4
GROUP BY j.id;

-- Historial de sesiones terminadas (RF-08, issue #11): una fila por sesión completada o cancelada,
-- con el tiempo en pausa y el tiempo efectivo (fin - inicio - pausas). Las sesiones en curso no
-- aparecen: su tiempo todavía cambia. El XP no se guarda: lo calcula el backend.
CREATE VIEW v_historial_sesiones AS
SELECT s.id AS sesion_id,
       m.usuario_id,
       s.materia_id,
       s.jefe_id,
       s.estado,
       s.inicio,
       s.fin,
       COALESCE(p.pausado, interval '0') AS pausado,
       GREATEST(s.fin - s.inicio - COALESCE(p.pausado, interval '0'), interval '0') AS efectivo
FROM sesiones s
JOIN materias m ON m.id = s.materia_id
LEFT JOIN LATERAL (
    SELECT SUM(pa.fin - pa.inicio) AS pausado
    FROM pausas pa
    WHERE pa.sesion_id = s.id
) p ON true
WHERE s.estado <> 'en_curso';

-- El historial y las estadísticas filtran las sesiones de un usuario por fecha de inicio
CREATE INDEX sesiones_materia_inicio_idx ON sesiones (materia_id, inicio);
