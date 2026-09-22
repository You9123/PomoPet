from datetime import datetime, timedelta

DURACION_MINIMA = timedelta(minutes=25)
XP_POR_POMODORO = 100


def xp_por_sesion(inicio: datetime, fin: datetime) -> int:
    """RF-03 / RF-09: otorga 100 XP solo si pasaron al menos 25 minutos."""
    return XP_POR_POMODORO if fin - inicio >= DURACION_MINIMA else 0