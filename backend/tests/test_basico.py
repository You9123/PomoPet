from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.pomodoro import xp_por_sesion

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_pomodoro_completo_da_100_xp():
    inicio = datetime(2026, 1, 1, 10, 0)
    assert xp_por_sesion(inicio, inicio + timedelta(minutes=25)) == 100


def test_pomodoro_incompleto_no_da_xp():
    inicio = datetime(2026, 1, 1, 10, 0)
    assert xp_por_sesion(inicio, inicio + timedelta(minutes=10)) == 0