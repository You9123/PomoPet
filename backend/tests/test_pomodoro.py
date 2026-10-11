from datetime import datetime, timedelta

import pytest

from app.pomodoro import tiempo_efectivo, xp_por_sesion

INICIO = datetime(2026, 1, 1, 10, 0, 0)


def minutos(m, s=0):
    return timedelta(minutes=m, seconds=s)


# ---------- Caso límite 24:59 vs 25:00 (sin pausas) ----------

def test_24_59_no_da_xp():
    assert xp_por_sesion(INICIO, INICIO + minutos(24, 59)) == 0


def test_25_00_da_100_xp():
    assert xp_por_sesion(INICIO, INICIO + minutos(25)) == 100


def test_mas_de_25_minutos_da_100_xp_y_no_mas():
    assert xp_por_sesion(INICIO, INICIO + minutos(90)) == 100


# ---------- Con pausas: solo cuenta el tiempo efectivo ----------

def test_pausa_que_deja_24_59_efectivos_no_da_xp():
    # 35 min transcurridos - 10:01 en pausa = 24:59 efectivos
    assert xp_por_sesion(INICIO, INICIO + minutos(35), pausado=minutos(10, 1)) == 0


def test_pausa_que_deja_25_00_efectivos_da_xp():
    # 35 min transcurridos - 10:00 en pausa = 25:00 efectivos
    assert xp_por_sesion(INICIO, INICIO + minutos(35), pausado=minutos(10)) == 100


def test_pausar_no_se_puede_usar_para_dar_xp_sin_estudiar():
    # 30 min en total, pero 20 en pausa: solo estudió 10
    assert xp_por_sesion(INICIO, INICIO + minutos(30), pausado=minutos(20)) == 0


# ---------- Tiempo efectivo ----------

def test_tiempo_efectivo_resta_las_pausas():
    assert tiempo_efectivo(INICIO, INICIO + minutos(40), minutos(15)) == minutos(25)


def test_tiempo_efectivo_nunca_es_negativo():
    assert tiempo_efectivo(INICIO, INICIO + minutos(5), minutos(30)) == timedelta(0)


@pytest.mark.parametrize("pausado", [timedelta(0), minutos(3)])
def test_pausado_es_opcional_y_no_cambia_el_resultado_anterior(pausado):
    assert xp_por_sesion(INICIO, INICIO + minutos(60), pausado) == 100
