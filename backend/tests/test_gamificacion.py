"""Pruebas de la lógica de gamificación (issue #7, RNF-08).

Complementa `test_pomodoro.py` (XP, caso límite 24:59 vs 25:00 con y sin pausas) y `test_sesiones.py`
(mismo caso límite por la API). Aquí van el tope de materias (20 vs 21), el daño al Jefe Final y el XP
acumulado por materia, que viven en la BD.

Pendiente: niveles/rangos y etapas de evolución de la mascota. Todavía no existen en el código; sus
pruebas se agregan cuando se implementen (criterios del issue #7).
"""
from datetime import datetime, timedelta

import psycopg
import pytest

from app.pomodoro import XP_POR_POMODORO, xp_por_sesion

INICIO = datetime(2026, 1, 1, 10, 0, 0)


# ---------- Utilidades ----------

def crear_usuario(conn, correo="ana@una.ac.cr"):
    return conn.execute(
        "INSERT INTO usuarios (correo, password_hash) VALUES (%s, 'hash') RETURNING id", (correo,)
    ).fetchone()["id"]


def crear_materia(conn, usuario_id, nombre="Cálculo"):
    return conn.execute(
        "INSERT INTO materias (usuario_id, nombre) VALUES (%s, %s) RETURNING id", (usuario_id, nombre)
    ).fetchone()["id"]


def crear_jefe(conn, materia_id, hp_total):
    return conn.execute(
        "INSERT INTO jefes_finales (materia_id, nombre, hp_total) VALUES (%s, 'Parcial', %s) RETURNING id",
        (materia_id, hp_total),
    ).fetchone()["id"]


def agregar_sesion(conn, materia_id, estado, jefe_id=None, minutos=25):
    conn.execute(
        """
        INSERT INTO sesiones (materia_id, jefe_id, estado, inicio, fin)
        VALUES (%s, %s, %s, now() - make_interval(mins => %s), now())
        """,
        (materia_id, jefe_id, estado, minutos),
    )


def estado_jefe(conn, jefe_id):
    return conn.execute("SELECT * FROM v_estado_jefe WHERE jefe_id = %s", (jefe_id,)).fetchone()


# ---------- XP: bordes que las otras pruebas no cubren ----------

def test_un_microsegundo_antes_de_25_minutos_no_da_xp():
    fin = INICIO + timedelta(minutes=25) - timedelta(microseconds=1)
    assert xp_por_sesion(INICIO, fin) == 0


def test_la_pausa_se_resta_con_precision_de_microsegundos():
    fin = INICIO + timedelta(minutes=35)
    assert xp_por_sesion(INICIO, fin, pausado=timedelta(minutes=10, microseconds=1)) == 0
    assert xp_por_sesion(INICIO, fin, pausado=timedelta(minutes=10)) == XP_POR_POMODORO


def test_un_pomodoro_da_siempre_100_xp():
    assert XP_POR_POMODORO == 100


# ---------- Tope de materias: 20 sí, 21 no (RF-02) ----------

def test_la_materia_20_se_acepta_y_la_21_se_rechaza(conn):
    usuario = crear_usuario(conn)
    for i in range(20):
        crear_materia(conn, usuario, f"Materia {i}")

    conn.execute("SAVEPOINT intento")
    with pytest.raises(psycopg.errors.CheckViolation):
        crear_materia(conn, usuario, "Materia 21")
    conn.execute("ROLLBACK TO SAVEPOINT intento")

    total = conn.execute("SELECT COUNT(*) AS n FROM materias WHERE usuario_id = %s", (usuario,)).fetchone()["n"]
    assert total == 20


def test_el_tope_es_por_usuario(conn):
    ana, beto = crear_usuario(conn, "ana@una.ac.cr"), crear_usuario(conn, "beto@una.ac.cr")
    for i in range(20):
        crear_materia(conn, ana, f"Materia {i}")
    assert crear_materia(conn, beto) > 0


def test_borrar_una_materia_libera_un_cupo(conn):
    usuario = crear_usuario(conn)
    ids = [crear_materia(conn, usuario, f"Materia {i}") for i in range(20)]
    conn.execute("DELETE FROM materias WHERE id = %s", (ids[0],))
    assert crear_materia(conn, usuario, "Materia nueva") > 0


def test_no_se_puede_pasar_el_tope_cambiando_de_dueno_una_materia(conn):
    ana, beto = crear_usuario(conn, "ana@una.ac.cr"), crear_usuario(conn, "beto@una.ac.cr")
    for i in range(20):
        crear_materia(conn, ana, f"Materia {i}")
    ajena = crear_materia(conn, beto, "De Beto")

    conn.execute("SAVEPOINT intento")
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute("UPDATE materias SET usuario_id = %s WHERE id = %s", (ana, ajena))
    conn.execute("ROLLBACK TO SAVEPOINT intento")


