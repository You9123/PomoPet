"""RF-08 (issue #11): panel de estadísticas.

Todo sale de las vistas `v_progreso_materia` y `v_historial_sesiones` con SQL directo. Nada de lo que
se muestra aquí se guarda: el XP, los minutos y los conteos se calculan en cada consulta (3FN).
"""
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.db import CONEXION
from app.gamificacion import nivel, rango
from app.pomodoro import XP_POR_POMODORO
from app.seguridad import usuario_actual

router = APIRouter(prefix="/api/estadisticas", tags=["estadisticas"])

# Los días se cuentan en la hora local del usuario: una sesión a las 11 p. m. en Costa Rica
# ya es "mañana" en UTC. El frontend envía su zona; si no, se usa la del curso.
ZONA_POR_DEFECTO = "America/Costa_Rica"
MAX_DIAS = 365
MAX_POR_PAGINA = 50


# ---------- Esquemas ----------

class Resumen(BaseModel):
    minutos_estudiados: int      # solo sesiones completadas, sin pausas (igual que en materias)
    minutos_en_canceladas: int   # tiempo efectivo de las canceladas: se muestra aparte, no da XP
    pomodoros_completados: int
    pomodoros_cancelados: int
    tasa_exito: int | None       # % de sesiones terminadas que se completaron; null si no hay ninguna
    xp_total: int
    nivel: int


class ProgresoMateria(BaseModel):
    id: int
    nombre: str
    color: str
    pomodoros_completados: int
    pomodoros_cancelados: int
    minutos_estudiados: int
    xp: int
    nivel: int
    rango: dict[str, str]


class SerieMateria(BaseModel):
    materia_id: int
    nombre: str
    color: str
    minutos: list[int]           # un valor por día, en el mismo orden que `dias`


class PorDia(BaseModel):
    zona: str
    dias: list[date]             # del más antiguo a hoy
    series: list[SerieMateria]   # solo materias con minutos en el periodo
    completados: list[int]
    cancelados: list[int]


class Estadisticas(BaseModel):
    resumen: Resumen
    por_materia: list[ProgresoMateria]
    por_dia: PorDia


class SesionHistorial(BaseModel):
    id: int
    materia_id: int
    materia_nombre: str
    materia_color: str
    jefe_nombre: str | None
    estado: str                  # completada | cancelada
    inicio: datetime
    fin: datetime
    segundos_pausados: int
    segundos_efectivos: int
    xp: int


class Historial(BaseModel):
    total: int
    pagina: int
    por_pagina: int
    sesiones: list[SesionHistorial]


# ---------- Consultas ----------

SQL_RESUMEN = """
    SELECT COALESCE(SUM(p.pomodoros_completados), 0)::INT AS pomodoros_completados,
           COALESCE(SUM(p.pomodoros_cancelados), 0)::INT  AS pomodoros_cancelados,
           COALESCE(SUM(p.minutos_estudiados), 0)::INT    AS minutos_estudiados,
           (SELECT COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM h.efectivo)) / 60), 0)::INT
            FROM v_historial_sesiones h
            WHERE h.usuario_id = %(usuario)s AND h.estado = 'cancelada') AS minutos_en_canceladas
    FROM v_progreso_materia p
    WHERE p.usuario_id = %(usuario)s
"""

SQL_POR_MATERIA = """
    SELECT m.id, m.nombre, m.color,
           p.pomodoros_completados, p.pomodoros_cancelados, p.minutos_estudiados
    FROM materias m
    JOIN v_progreso_materia p ON p.materia_id = m.id
    WHERE m.usuario_id = %(usuario)s
    ORDER BY p.pomodoros_completados DESC, p.minutos_estudiados DESC, m.id
"""

# Una fila por (día, materia) con minutos y conteos. Los días sin sesiones salen igual
# (con materia_id NULL) gracias a generate_series + LEFT JOIN, para que el gráfico no tenga huecos.
SQL_POR_DIA = """
    WITH rango AS (
        SELECT (now() AT TIME ZONE %(zona)s)::date - (%(dias)s::INT - 1) AS desde,
               (now() AT TIME ZONE %(zona)s)::date                AS hasta
    ),
    dias AS (
        SELECT generate_series(r.desde, r.hasta, interval '1 day')::date AS dia FROM rango r
    ),
    sesiones_del_periodo AS (
        SELECT (h.inicio AT TIME ZONE %(zona)s)::date AS dia, h.materia_id, h.estado, h.efectivo
        FROM v_historial_sesiones h, rango r
        WHERE h.usuario_id = %(usuario)s
          AND h.inicio >= (r.desde::timestamp AT TIME ZONE %(zona)s)
    )
    SELECT d.dia,
           s.materia_id,
           COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM s.efectivo))
                          FILTER (WHERE s.estado = 'completada') / 60), 0)::INT AS minutos,
           COUNT(s.materia_id) FILTER (WHERE s.estado = 'completada')::INT     AS completados,
           COUNT(s.materia_id) FILTER (WHERE s.estado = 'cancelada')::INT      AS cancelados
    FROM dias d
    LEFT JOIN sesiones_del_periodo s ON s.dia = d.dia
    GROUP BY d.dia, s.materia_id
    ORDER BY d.dia, s.materia_id
"""

