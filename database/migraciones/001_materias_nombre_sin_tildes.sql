-- =========================================================
-- Migración 001 (issue #26): el nombre de materia repetido ignora también las tildes.
--
-- Solo para una base de datos que YA tiene datos (por ejemplo, la de Render).
-- Una base nueva ya crea el índice así desde database/init/01_schema.sql.
--
-- Uso:  psql "<URL de la base>" -f database/migraciones/001_materias_nombre_sin_tildes.sql
--
-- Todo va en una transacción: si algo falla, la base queda exactamente como estaba.
-- =========================================================
\set ON_ERROR_STOP on
BEGIN;

-- Materias que ya chocarían con la regla nueva ("Cálculo" y "Calculo" del mismo usuario).
-- Si aparece alguna, el CREATE INDEX de abajo falla: renombrar o borrar una de ellas y volver a correr.
SELECT usuario_id, array_agg(nombre ORDER BY id) AS materias_que_chocan
FROM materias
GROUP BY usuario_id, LOWER(translate(trim(nombre), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU'))
HAVING count(*) > 1;

DROP INDEX IF EXISTS materias_nombre_unico;
CREATE UNIQUE INDEX materias_nombre_unico
    ON materias (usuario_id, LOWER(translate(trim(nombre), 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')));

COMMIT;
