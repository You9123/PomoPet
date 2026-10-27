from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from psycopg import errors
from pydantic import BaseModel, Field, field_validator

from app.db import CONEXION
from app.gamificacion import nivel, rango
from app.pomodoro import XP_POR_POMODORO
from app.seguridad import usuario_actual

router = APIRouter(prefix="/api", tags=["materias"])

# RF-02. La BD también lo valida (trigger materias_tope_20); aquí se revisa antes para dar un mensaje claro.
MAX_MATERIAS = 20


# ---------- Esquemas ----------

class MateriaBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=100, examples=["Cálculo"])
    color: str = Field(default="#888888", pattern=r"^#[0-9A-Fa-f]{6}$", examples=["#4F46E5"])
    horas_semanales: int | None = Field(default=None, ge=0, le=168, examples=[6])

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La materia necesita un nombre")
        return v


class MateriaNueva(MateriaBase):
    pass


class MateriaCambios(BaseModel):
    """Solo se cambian los campos que se envían."""
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    horas_semanales: int | None = Field(default=None, ge=0, le=168)

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("La materia necesita un nombre")
        return v


class MateriaOut(BaseModel):
    id: int
    nombre: str
    color: str
    horas_semanales: int | None
    creado_en: datetime
    pomodoros_completados: int
    pomodoros_cancelados: int
    minutos_estudiados: int
    xp: int                      # XP_POR_POMODORO por pomodoro completado; se calcula, no se guarda (3FN)
    nivel: int                   # RF-04, a partir del XP (app.gamificacion)
    rango: dict[str, str]        # RF-04: {"codigo", "nombre"}, a partir del XP


# ---------- Utilidades ----------

SQL_MATERIA = """
    SELECT m.id, m.nombre, m.color, m.horas_semanales, m.creado_en,
           p.pomodoros_completados, p.pomodoros_cancelados, p.minutos_estudiados
    FROM materias m
    JOIN v_progreso_materia p ON p.materia_id = m.id
    WHERE m.usuario_id = %s
"""


def a_respuesta(fila: dict) -> MateriaOut:
    xp = XP_POR_POMODORO * fila["pomodoros_completados"]
    return MateriaOut(**fila, xp=xp, nivel=nivel(xp), rango=rango(xp))


def cargar_materia(conn, materia_id: int, usuario_id: int) -> dict:
    """Devuelve la materia si es del usuario; si no, 404 (no revela materias ajenas)."""
    fila = conn.execute(SQL_MATERIA + " AND m.id = %s", (usuario_id, materia_id)).fetchone()
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La materia no existe")
    return fila


def error_nombre_repetido() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, "Ya tienes una materia con ese nombre")


# ---------- Endpoints ----------

@router.get("/materias", response_model=list[MateriaOut])
def listar_materias(usuario_id: int = Depends(usuario_actual), conn=CONEXION):
    """Las materias del usuario con su progreso, de la más antigua a la más nueva."""
    filas = conn.execute(SQL_MATERIA + " ORDER BY m.creado_en, m.id", (usuario_id,)).fetchall()
    return [a_respuesta(f) for f in filas]


@router.post("/materias", response_model=MateriaOut, status_code=status.HTTP_201_CREATED)
def crear_materia(datos: MateriaNueva, usuario_id: int = Depends(usuario_actual), conn=CONEXION):
    """RF-02: crea una materia. Máximo 20 por usuario."""
    # Bloquea al usuario: dos peticiones simultáneas no pueden pasar ambas del tope
    conn.execute("SELECT 1 FROM usuarios WHERE id = %s FOR UPDATE", (usuario_id,))
    total = conn.execute(
        "SELECT COUNT(*) AS total FROM materias WHERE usuario_id = %s", (usuario_id,)
    ).fetchone()["total"]
    if total >= MAX_MATERIAS:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Ya tienes {MAX_MATERIAS} materias, que es el máximo permitido"
        )

    try:
        nueva = conn.execute(
            """
            INSERT INTO materias (usuario_id, nombre, color, horas_semanales)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (usuario_id, datos.nombre, datos.color, datos.horas_semanales),
        ).fetchone()
    except errors.UniqueViolation:
        raise error_nombre_repetido()
    return a_respuesta(cargar_materia(conn, nueva["id"], usuario_id))


@router.get("/materias/{materia_id}", response_model=MateriaOut)
def ver_materia(materia_id: int, usuario_id: int = Depends(usuario_actual), conn=CONEXION):
    return a_respuesta(cargar_materia(conn, materia_id, usuario_id))


@router.patch("/materias/{materia_id}", response_model=MateriaOut)
def editar_materia(
    materia_id: int, datos: MateriaCambios, usuario_id: int = Depends(usuario_actual), conn=CONEXION
):
    """Cambia nombre, color u horas semanales. Los campos que no se envían se quedan igual."""
    cargar_materia(conn, materia_id, usuario_id)  # 404 si no es del usuario
    cambios = datos.model_dump(exclude_unset=True)
    if "nombre" in cambios and cambios["nombre"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El nombre no puede quedar vacío")
    if "color" in cambios and cambios["color"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El color no puede quedar vacío")

    if cambios:
        # Los nombres de columna salen del esquema (no del cliente), así que es seguro armarlos aquí
        asignaciones = ", ".join(f"{campo} = %s" for campo in cambios)
        try:
            conn.execute(
                f"UPDATE materias SET {asignaciones} WHERE id = %s AND usuario_id = %s",
                (*cambios.values(), materia_id, usuario_id),
            )
        except errors.UniqueViolation:
            raise error_nombre_repetido()
    return a_respuesta(cargar_materia(conn, materia_id, usuario_id))


@router.delete("/materias/{materia_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_materia(materia_id: int, usuario_id: int = Depends(usuario_actual), conn=CONEXION):
    """Borra la materia con sus jefes, sesiones y pausas (ON DELETE CASCADE).

    Si tiene una sesión en curso responde 409: el temporizador del frontend seguiría corriendo
    sobre una sesión que ya no existe y al terminar recibiría 404.
    """
    # Mismo bloqueo que iniciar_sesion: nadie puede iniciar una sesión en esta materia mientras
    # se revisa (sin esto, el INSERT de esa sesión fallaría con un 500 al borrarse la materia)
    conn.execute("SELECT 1 FROM usuarios WHERE id = %s FOR UPDATE", (usuario_id,))
    cargar_materia(conn, materia_id, usuario_id)
    conn.execute("SELECT 1 FROM materias WHERE id = %s FOR UPDATE", (materia_id,))
    en_curso = conn.execute(
        "SELECT 1 FROM sesiones WHERE materia_id = %s AND estado = 'en_curso'", (materia_id,)
    ).fetchone()
    if en_curso is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Tienes una sesión en curso en esta materia: termínala o cancélala antes de borrarla",
        )
    conn.execute("DELETE FROM materias WHERE id = %s AND usuario_id = %s", (materia_id, usuario_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