def test_editar_una_materia_con_20_no_dispara_el_tope(conn):
    usuario = crear_usuario(conn)
    ids = [crear_materia(conn, usuario, f"Materia {i}") for i in range(20)]
    conn.execute("UPDATE materias SET nombre = 'Renombrada', color = '#112233' WHERE id = %s", (ids[0],))
    assert conn.execute("SELECT nombre FROM materias WHERE id = %s", (ids[0],)).fetchone()["nombre"] == "Renombrada"


# ---------- Daño al Jefe Final (RF-12) ----------

def test_jefe_sin_pomodoros_tiene_el_hp_completo(conn):
    jefe = crear_jefe(conn, crear_materia(conn, crear_usuario(conn)), hp_total=3)
    estado = estado_jefe(conn, jefe)
    assert (estado["hp_actual"], estado["pomodoros_recibidos"], estado["derrotado"]) == (3, 0, False)


def test_cada_pomodoro_completado_quita_1_de_hp(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    jefe = crear_jefe(conn, materia, hp_total=3)
    for esperado in (2, 1):
        agregar_sesion(conn, materia, "completada", jefe)
        estado = estado_jefe(conn, jefe)
        assert estado["hp_actual"] == esperado
        assert estado["derrotado"] is False


def test_el_jefe_se_derrota_con_el_ultimo_pomodoro(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    jefe = crear_jefe(conn, materia, hp_total=2)
    agregar_sesion(conn, materia, "completada", jefe)
    agregar_sesion(conn, materia, "completada", jefe)
    estado = estado_jefe(conn, jefe)
    assert (estado["hp_actual"], estado["derrotado"]) == (0, True)


def test_el_hp_del_jefe_nunca_es_negativo(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    jefe = crear_jefe(conn, materia, hp_total=1)
    for _ in range(3):
        agregar_sesion(conn, materia, "completada", jefe)
    estado = estado_jefe(conn, jefe)
    assert estado["hp_actual"] == 0
    assert estado["derrotado"] is True


def test_las_sesiones_canceladas_o_en_curso_no_danan_al_jefe(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    jefe = crear_jefe(conn, materia, hp_total=2)
    agregar_sesion(conn, materia, "cancelada", jefe, minutos=5)
    conn.execute("INSERT INTO sesiones (materia_id, jefe_id) VALUES (%s, %s)", (materia, jefe))
    assert estado_jefe(conn, jefe)["hp_actual"] == 2


def test_las_sesiones_sin_jefe_no_danan_a_ninguno(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    jefe = crear_jefe(conn, materia, hp_total=2)
    agregar_sesion(conn, materia, "completada", jefe_id=None)
    assert estado_jefe(conn, jefe)["hp_actual"] == 2


def test_los_pomodoros_de_otro_jefe_no_cuentan(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    primero, segundo = crear_jefe(conn, materia, hp_total=2), crear_jefe(conn, materia, hp_total=2)
    agregar_sesion(conn, materia, "completada", primero)
    assert estado_jefe(conn, primero)["hp_actual"] == 1
    assert estado_jefe(conn, segundo)["hp_actual"] == 2


# ---------- XP acumulado por materia ----------

def test_el_progreso_de_la_materia_solo_cuenta_las_completadas(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    for estado in ("completada", "completada", "completada", "cancelada"):
        agregar_sesion(conn, materia, estado)
    fila = conn.execute("SELECT * FROM v_progreso_materia WHERE materia_id = %s", (materia,)).fetchone()
    assert fila["pomodoros_completados"] == 3
    assert fila["pomodoros_cancelados"] == 1
    assert XP_POR_POMODORO * fila["pomodoros_completados"] == 300


def test_los_minutos_estudiados_restan_las_pausas(conn):
    materia = crear_materia(conn, crear_usuario(conn))
    agregar_sesion(conn, materia, "completada", minutos=35)
    sesion = conn.execute("SELECT id FROM sesiones WHERE materia_id = %s", (materia,)).fetchone()["id"]
    conn.execute(
        "INSERT INTO pausas (sesion_id, inicio, fin) VALUES (%s, now() - interval '20 minutes', now() - interval '10 minutes')",
        (sesion,),
    )
    fila = conn.execute("SELECT minutos_estudiados FROM v_progreso_materia WHERE materia_id = %s", (materia,)).fetchone()
    assert fila["minutos_estudiados"] == 25
