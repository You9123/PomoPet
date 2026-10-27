from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator

from app.db import CONEXION
from app.seguridad import usuario_actual

router = APIRouter(prefix="/api", tags=["jefes"])


# ---------- Esquemas ----------

class JefeNuevo(BaseModel):
    nombre: str = Field(min_length=1, max_length=100, examples=["Parcial final"])
    hp_total: int = Field(gt=0, le=1000, examples=[10])   # RF-12: HP medido en pomodoros
    fecha_limite: date | None = None

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El jefe necesita un nombre")
        return v


class JefeOut(BaseModel):
    id: int
    materia_id: int
    nombre: str
    hp_total: int
    hp_actual: int               # se calcula en v_estado_jefe, no se guarda (3FN)
    pomodoros_recibidos: int
    derrotado: bool
    fecha_limite: date | None


# ---------- Utilidades ----------

SQL_JEFE = """
    SELECT e.jefe_id AS id, e.materia_id, e.nombre, e.hp_total, e.hp_actual,
           e.pomodoros_recibidos, e.derrotado, e.fecha_limite
    FROM v_estado_jefe e
    JOIN materias m ON m.id = e.materia_id
    WHERE m.usuario_id = %s
"""


def cargar_jefe(conn, jefe_id: int, usuario_id: int) -> JefeOut:
    """Devuelve el jefe si es del usuario; si no, 404 (no revela jefes ajenos)."""
    fila = conn.execute(SQL_JEFE + " AND e.jefe_id = %s", (usuario_id, jefe_id)).fetchone()
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El jefe no existe")
    return JefeOut(**fila)


def exigir_materia(conn, materia_id: int, usuario_id: int) -> None:
    fila = conn.execute(
        "SELECT 1 FROM materias WHERE id = %s AND usuario_id = %s", (materia_id, usuario_id)
    ).fetchone()
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La materia no existe")


# ---------- Endpoints ----------

@router.get("/materias/{materia_id}/jefes", response_model=list[JefeOut])
def listar_jefes(materia_id: int, usuario_id: int = Depends(usuario_actual), conn=CONEXION):
    """Los jefes de una materia, del más antiguo al más nuevo, con su HP actual."""
    exigir_materia(conn, materia_id, usuario_id)
    filas = conn.execute(
        SQL_JEFE + " AND e.materia_id = %s ORDER BY e.jefe_id", (usuario_id, materia_id)
    ).fetchall()
    return [JefeOut(**f) for f in filas]


@router.post("/materias/{materia_id}/jefes", response_model=JefeOut, status_code=status.HTTP_201_CREATED)
def crear_jefe(
    materia_id: int, datos: JefeNuevo, usuario_id: int = Depends(usuario_actual), conn=CONEXION
):
    """RF-12: crea un Jefe Final para una materia, con HP en pomodoros y fecha límite opcional."""
    exigir_materia(conn, materia_id, usuario_id)
    nuevo = conn.execute(
        """
        INSERT INTO jefes_finales (materia_id, nombre, hp_total, fecha_limite)
        VALUES (%s, %s, %s, %s) RETURNING id
        """,
        (materia_id, datos.nombre, datos.hp_total, datos.fecha_limite),
    ).fetchone()
    return cargar_jefe(conn, nuevo["id"], usuario_id)


@router.get("/jefes/{jefe_id}", response_model=JefeOut)
def ver_jefe(jefe_id: int, usuario_id: int = Depends(usuario_actual), conn=CONEXION):
    return cargar_jefe(conn, jefe_id, usuario_id)


@router.delete("/jefes/{jefe_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_jefe(jefe_id: int, usuario_id: int = Depends(usuario_actual), conn=CONEXION):
    """Borra el jefe. Sus sesiones se conservan sin jefe (ON DELETE SET NULL)."""
    cargar_jefe(conn, jefe_id, usuario_id)
    conn.execute("DELETE FROM jefes_finales WHERE id = %s", (jefe_id,))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
