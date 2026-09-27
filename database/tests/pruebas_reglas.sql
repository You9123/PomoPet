-- =========================================================
-- Pruebas de las reglas del esquema (Issue #1)
-- Corre dentro de una transacción que se deshace al final:
-- no deja ningún dato en la base de datos.
-- =========================================================
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    u1 INT; u2 INT;          -- usuarios
    m1 INT; m2 INT;          -- materias
    j1 INT;                  -- jefe final
    xp INT;
BEGIN
    INSERT INTO usuarios (correo, password_hash) VALUES ('ana@una.ac.cr',  'hash') RETURNING id INTO u1;
    INSERT INTO usuarios (correo, password_hash) VALUES ('beto@una.ac.cr', 'hash') RETURNING id INTO u2;

    -- 1. Correo repetido con otras mayúsculas
    BEGIN
        INSERT INTO usuarios (correo, password_hash) VALUES ('ANA@una.ac.cr', 'hash');
        RAISE EXCEPTION 'FALLO: aceptó un correo repetido';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK  1. correo repetido rechazado';
    END;

    -- 2. Correo sin formato válido
    BEGIN
        INSERT INTO usuarios (correo, password_hash) VALUES ('esto-no-es-correo', 'hash');
        RAISE EXCEPTION 'FALLO: aceptó un correo inválido';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  2. correo inválido rechazado';
    END;

    -- 3. Tope de 20 materias (RF-02): la 20 entra, la 21 no
    INSERT INTO materias (usuario_id, nombre)
    SELECT u1, 'Materia ' || n FROM generate_series(1, 20) AS n;
    BEGIN
        INSERT INTO materias (usuario_id, nombre) VALUES (u1, 'Materia 21');
        RAISE EXCEPTION 'FALLO: aceptó la materia 21';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  3. materia 21 rechazada (20 aceptadas)';
    END;

    -- 4. Color con formato inválido
    BEGIN
        INSERT INTO materias (usuario_id, nombre, color) VALUES (u2, 'Física', 'rojo');
        RAISE EXCEPTION 'FALLO: aceptó un color inválido';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  4. color inválido rechazado';
    END;

    -- Datos para las pruebas de sesiones
    SELECT id INTO m1 FROM materias WHERE usuario_id = u1 AND nombre = 'Materia 1';
    INSERT INTO materias (usuario_id, nombre) VALUES (u2, 'Cálculo') RETURNING id INTO m2;
    INSERT INTO jefes_finales (materia_id, nombre, hp_total, hp_actual)
    VALUES (m1, 'Parcial 1', 2, 2) RETURNING id INTO j1;

    -- 5. Sesión de una materia apuntando al Jefe de OTRA materia
    BEGIN
        INSERT INTO sesiones (materia_id, jefe_id) VALUES (m2, j1);
        RAISE EXCEPTION 'FALLO: aceptó un jefe de otra materia';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'OK  5. jefe de otra materia rechazado';
    END;

    -- 6. Sesión cancelada con XP (RF-11)
    BEGIN
        INSERT INTO sesiones (materia_id, inicio, fin, estado, xp_otorgado)
        VALUES (m1, now() - interval '5 minutes', now(), 'cancelada', 100);
        RAISE EXCEPTION 'FALLO: una sesión cancelada dio XP';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  6. sesión cancelada con XP rechazada';
    END;

    -- 7. Sesión "completada" sin hora de fin
    BEGIN
        INSERT INTO sesiones (materia_id, estado) VALUES (m1, 'completada');
        RAISE EXCEPTION 'FALLO: aceptó una sesión completada sin fin';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  7. sesión completada sin fin rechazada';
    END;

    -- 8. El Jefe queda derrotado solo al llegar a HP 0 (RF-12)
    UPDATE jefes_finales SET hp_actual = 0 WHERE id = j1;
    IF NOT (SELECT derrotado FROM jefes_finales WHERE id = j1) THEN
        RAISE EXCEPTION 'FALLO: el jefe con HP 0 no quedó derrotado';
    END IF;
    RAISE NOTICE 'OK  8. jefe con HP 0 marcado como derrotado';

    -- 9. La vista suma el XP de las sesiones completadas
    INSERT INTO sesiones (materia_id, inicio, fin, estado, xp_otorgado) VALUES
        (m1, now() - interval '25 minutes', now(), 'completada', 100),
        (m1, now() - interval '25 minutes', now(), 'completada', 100),
        (m1, now() - interval '5 minutes',  now(), 'cancelada',  0);
    SELECT xp_total INTO xp FROM v_progreso_materia WHERE materia_id = m1;
    IF xp <> 200 THEN
        RAISE EXCEPTION 'FALLO: la vista dio % XP en vez de 200', xp;
    END IF;
    RAISE NOTICE 'OK  9. la vista suma 200 XP (la cancelada no cuenta)';

    -- 10. Un logro no se puede obtener dos veces
    INSERT INTO logros_usuario (usuario_id, logro_id)
    SELECT u1, id FROM logros WHERE codigo = 'primer_pomodoro';
    BEGIN
        INSERT INTO logros_usuario (usuario_id, logro_id)
        SELECT u1, id FROM logros WHERE codigo = 'primer_pomodoro';
        RAISE EXCEPTION 'FALLO: aceptó el mismo logro dos veces';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK 10. logro repetido rechazado';
    END;

    RAISE NOTICE '=== Todas las pruebas pasaron ===';
END;
$$;

ROLLBACK;