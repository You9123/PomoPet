import psycopg
from psycopg.rows import dict_row

from app.config import DATABASE_URL


def get_conn():
    """Una conexión por petición.

    Todo lo que haga el endpoint queda en UNA transacción:
    si termina bien se hace COMMIT, si hay un error se hace ROLLBACK.
    """
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        yield conn
