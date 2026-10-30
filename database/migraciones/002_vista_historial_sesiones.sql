-- =========================================================
-- Migración 002 (issue #11): vista del historial de sesiones para el panel de estadísticas.
--
-- Solo para una base de datos que YA tiene datos (por ejemplo, la de Render).
-- Una base nueva ya crea la vista y el índice desde database/init/01_schema.sql.
--
-- Uso:  psql "<URL de la base>" -f database/migraciones/002_vista_historial_sesiones.sql
--
-- No toca ningún dato: solo agrega una vista y un índice. Se puede correr más de una vez.
-- =========================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE VIEW v_historial_sesiones AS
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

CREATE INDEX IF NOT EXISTS sesiones_materia_inicio_idx ON sesiones (materia_id, inicio);

COMMIT;