SQL_HISTORIAL = """
    SELECT h.sesion_id AS id, h.materia_id,
           m.nombre AS materia_nombre, m.color AS materia_color,
           j.nombre AS jefe_nombre,
           h.estado, h.inicio, h.fin,
           FLOOR(EXTRACT(EPOCH FROM h.pausado))::INT  AS segundos_pausados,
           FLOOR(EXTRACT(EPOCH FROM h.efectivo))::INT AS segundos_efectivos
    FROM v_historial_sesiones h
    JOIN materias m           ON m.id = h.materia_id
    LEFT JOIN jefes_finales j ON j.id = h.jefe_id
    WHERE h.usuario_id = %(usuario)s
      AND (%(estado)s::TEXT IS NULL OR h.estado = %(estado)s::TEXT)
    ORDER BY h.inicio DESC, h.sesion_id DESC
    LIMIT %(limite)s OFFSET %(desde)s
"""

SQL_TOTAL_HISTORIAL = """
    SELECT COUNT(*)::INT AS total
    FROM v_historial_sesiones h
    WHERE h.usuario_id = %(usuario)s
      AND (%(estado)s::TEXT IS NULL OR h.estado = %(estado)s::TEXT)
"""


# ---------- Utilidades ----------

def exigir_zona(conn, zona: str) -> None:
    existe = conn.execute(
        "SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = %s) AS existe", (zona,)
    ).fetchone()["existe"]
    if not existe:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Zona horaria desconocida: {zona}")


def armar_por_dia(filas: list[dict], materias: dict[int, dict], zona: str) -> PorDia:
    """Pasa las filas (día, materia) a series del mismo largo que `dias`, listas para Chart.js."""
    dias = list(dict.fromkeys(f["dia"] for f in filas))   # ya vienen ordenados y sin repetir
    posicion = {dia: i for i, dia in enumerate(dias)}
    completados = [0] * len(dias)
    cancelados = [0] * len(dias)
    minutos: dict[int, list[int]] = {}

    for f in filas:
        if f["materia_id"] is None:
            continue  # día sin sesiones
        i = posicion[f["dia"]]
        completados[i] += f["completados"]
        cancelados[i] += f["cancelados"]
        if f["minutos"] > 0:
            minutos.setdefault(f["materia_id"], [0] * len(dias))[i] = f["minutos"]

    # Mismo orden que `por_materia` (la de más XP primero): así los colores quedan estables
    series = [
        SerieMateria(materia_id=mid, nombre=m["nombre"], color=m["color"], minutos=minutos[mid])
        for mid, m in materias.items()
        if mid in minutos
    ]
    return PorDia(zona=zona, dias=dias, series=series, completados=completados, cancelados=cancelados)


def calcular_estadisticas(conn, usuario_id: int, dias: int, zona: str) -> Estadisticas:
    """Las estadísticas del usuario. También las usa el coach (`routers/coach.py`). La zona ya debe estar validada."""
    parametros = {"usuario": usuario_id, "dias": dias, "zona": zona}

    r = conn.execute(SQL_RESUMEN, parametros).fetchone()
    terminadas = r["pomodoros_completados"] + r["pomodoros_cancelados"]
    xp_total = XP_POR_POMODORO * r["pomodoros_completados"]
    resumen = Resumen(
        **r,
        tasa_exito=round(100 * r["pomodoros_completados"] / terminadas) if terminadas else None,
        xp_total=xp_total,
        nivel=nivel(xp_total),
    )

    por_materia = []
    for f in conn.execute(SQL_POR_MATERIA, parametros).fetchall():
        xp = XP_POR_POMODORO * f["pomodoros_completados"]
        por_materia.append(ProgresoMateria(**f, xp=xp, nivel=nivel(xp), rango=rango(xp)))

    filas = conn.execute(SQL_POR_DIA, parametros).fetchall()
    materias = {m.id: {"nombre": m.nombre, "color": m.color} for m in por_materia}
    return Estadisticas(resumen=resumen, por_materia=por_materia, por_dia=armar_por_dia(filas, materias, zona))


# ---------- Endpoints ----------

@router.get("", response_model=Estadisticas)
def estadisticas(
    dias: int = Query(7, ge=1, le=MAX_DIAS, description="Cuántos días (hasta hoy) incluye `por_dia`"),
    zona: str = Query(ZONA_POR_DEFECTO, max_length=64, description="Zona horaria IANA del usuario"),
    usuario_id: int = Depends(usuario_actual),
    conn=CONEXION,
):
    """RF-08: progreso general, XP por materia y minutos estudiados por día.

    El resumen y `por_materia` cuentan todo el historial; `por_dia` solo los últimos `dias` días.
    Las sesiones canceladas no dan XP ni suman a `minutos_estudiados`, pero se cuentan aparte.
    """
    exigir_zona(conn, zona)
    return calcular_estadisticas(conn, usuario_id, dias, zona)


@router.get("/historial", response_model=Historial)
def historial(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(10, ge=1, le=MAX_POR_PAGINA),
    estado: Literal["completada", "cancelada"] | None = Query(None, description="Filtra por estado"),
    usuario_id: int = Depends(usuario_actual),
    conn=CONEXION,
):
    """RF-08 / RF-11: sesiones terminadas (completadas y canceladas), de la más reciente a la más antigua."""
    parametros = {
        "usuario": usuario_id,
        "estado": estado,
        "limite": por_pagina,
        "desde": (pagina - 1) * por_pagina,
    }
    total = conn.execute(SQL_TOTAL_HISTORIAL, parametros).fetchone()["total"]
    sesiones = [
        SesionHistorial(**f, xp=XP_POR_POMODORO if f["estado"] == "completada" else 0)
        for f in conn.execute(SQL_HISTORIAL, parametros).fetchall()
    ]
    return Historial(total=total, pagina=pagina, por_pagina=por_pagina, sesiones=sesiones)
