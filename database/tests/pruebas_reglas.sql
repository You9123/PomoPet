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
    m1 INT; m2 INT; m3 INT;  -- materias
    j1 INT;                  -- jefe final
    s1 INT;                  -- sesión
    gato INT;                -- especie
    u3 INT;                  -- usuario sin mascota (prueba 19 y 20)
    v_int INT; v_bool BOOLEAN;
BEGIN
    INSERT INTO usuarios (correo, password_hash) VALUES ('ana@una.ac.cr',  'hash') RETURNING id INTO u1;
    INSERT INTO usuarios (correo, password_hash) VALUES ('beto@una.ac.cr', 'hash') RETURNING id INTO u2;

    -- ===================== USUARIOS =====================

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

    -- 3. Descanso largo fuera de 15-30 minutos (RF-10)
    BEGIN
        UPDATE usuarios SET descanso_largo_min = 40 WHERE id = u1;
        RAISE EXCEPTION 'FALLO: aceptó un descanso largo de 40 min';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  3. descanso largo de 40 min rechazado';
    END;

    -- ===================== MASCOTAS =====================

    SELECT id INTO gato FROM especies_mascota WHERE codigo = 'gato';
    INSERT INTO mascotas (usuario_id, especie_id, nombre) VALUES (u1, gato, 'Michi');

    -- 4. Un usuario solo puede tener una mascota
    BEGIN
        INSERT INTO mascotas (usuario_id, especie_id, nombre) VALUES (u1, gato, 'Otra');
        RAISE EXCEPTION 'FALLO: aceptó una segunda mascota';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK  4. segunda mascota rechazada';
    END;

    -- 5. Nombre de mascota solo con espacios
    BEGIN
        INSERT INTO mascotas (usuario_id, especie_id, nombre) VALUES (u2, gato, '   ');
        RAISE EXCEPTION 'FALLO: aceptó una mascota sin nombre';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  5. mascota sin nombre rechazada';
    END;

    -- 6. No se puede borrar una especie que alguien usa
    BEGIN
        DELETE FROM especies_mascota WHERE id = gato;
        RAISE EXCEPTION 'FALLO: borró una especie en uso';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'OK  6. especie en uso no se puede borrar';
    END;

    -- ===================== MATERIAS =====================

    -- 7. Tope de 20 materias (RF-02): la 20 entra, la 21 no
    INSERT INTO materias (usuario_id, nombre)
    SELECT u1, 'Materia ' || n FROM generate_series(1, 20) AS n;
    BEGIN
        INSERT INTO materias (usuario_id, nombre) VALUES (u1, 'Materia 21');
        RAISE EXCEPTION 'FALLO: aceptó la materia 21';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  7. materia 21 rechazada (20 aceptadas)';
    END;

    -- 8. El tope tampoco se salta moviendo una materia de otro usuario (UPDATE)
    INSERT INTO materias (usuario_id, nombre) VALUES (u2, 'Cálculo') RETURNING id INTO m2;
    BEGIN
        UPDATE materias SET usuario_id = u1 WHERE id = m2;
        RAISE EXCEPTION 'FALLO: el UPDATE se saltó el tope de 20';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK  8. UPDATE que pasa el tope rechazado';
    END;

    -- 9. Nombre repetido sin importar mayúsculas ni espacios
    BEGIN
        INSERT INTO materias (usuario_id, nombre) VALUES (u2, '  cálculo ');
        RAISE EXCEPTION 'FALLO: aceptó una materia repetida';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK  9. materia repetida (" cálculo ") rechazada';
    END;

    -- 10. Color con formato inválido
    BEGIN
        INSERT INTO materias (usuario_id, nombre, color) VALUES (u2, 'Física', 'rojo');
        RAISE EXCEPTION 'FALLO: aceptó un color inválido';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 10. color inválido rechazado';
    END;

    -- ============= JEFES FINALES Y SESIONES =============

    SELECT id INTO m1 FROM materias WHERE usuario_id = u1 AND nombre = 'Materia 1';
    INSERT INTO jefes_finales (materia_id, nombre, hp_total)
    VALUES (m1, 'Parcial 1', 2) RETURNING id INTO j1;

    -- 11. Nombre de jefe solo con espacios
    BEGIN
        INSERT INTO jefes_finales (materia_id, nombre, hp_total) VALUES (m1, '   ', 3);
        RAISE EXCEPTION 'FALLO: aceptó un jefe sin nombre';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 11. jefe sin nombre rechazado';
    END;

    -- 12. Sesión de una materia apuntando al Jefe de OTRA materia
    BEGIN
        INSERT INTO sesiones (materia_id, jefe_id) VALUES (m2, j1);
        RAISE EXCEPTION 'FALLO: aceptó un jefe de otra materia';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'OK 12. jefe de otra materia rechazado';
    END;

    -- 13. Sesión "completada" sin hora de fin
    BEGIN
        INSERT INTO sesiones (materia_id, estado) VALUES (m1, 'completada');
        RAISE EXCEPTION 'FALLO: aceptó una sesión completada sin fin';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 13. sesión completada sin fin rechazada';
    END;

    -- 14. Jefe (RF-12): una cancelada no le hace daño; 2 completadas lo derrotan
    INSERT INTO sesiones (materia_id, jefe_id, inicio, fin, estado)
    VALUES (m1, j1, now() - interval '25 minutes', now(), 'completada'),
           (m1, j1, now() - interval '5 minutes',  now(), 'cancelada');
    SELECT hp_actual, derrotado INTO v_int, v_bool FROM v_estado_jefe WHERE jefe_id = j1;
    IF v_int <> 1 OR v_bool THEN
        RAISE EXCEPTION 'FALLO: con 1 pomodoro el jefe debía tener HP 1 (tiene %)', v_int;
    END IF;
    INSERT INTO sesiones (materia_id, jefe_id, inicio, fin, estado)
    VALUES (m1, j1, now() - interval '25 minutes', now(), 'completada');
    SELECT hp_actual, derrotado INTO v_int, v_bool FROM v_estado_jefe WHERE jefe_id = j1;
    IF v_int <> 0 OR NOT v_bool THEN
        RAISE EXCEPTION 'FALLO: con 2 pomodoros el jefe debía quedar derrotado';
    END IF;
    RAISE NOTICE 'OK 14. jefe: HP 2 -> 1 -> 0 y derrotado (la cancelada no cuenta)';

    -- ====================== PAUSAS ======================

    INSERT INTO sesiones (materia_id) VALUES (m1) RETURNING id INTO s1;
    INSERT INTO pausas (sesion_id) VALUES (s1);

    -- 15. Solo una pausa abierta por sesión
    BEGIN
        INSERT INTO pausas (sesion_id) VALUES (s1);
        RAISE EXCEPTION 'FALLO: aceptó dos pausas abiertas';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK 15. segunda pausa abierta rechazada';
    END;

    -- 16. Pausa que termina antes de empezar
    BEGIN
        INSERT INTO pausas (sesion_id, inicio, fin) VALUES (s1, now(), now() - interval '1 minute');
        RAISE EXCEPTION 'FALLO: aceptó una pausa con fin antes del inicio';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK 16. pausa con fin antes del inicio rechazada';
    END;

    -- ====================== VISTAS ======================

    -- 17. Progreso: 30 min con 5 min de pausa = 25 min estudiados; canceladas aparte
    INSERT INTO materias (usuario_id, nombre) VALUES (u2, 'Química') RETURNING id INTO m3;
    INSERT INTO sesiones (materia_id, inicio, fin, estado)
    VALUES (m3, now() - interval '30 minutes', now(), 'completada') RETURNING id INTO s1;
    INSERT INTO pausas (sesion_id, inicio, fin)
    VALUES (s1, now() - interval '20 minutes', now() - interval '15 minutes');
    INSERT INTO sesiones (materia_id, inicio, fin, estado)
    VALUES (m3, now() - interval '10 minutes', now(), 'cancelada');
    PERFORM 1 FROM v_progreso_materia
    WHERE materia_id = m3
      AND pomodoros_completados = 1
      AND pomodoros_cancelados = 1
      AND minutos_estudiados = 25;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FALLO: la vista de progreso no dio 1 completado, 1 cancelado y 25 min';
    END IF;
    RAISE NOTICE 'OK 17. progreso: 25 min estudiados (se restó la pausa)';

    -- ====================== LOGROS ======================

    -- 18. Un logro no se puede obtener dos veces
    INSERT INTO logros_usuario (usuario_id, logro_id)
    SELECT u1, id FROM logros WHERE codigo = 'primer_pomodoro';
    BEGIN
        INSERT INTO logros_usuario (usuario_id, logro_id)
        SELECT u1, id FROM logros WHERE codigo = 'primer_pomodoro';
        RAISE EXCEPTION 'FALLO: aceptó el mismo logro dos veces';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'OK 18. logro repetido rechazado';
    END;

    -- ================ COLORES DE MASCOTA ================

    INSERT INTO usuarios (correo, password_hash) VALUES ('carla@una.ac.cr', 'hash') RETURNING id INTO u3;

    -- 19. Un color de otra especie (fuego es del dragón) no se puede usar en un gato
    BEGIN
        INSERT INTO mascotas (usuario_id, especie_id, variante, nombre) VALUES (u3, gato, 'fuego', 'Brasas');
        RAISE EXCEPTION 'FALLO: aceptó un color de otra especie';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'OK 19. color de otra especie rechazado';
    END;

    -- 20. Si no se elige color, queda el clásico
    INSERT INTO mascotas (usuario_id, especie_id, nombre) VALUES (u3, gato, 'Nube');
    IF (SELECT variante FROM mascotas WHERE usuario_id = u3) <> 'clasico' THEN
        RAISE EXCEPTION 'FALLO: el color por defecto no es clasico';
    END IF;
    RAISE NOTICE 'OK 20. color por defecto: clasico';

    RAISE NOTICE '=== Todas las pruebas pasaron ===';
END;
$$;

ROLLBACK;
