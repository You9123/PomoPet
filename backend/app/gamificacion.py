"""RF-04: niveles, rangos de dominio por materia y etapas de evolución de la mascota.

Nada de esto se guarda en la BD (3FN): se calcula a partir del XP, que a su vez sale de los pomodoros
completados (ver `app.pomodoro`). Para cambiar un umbral solo hay que editar las tablas de abajo.
"""
from typing import NamedTuple

XP_POR_NIVEL = 200  # un nivel cada 2 pomodoros


class Categoria(NamedTuple):
    desde_xp: int  # XP mínimo para estar en esta categoría
    codigo: str    # identificador estable, para el frontend
    nombre: str    # texto para mostrar


# Rango de cada materia, según el XP de esa materia. Ordenados de menor a mayor XP.
RANGOS = (
    Categoria(0, "novato", "Novato"),
    Categoria(500, "estudiante_promedio", "Estudiante Promedio"),
    Categoria(1500, "casi_bachiller", "Casi Bachiller"),
    Categoria(3000, "maestro", "Maestro"),
)

# Etapa de la mascota, según el XP total del usuario (suma de todas sus materias).
ETAPAS = (
    Categoria(0, "cria", "Cría"),
    Categoria(500, "joven", "Joven"),
    Categoria(2500, "adulta", "Adulta"),
    Categoria(5000, "legendaria", "Legendaria"),
)


def _categoria(tabla: tuple[Categoria, ...], xp: int) -> dict:
    """La última categoría cuyo umbral ya se alcanzó."""
    actual = [c for c in tabla if xp >= c.desde_xp][-1]
    return {"codigo": actual.codigo, "nombre": actual.nombre}


def nivel(xp: int) -> int:
    """Nivel 1 con 0 XP; sube un nivel cada XP_POR_NIVEL."""
    return max(xp, 0) // XP_POR_NIVEL + 1


def rango(xp: int) -> dict:
    """Rango de dominio de una materia: {"codigo", "nombre"}."""
    return _categoria(RANGOS, max(xp, 0))


def etapa_mascota(xp_total: int) -> dict:
    """Etapa de evolución de la mascota según el XP total del usuario: {"codigo", "nombre"}."""
    return _categoria(ETAPAS, max(xp_total, 0))
