-- =========================================================
-- Migración 003 (issue #38): tablas del coach y del quiz, y daño extra del quiz al Jefe Final.
--
-- Solo para una base de datos que YA tiene datos (por ejemplo, la de producción).
-- Una base nueva ya crea todo esto desde database/init/01_schema.sql.
--
-- Uso:  psql "<URL de la base>" -f database/migraciones/003_ia_consejos_quiz.sql
--
-- No toca ningún dato: agrega tablas e índices y recrea la vista v_estado_jefe con la columna
-- nueva `dano_quiz` al final. Se puede correr más de una vez.
-- =========================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS consejos_ia (
    id         SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    texto      TEXT NOT NULL CHECK (length(trim(texto)) > 0),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consejos_ia_usuario_idx ON consejos_ia (usuario_id, creado_en);

CREATE TABLE IF NOT EXISTS quizzes (
    id            SERIAL PRIMARY KEY,
    sesion_id     INT NOT NULL UNIQUE REFERENCES sesiones(id) ON DELETE CASCADE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    respondido_en TIMESTAMPTZ,
    aciertos      SMALLINT CHECK (aciertos BETWEEN 0 AND 5),
    CHECK ((respondido_en IS NULL) = (aciertos IS NULL)),
    CHECK (respondido_en IS NULL OR respondido_en >= creado_en)
);

CREATE TABLE IF NOT EXISTS quiz_preguntas (
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

CREATE OR REPLACE VIEW v_estado_jefe AS
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

COMMIT;
