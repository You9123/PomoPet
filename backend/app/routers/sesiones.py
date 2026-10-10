from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_conn
from app.pomodoro import DURACION_MINIMA, tiempo_efectivo, xp_por_sesion
from app.seguridad import usuario_actual

router = APIRouter(prefix="/api", tags=["sesiones"])


# ---------- Esquemas ----------

class IniciarSesion(BaseModel):
    materia_id: int
    jefe_id: int | None = None   # opcional: debe ser un Jefe de la misma materia


class SesionOut(BaseModel):
    id: int
    materia_id: int
    jefe_id: int | None
    estado: str                  # en_curso | completada | cancelada
    inicio: datetime
    fin: datetime | None
    pausada: bool
    segundos_pausados: int
    segundos_efectivos: int
    xp_otorgado: int             # 100 solo si está completada; no se guarda (3FN)


# ---------- Utilidades ----------

# La sesión del usuario con el tiempo en pausa ya sumado. FOR UPDATE: dos peticiones
# a la misma sesión (por ejemplo finalizar y cancelar) se atienden una después de la otra.
# `now()` es la hora del servidor de BD: el cliente nunca decide cuánto tiempo pasó (RF-09).
SQL_SESION = """
    SELECT s.id, s.materia_id, s.jefe_id, s.estado, s.inicio, s.fin, now() AS ahora,
           COALESCE((SELECT SUM(COALESCE(p.fin, now()) - p.inicio)
                     FROM pausas p WHERE p.sesion_id = s.id), interval '0') AS pausado,
           EXISTS (SELECT 1 FROM pausas p WHERE p.sesion_id = s.id AND p.fin IS NULL) AS pausada
    FROM sesiones s
    JOIN materias m ON m.id = s.materia_id
    WHERE s.id = %s AND m.usuario_id = %s
    FOR UPDATE OF s
"""


def cargar_sesion(conn, sesion_id: int, usuario_id: int) -> dict:
    """Devuelve la sesión si es del usuario; si no, 404 (no revela sesiones ajenas)."""
    fila = conn.execute(SQL_SESION, (sesion_id, usuario_id)).fetchone()
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La sesión no existe")
    return fila


def exigir_en_curso(fila: dict) -> None:
    if fila["estado"] != "en_curso":
        raise HTTPException(status.HTTP_409_CONFLICT, f"La sesión ya está {fila['estado']}")


def a_respuesta(fila: dict) -> SesionOut:
    fin = fila["fin"] or fila["ahora"]
    efectivo = tiempo_efectivo(fila["inicio"], fin, fila["pausado"])
    xp = xp_por_sesion(fila["inicio"], fin, fila["pausado"]) if fila["estado"] == "completada" else 0
    return SesionOut(
        id=fila["id"],
        materia_id=fila["materia_id"],
        jefe_id=fila["jefe_id"],
        estado=fila["estado"],
        inicio=fila["inicio"],
        fin=fila["fin"],
        pausada=fila["estado"] == "en_curso" and fila["pausada"],
        segundos_pausados=int(fila["pausado"].total_seconds()),
        segundos_efectivos=int(efectivo.total_seconds()),
        xp_otorgado=xp,
    )


def cerrar_pausa_abierta(conn, sesion_id: int) -> None:
    conn.execute("UPDATE pausas SET fin = now() WHERE sesion_id = %s AND fin IS NULL", (sesion_id,))


# ---------- Endpoints ----------

