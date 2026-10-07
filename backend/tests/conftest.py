import os

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from app.config import DATABASE_URL
from app.db import get_conn
from app.main import app


@pytest.fixture
def conn():
    """Conexión a la BD real que NO deja datos guardados ni borra los existentes.

    Toda la prueba corre dentro de una transacción que se deshace al final.
    """
    try:
        conexion = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)
    except psycopg.OperationalError:
        if os.environ.get("CI"):
            raise  # en GitHub Actions la BD siempre debe existir
        pytest.skip("No hay PostgreSQL: levantarlo con `docker compose up -d db`")

    conexion.execute("BEGIN")
    # Cada prueba empieza sin usuarios (se deshace con el ROLLBACK,
    # así que los usuarios que ya tenés en tu BD no se pierden)
    conexion.execute("DELETE FROM usuarios")
    yield conexion
    conexion.execute("ROLLBACK")
    conexion.close()


@pytest.fixture
def client(conn):
    """Cliente de la API que usa la conexión de prueba.

    Cada petición va en un SAVEPOINT, que se comporta como su propia transacción.
    """
    def conn_de_prueba():
        conn.execute("SAVEPOINT peticion")
        try:
            yield conn
        except Exception:
            conn.execute("ROLLBACK TO SAVEPOINT peticion")
            raise
        conn.execute("RELEASE SAVEPOINT peticion")

    app.dependency_overrides[get_conn] = conn_de_prueba
    yield TestClient(app)
    app.dependency_overrides.clear()
