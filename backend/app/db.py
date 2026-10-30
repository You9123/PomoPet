import psycopg
from fastapi import Depends
from psycopg.rows import dict_row

from app.config import DATABASE_URL


def get_conn():
    """Una conexión por petición.

    Todo lo que haga el endpoint queda en UNA transacción:
    si termina bien se hace COMMIT, si hay un error se hace ROLLBACK.
    """
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn


# Usar SIEMPRE esta dependencia en los endpoints (`conn=CONEXION`), no `Depends(get_conn)` a secas.
# Con scope="function" el COMMIT se hace ANTES de enviar la respuesta. Por defecto FastAPI termina
# la dependencia DESPUÉS de responder, y el cliente podría pedir algo que todavía no está guardado
# (por ejemplo, registrarse y pedir /api/me enseguida).
CONEXION = Depends(get_conn, scope="function")