@router.post("/sesiones", response_model=SesionOut, status_code=status.HTTP_201_CREATED)
def iniciar_sesion(datos: IniciarSesion, usuario_id: int = Depends(usuario_actual), conn=Depends(get_conn)):
    """RF-01: inicia un pomodoro. La hora de inicio la fija el servidor (RF-09)."""
    # Bloquea al usuario: dos peticiones simultáneas no pueden crear dos sesiones en curso
    conn.execute("SELECT 1 FROM usuarios WHERE id = %s FOR UPDATE", (usuario_id,))

    materia = conn.execute(
        "SELECT id FROM materias WHERE id = %s AND usuario_id = %s", (datos.materia_id, usuario_id)
    ).fetchone()
    if materia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La materia no existe")

    if datos.jefe_id is not None:
        jefe = conn.execute(
            "SELECT derrotado FROM v_estado_jefe WHERE jefe_id = %s AND materia_id = %s",
            (datos.jefe_id, datos.materia_id),
        ).fetchone()
        if jefe is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "El jefe no existe en esa materia")
        if jefe["derrotado"]:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ese jefe ya fue derrotado")

    en_curso = conn.execute(
        """
        SELECT s.id FROM sesiones s JOIN materias m ON m.id = s.materia_id
        WHERE m.usuario_id = %s AND s.estado = 'en_curso'
        """,
        (usuario_id,),
    ).fetchone()
    if en_curso is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Ya tienes una sesión en curso (id {en_curso['id']})"
        )

    nueva = conn.execute(
        "INSERT INTO sesiones (materia_id, jefe_id) VALUES (%s, %s) RETURNING id",
        (datos.materia_id, datos.jefe_id),
    ).fetchone()
    return a_respuesta(cargar_sesion(conn, nueva["id"], usuario_id))


@router.post("/sesiones/{sesion_id}/pausar", response_model=SesionOut)
def pausar(sesion_id: int, usuario_id: int = Depends(usuario_actual), conn=Depends(get_conn)):
    """RF-01: abre una pausa. El tiempo en pausa no cuenta para los 25 minutos."""
    fila = cargar_sesion(conn, sesion_id, usuario_id)
    exigir_en_curso(fila)
    if fila["pausada"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "La sesión ya está en pausa")
    conn.execute("INSERT INTO pausas (sesion_id) VALUES (%s)", (sesion_id,))
    return a_respuesta(cargar_sesion(conn, sesion_id, usuario_id))


@router.post("/sesiones/{sesion_id}/reanudar", response_model=SesionOut)
def reanudar(sesion_id: int, usuario_id: int = Depends(usuario_actual), conn=Depends(get_conn)):
    """RF-01: cierra la pausa abierta."""
    fila = cargar_sesion(conn, sesion_id, usuario_id)
    exigir_en_curso(fila)
    if not fila["pausada"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "La sesión no está en pausa")
    cerrar_pausa_abierta(conn, sesion_id)
    return a_respuesta(cargar_sesion(conn, sesion_id, usuario_id))


@router.post("/sesiones/{sesion_id}/finalizar", response_model=SesionOut)
def finalizar(sesion_id: int, usuario_id: int = Depends(usuario_actual), conn=Depends(get_conn)):
    """RF-03 / RF-09: completa la sesión si el tiempo efectivo (sin pausas) es de 25 minutos o más.

    Si no alcanza, responde 409 y la sesión sigue en curso (no se escribe nada).
    """
    fila = cargar_sesion(conn, sesion_id, usuario_id)
    exigir_en_curso(fila)

    # fila["pausado"] ya cuenta la pausa abierta (si la hay) hasta este instante
    efectivo = tiempo_efectivo(fila["inicio"], fila["ahora"], fila["pausado"])
    if xp_por_sesion(fila["inicio"], fila["ahora"], fila["pausado"]) == 0:
        faltan = DURACION_MINIMA - efectivo
        faltan_seg = int(faltan.total_seconds()) + (1 if faltan % timedelta(seconds=1) else 0)
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Aún no se cumplen 25 minutos efectivos: faltan {faltan_seg // 60} min {faltan_seg % 60} s",
        )

    cerrar_pausa_abierta(conn, sesion_id)
    conn.execute(
        "UPDATE sesiones SET estado = 'completada', fin = now() WHERE id = %s", (sesion_id,)
    )
    return a_respuesta(cargar_sesion(conn, sesion_id, usuario_id))


@router.post("/sesiones/{sesion_id}/cancelar", response_model=SesionOut)
def cancelar(sesion_id: int, usuario_id: int = Depends(usuario_actual), conn=Depends(get_conn)):
    """RF-11: cancela la sesión. Queda en el historial y no da XP."""
    fila = cargar_sesion(conn, sesion_id, usuario_id)
    exigir_en_curso(fila)
    cerrar_pausa_abierta(conn, sesion_id)
    conn.execute(
        "UPDATE sesiones SET estado = 'cancelada', fin = now() WHERE id = %s", (sesion_id,)
    )
    return a_respuesta(cargar_sesion(conn, sesion_id, usuario_id))
