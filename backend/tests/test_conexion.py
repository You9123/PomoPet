"""Pruebas de regresión de la conexión a la BD (revisión del PR #18).

1. El COMMIT tiene que hacerse ANTES de responder (`scope="function"`).
2. Dos peticiones a la misma sesión no deben dar 500 (bloqueo y lectura por separado).
"""
import os
import pathlib
import threading
import time

import psycopg
import pytest
from psycopg.rows import dict_row

from app.config import DATABASE_URL
from app.routers.sesiones import cargar_sesion

APP = pathlib.Path(__file__).resolve().parents[1] / "app"


def test_ningun_endpoint_usa_get_conn_a_secas():
    """`Depends(get_conn)` termina DESPUÉS de responder: el cliente puede pedir algo sin guardar aún.

    Los endpoints deben usar `conn=CONEXION` (app/db.py), que hace el COMMIT antes de la respuesta.
    """
    infractores = []
    for archivo in APP.rglob("*.py"):
        if archivo.name == "db.py":
            continue
        if "Depends(get_conn" in archivo.read_text(encoding="utf8"):
            infractores.append(str(archivo.relative_to(APP)))
    assert infractores == [], f"Usar conn=CONEXION en: {infractores}"


@pytest.fixture
def bd():
    """Conexión de preparación (autocommit) para crear datos confirmados que vean varias conexiones."""
    try:
        conexion = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)
    except psycopg.OperationalError:
        if os.environ.get("CI"):
            raise
        pytest.skip("No hay PostgreSQL: levantarlo con `docker compose up -d db`")
    yield conexion
    conexion.close()


def test_la_peticion_que_espera_el_bloqueo_ve_lo_que_hizo_la_anterior(bd):
    """Dos pausas simultáneas: la segunda tiene que enterarse de que ya hay una pausa abierta.

    Si el bloqueo y la lectura de las pausas van en una sola consulta, la petición que esperó el
    bloqueo no vuelve a leer `pausas` y cree que no hay pausa: intenta abrir otra y da 500.
    """
    correo = "carrera-bloqueo@una.ac.cr"
    bd.execute("DELETE FROM usuarios WHERE correo = %s", (correo,))
    usuario = bd.execute(
        "INSERT INTO usuarios (correo, password_hash) VALUES (%s, 'x') RETURNING id", (correo,)
    ).fetchone()["id"]
    materia = bd.execute(
        "INSERT INTO materias (usuario_id, nombre) VALUES (%s, 'Carrera') RETURNING id", (usuario,)
    ).fetchone()["id"]
    sesion = bd.execute(
        "INSERT INTO sesiones (materia_id) VALUES (%s) RETURNING id", (materia,)
    ).fetchone()["id"]

    a = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    b = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    resultado = {}
    try:
        cargar_sesion(a, sesion, usuario)  # la petición A bloquea la sesión

        def peticion_b():
            resultado["fila"] = cargar_sesion(b, sesion, usuario)  # B queda esperando ese bloqueo

        hilo = threading.Thread(target=peticion_b)
        hilo.start()

        # esperar a que B esté de verdad bloqueada antes de que A termine
        limite = time.time() + 5
        while time.time() < limite:
            esperando = bd.execute(
                "SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()"
            ).fetchone()
            if esperando:
                break
            time.sleep(0.02)

        a.execute("INSERT INTO pausas (sesion_id) VALUES (%s)", (sesion,))  # A abre la pausa
        a.commit()
        hilo.join(timeout=10)

        assert not hilo.is_alive(), "la petición B nunca terminó"
        assert resultado["fila"]["pausada"] is True
    finally:
        a.close()
        b.close()
        bd.execute("DELETE FROM usuarios WHERE id = %s", (usuario,))
