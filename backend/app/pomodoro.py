from datetime import datetime, timedelta

DURACION_MINIMA = timedelta(minutes=25)
XP_POR_POMODORO = 100


def tiempo_efectivo(inicio: datetime, fin: datetime, pausado: timedelta = timedelta(0)) -> timedelta:
    """RF-09: tiempo realmente estudiado = lo transcurrido menos el tiempo en pausa."""
    return max(fin - inicio - pausado, timedelta(0))


def xp_por_sesion(inicio: datetime, fin: datetime, pausado: timedelta = timedelta(0)) -> int:
    """RF-03 / RF-09: otorga 100 XP solo si el tiempo efectivo (sin pausas) es de al menos 25 minutos."""
    return XP_POR_POMODORO if tiempo_efectivo(inicio, fin, pausado) >= DURACION_MINIMA else 0
