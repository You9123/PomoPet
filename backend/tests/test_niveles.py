"""Niveles, rangos y etapas de evolución de la mascota (issue #8, RF-04, RNF-08).

Cada umbral se prueba con el último XP que NO lo alcanza y el primero que sí.
"""
import pytest

from app.gamificacion import ETAPAS, RANGOS, XP_POR_NIVEL, etapa_mascota, nivel, rango
from app.pomodoro import XP_POR_POMODORO

# ---------- Nivel ----------


@pytest.mark.parametrize(
    "xp, esperado",
    [(0, 1), (100, 1), (199, 1), (200, 2), (399, 2), (400, 3), (2000, 11)],
)
def test_nivel_sube_cada_200_xp(xp, esperado):
    assert nivel(xp) == esperado


def test_un_nivel_son_dos_pomodoros():
    assert XP_POR_NIVEL == 2 * XP_POR_POMODORO
    assert nivel(XP_POR_POMODORO) == 1
    assert nivel(2 * XP_POR_POMODORO) == 2


# ---------- Rango de una materia ----------


@pytest.mark.parametrize(
    "xp, esperado",
    [
        (0, "novato"),
        (499, "novato"),
        (500, "estudiante_promedio"),
        (1499, "estudiante_promedio"),
        (1500, "casi_bachiller"),
        (2999, "casi_bachiller"),
        (3000, "maestro"),
        (1_000_000, "maestro"),
    ],
)
def test_rango_en_los_bordes_de_cada_umbral(xp, esperado):
    assert rango(xp)["codigo"] == esperado


def test_rango_devuelve_codigo_y_nombre():
    assert rango(1500) == {"codigo": "casi_bachiller", "nombre": "Casi Bachiller"}


def test_los_rangos_cambian_en_5_15_y_30_pomodoros():
    assert rango(4 * XP_POR_POMODORO)["codigo"] == "novato"
    assert rango(5 * XP_POR_POMODORO)["codigo"] == "estudiante_promedio"
    assert rango(14 * XP_POR_POMODORO)["codigo"] == "estudiante_promedio"
    assert rango(15 * XP_POR_POMODORO)["codigo"] == "casi_bachiller"
    assert rango(29 * XP_POR_POMODORO)["codigo"] == "casi_bachiller"
    assert rango(30 * XP_POR_POMODORO)["codigo"] == "maestro"


# ---------- Etapa de la mascota ----------


@pytest.mark.parametrize(
    "xp, esperado",
    [
        (0, "cria"),
        (499, "cria"),
        (500, "joven"),
        (2499, "joven"),
        (2500, "adulta"),
        (4999, "adulta"),
        (5000, "legendaria"),
        (1_000_000, "legendaria"),
    ],
)
def test_etapa_en_los_bordes_de_cada_umbral(xp, esperado):
    assert etapa_mascota(xp)["codigo"] == esperado


def test_etapa_devuelve_codigo_y_nombre():
    assert etapa_mascota(2500) == {"codigo": "adulta", "nombre": "Adulta"}


# ---------- Que las tablas estén bien armadas ----------


@pytest.mark.parametrize("tabla", [RANGOS, ETAPAS])
def test_las_tablas_empiezan_en_cero_y_van_de_menor_a_mayor(tabla):
    umbrales = [c.desde_xp for c in tabla]
    assert umbrales[0] == 0
    assert umbrales == sorted(set(umbrales))


# ---------- Por la API (contra PostgreSQL) ----------


def registrar(client, correo="ana@una.ac.cr"):
    r = client.post("/api/auth/registro", json={
        "correo": correo, "password": "Pomodoro25", "especie_id": 1, "nombre_mascota": "Michi",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def materia_con_pomodoros(client, conn, headers, nombre, completados):
    materia_id = client.post("/api/materias", json={"nombre": nombre}, headers=headers).json()["id"]
    for _ in range(completados):
        conn.execute(
            "INSERT INTO sesiones (materia_id, estado, inicio, fin) "
            "VALUES (%s, 'completada', now() - interval '30 minutes', now())",
            (materia_id,),
        )
    return materia_id


def test_una_materia_nueva_es_novato_nivel_1(client):
    headers = registrar(client)
    m = client.post("/api/materias", json={"nombre": "Cálculo"}, headers=headers).json()
    assert m["xp"] == 0
    assert m["nivel"] == 1
    assert m["rango"] == {"codigo": "novato", "nombre": "Novato"}


def test_la_api_de_materias_devuelve_nivel_y_rango_segun_el_xp(client, conn):
    headers = registrar(client)
    # 5 pomodoros = 500 XP, justo el umbral de Estudiante Promedio; 4 = 400 XP todavía es Novato
    cinco = materia_con_pomodoros(client, conn, headers, "Cálculo", 5)
    cuatro = materia_con_pomodoros(client, conn, headers, "Física", 4)

    m5 = client.get(f"/api/materias/{cinco}", headers=headers).json()
    assert (m5["xp"], m5["nivel"], m5["rango"]["codigo"]) == (500, 3, "estudiante_promedio")
    m4 = client.get(f"/api/materias/{cuatro}", headers=headers).json()
    assert (m4["xp"], m4["nivel"], m4["rango"]["codigo"]) == (400, 3, "novato")

    # El listado trae lo mismo
    lista = {m["nombre"]: m for m in client.get("/api/materias", headers=headers).json()}
    assert lista["Cálculo"]["rango"]["codigo"] == "estudiante_promedio"
    assert lista["Física"]["rango"]["codigo"] == "novato"


def test_me_suma_el_xp_de_todas_las_materias_para_la_etapa(client, conn):
    headers = registrar(client)
    materia_con_pomodoros(client, conn, headers, "Cálculo", 3)
    materia_con_pomodoros(client, conn, headers, "Física", 2)  # 3 + 2 = 500 XP: pasa a Joven

    mascota = client.get("/api/me", headers=headers).json()["mascota"]
    assert mascota["xp_total"] == 500
    assert mascota["nivel"] == 3
    assert mascota["etapa"] == {"codigo": "joven", "nombre": "Joven"}


def test_las_sesiones_canceladas_no_cuentan_para_la_etapa(client, conn):
    headers = registrar(client)
    materia_id = materia_con_pomodoros(client, conn, headers, "Cálculo", 4)
    conn.execute(
        "INSERT INTO sesiones (materia_id, estado, inicio, fin) "
        "VALUES (%s, 'cancelada', now() - interval '30 minutes', now())",
        (materia_id,),
    )
    mascota = client.get("/api/me", headers=headers).json()["mascota"]
    assert mascota["xp_total"] == 400
    assert mascota["etapa"]["codigo"] == "cria"


def test_el_xp_total_es_solo_del_usuario(client, conn):
    ana, beto = registrar(client, "ana@una.ac.cr"), registrar(client, "beto@una.ac.cr")
    materia_con_pomodoros(client, conn, ana, "Cálculo", 6)
    assert client.get("/api/me", headers=beto).json()["mascota"]["xp_total"] == 0
