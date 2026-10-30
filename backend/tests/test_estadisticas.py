"""Pruebas del panel de estadísticas (issue #11, RF-08) contra PostgreSQL real.

La transacción de prueba congela now(): las sesiones se insertan con horas calculadas desde now()
en la BD, así que el resultado no depende de la hora en que se corran las pruebas.
"""

from tests.test_sesiones import accion, agregar_pausa_cerrada, crear_usuario, iniciar, retrasar_inicio

CR = "America/Costa_Rica"


# ---------- Utilidades ----------

def estadisticas(client, headers, **params):
    return client.get("/api/estadisticas", params=params, headers=headers)


def historial(client, headers, **params):
    return client.get("/api/estadisticas/historial", params=params, headers=headers)


def hora_local(conn, zona, dias_atras, hora):
    """Instante (timestamptz) de las `hora` del día de hace `dias_atras` días en la zona dada."""
    return conn.execute(
        "SELECT ((now() AT TIME ZONE %s)::date - %s::INT + %s::TIME) AT TIME ZONE %s AS t",
        (zona, dias_atras, hora, zona),
    ).fetchone()["t"]


def hoy(conn, zona):
    return conn.execute("SELECT (now() AT TIME ZONE %s)::date AS d", (zona,)).fetchone()["d"]


def insertar_sesion(conn, materia_id, inicio, minutos, estado="completada"):
    return conn.execute(
        """
        INSERT INTO sesiones (materia_id, inicio, fin, estado)
        VALUES (%s, %s, %s + make_interval(mins => %s), %s) RETURNING id
        """,
        (materia_id, inicio, inicio, minutos, estado),
    ).fetchone()["id"]


def otra_materia(conn, materia_id, nombre="Física", color="#3ee6b0"):
    return conn.execute(
        """
        INSERT INTO materias (usuario_id, nombre, color)
        SELECT usuario_id, %s, %s FROM materias WHERE id = %s RETURNING id
        """,
        (nombre, color, materia_id),
    ).fetchone()["id"]


def completar(client, conn, headers, materia_id):
    sesion = iniciar(client, headers, materia_id).json()
    retrasar_inicio(conn, sesion["id"], 25)
    assert accion(client, headers, sesion["id"], "finalizar").status_code == 200
    return sesion["id"]


def cancelar_tras(client, conn, headers, materia_id, minutos):
    sesion = iniciar(client, headers, materia_id).json()
    retrasar_inicio(conn, sesion["id"], minutos)
    assert accion(client, headers, sesion["id"], "cancelar").status_code == 200
    return sesion["id"]


# ---------- Resumen y progreso por materia ----------

def test_usuario_nuevo_tiene_todo_en_cero(client, conn):
    headers, materia = crear_usuario(client, conn)
    r = estadisticas(client, headers)
    assert r.status_code == 200
    datos = r.json()
    assert datos["resumen"] == {
        "minutos_estudiados": 0, "minutos_en_canceladas": 0,
        "pomodoros_completados": 0, "pomodoros_cancelados": 0,
        "tasa_exito": None, "xp_total": 0, "nivel": 1,
    }
    assert [m["id"] for m in datos["por_materia"]] == [materia]
    assert datos["por_materia"][0]["xp"] == 0
    # 7 días por defecto, terminando hoy (hora de Costa Rica), sin series pero sin huecos
    por_dia = datos["por_dia"]
    assert por_dia["zona"] == CR
    assert len(por_dia["dias"]) == 7
    assert por_dia["dias"][-1] == hoy(conn, CR).isoformat()
    assert por_dia["series"] == []
    assert por_dia["completados"] == [0] * 7
    assert por_dia["cancelados"] == [0] * 7


def test_las_canceladas_se_cuentan_aparte_y_no_dan_xp(client, conn):
    headers, materia = crear_usuario(client, conn)
    completar(client, conn, headers, materia)
    cancelar_tras(client, conn, headers, materia, 10)

    resumen = estadisticas(client, headers).json()["resumen"]
    assert resumen["pomodoros_completados"] == 1
    assert resumen["pomodoros_cancelados"] == 1
    assert resumen["minutos_estudiados"] == 25        # solo la completada
    assert resumen["minutos_en_canceladas"] == 10
    assert resumen["tasa_exito"] == 50
    assert resumen["xp_total"] == 100


def test_el_xp_por_materia_coincide_con_la_pantalla_de_materias(client, conn):
    headers, calculo = crear_usuario(client, conn)
    fisica = otra_materia(conn, calculo)
    completar(client, conn, headers, fisica)
    completar(client, conn, headers, fisica)
    completar(client, conn, headers, calculo)

    por_materia = estadisticas(client, headers).json()["por_materia"]
    # la de más pomodoros primero
    assert [(m["nombre"], m["xp"], m["nivel"]) for m in por_materia] == [("Física", 200, 2), ("Cálculo", 100, 1)]

    materias = {m["id"]: m for m in client.get("/api/materias", headers=headers).json()}
    for m in por_materia:
        assert m["xp"] == materias[m["id"]]["xp"]
        assert m["minutos_estudiados"] == materias[m["id"]]["minutos_estudiados"]
        assert m["rango"] == materias[m["id"]]["rango"]


def test_la_sesion_en_curso_no_cuenta(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()
    retrasar_inicio(conn, sesion["id"], 40)
    datos = estadisticas(client, headers).json()
    assert datos["resumen"]["pomodoros_completados"] == 0
    assert datos["resumen"]["minutos_en_canceladas"] == 0
    assert datos["por_dia"]["series"] == []
    assert historial(client, headers).json()["total"] == 0


# ---------- Minutos por día ----------

def test_minutos_por_dia_separados_por_materia(client, conn):
    headers, calculo = crear_usuario(client, conn)
    fisica = otra_materia(conn, calculo)
    insertar_sesion(conn, calculo, hora_local(conn, CR, 1, "10:00"), 30)
    insertar_sesion(conn, calculo, hora_local(conn, CR, 1, "15:00"), 25)
    insertar_sesion(conn, fisica, hora_local(conn, CR, 3, "09:00"), 26)
    insertar_sesion(conn, fisica, hora_local(conn, CR, 3, "11:00"), 12, estado="cancelada")

    por_dia = estadisticas(client, headers, dias=5).json()["por_dia"]
    assert len(por_dia["dias"]) == 5
    series = {s["nombre"]: s for s in por_dia["series"]}
    assert series["Cálculo"]["minutos"] == [0, 0, 0, 55, 0]
    assert series["Física"]["minutos"] == [0, 26, 0, 0, 0]     # la cancelada no suma minutos
    assert series["Física"]["color"] == "#3ee6b0"
    assert por_dia["completados"] == [0, 1, 0, 2, 0]
    assert por_dia["cancelados"] == [0, 1, 0, 0, 0]


def test_el_dia_se_cuenta_en_la_hora_local(client, conn):
    """Las 11:30 p. m. de ayer en Costa Rica ya son hoy en UTC."""
    headers, materia = crear_usuario(client, conn)
    insertar_sesion(conn, materia, hora_local(conn, CR, 1, "23:30"), 25)

    en_cr = estadisticas(client, headers, zona=CR).json()["por_dia"]
    ayer_cr = en_cr["dias"].index(str(conn.execute(
        "SELECT (now() AT TIME ZONE %s)::date - 1 AS d", (CR,)).fetchone()["d"]))
    assert en_cr["series"][0]["minutos"][ayer_cr] == 25

    en_utc = estadisticas(client, headers, zona="UTC").json()["por_dia"]
    dia_utc = en_utc["dias"].index(hoy(conn, CR).isoformat())   # 05:30 UTC del "hoy" de Costa Rica
    assert en_utc["series"][0]["minutos"][dia_utc] == 25


def test_solo_entran_los_dias_pedidos(client, conn):
    headers, materia = crear_usuario(client, conn)
    insertar_sesion(conn, materia, hora_local(conn, CR, 20, "10:00"), 25)

    assert estadisticas(client, headers, dias=7).json()["por_dia"]["series"] == []
    por_mes = estadisticas(client, headers, dias=30).json()
    assert len(por_mes["por_dia"]["dias"]) == 30
    assert sum(por_mes["por_dia"]["series"][0]["minutos"]) == 25
    # el resumen cuenta todo el historial, sin importar el periodo
    assert estadisticas(client, headers, dias=7).json()["resumen"]["minutos_estudiados"] == 25


def test_parametros_invalidos(client, conn):
    headers, _ = crear_usuario(client, conn)
    assert estadisticas(client, headers, dias=0).status_code == 422
    assert estadisticas(client, headers, dias=366).status_code == 422
    r = estadisticas(client, headers, zona="Marte/Olympus")
    assert r.status_code == 422
    assert "Zona horaria" in r.json()["detail"]


# ---------- Historial ----------

def test_historial_incluye_completadas_y_canceladas(client, conn):
    headers, materia = crear_usuario(client, conn)
    completada = completar(client, conn, headers, materia)
    cancelada = cancelar_tras(client, conn, headers, materia, 10)
    iniciar(client, headers, materia)  # en curso: no aparece

    datos = historial(client, headers).json()
    assert datos["total"] == 2
    sesiones = datos["sesiones"]
    # de la más reciente a la más antigua (la cancelada empezó hace 10 min, la otra hace 25)
    assert [s["id"] for s in sesiones] == [cancelada, completada]
    assert [(s["estado"], s["xp"]) for s in sesiones] == [("cancelada", 0), ("completada", 100)]
    assert sesiones[0]["segundos_efectivos"] == 600
    assert sesiones[1]["materia_nombre"] == "Cálculo"
    assert sesiones[1]["materia_color"] == "#888888"


def test_historial_resta_las_pausas_y_muestra_el_jefe(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = client.post(
        f"/api/materias/{materia}/jefes", json={"nombre": "Parcial", "hp_total": 3}, headers=headers
    ).json()
    sesion = iniciar(client, headers, materia, jefe_id=jefe["id"]).json()
    retrasar_inicio(conn, sesion["id"], 30)
    agregar_pausa_cerrada(conn, sesion["id"], hace_seg=1200, duracion_seg=300)
    assert accion(client, headers, sesion["id"], "finalizar").status_code == 200

    s = historial(client, headers).json()["sesiones"][0]
    assert (s["segundos_pausados"], s["segundos_efectivos"]) == (300, 1500)
    assert s["jefe_nombre"] == "Parcial"


def test_historial_por_paginas_y_filtrado(client, conn):
    headers, materia = crear_usuario(client, conn)
    for dias_atras in (3, 2, 1):
        insertar_sesion(conn, materia, hora_local(conn, CR, dias_atras, "10:00"), 25)
    insertar_sesion(conn, materia, hora_local(conn, CR, 4, "10:00"), 5, estado="cancelada")

    pagina1 = historial(client, headers, por_pagina=3).json()
    pagina2 = historial(client, headers, por_pagina=3, pagina=2).json()
    assert (pagina1["total"], len(pagina1["sesiones"]), len(pagina2["sesiones"])) == (4, 3, 1)
    assert pagina2["sesiones"][0]["estado"] == "cancelada"   # la más antigua
    assert historial(client, headers, pagina=9).json()["sesiones"] == []

    canceladas = historial(client, headers, estado="cancelada").json()
    assert canceladas["total"] == 1
    assert historial(client, headers, estado="en_curso").status_code == 422
    assert historial(client, headers, por_pagina=51).status_code == 422


# ---------- Seguridad ----------

def test_no_se_mezclan_los_datos_de_otro_usuario(client, conn):
    _, materia_ana = crear_usuario(client, conn, "ana@una.ac.cr")
    beto, _ = crear_usuario(client, conn, "beto@una.ac.cr")
    insertar_sesion(conn, materia_ana, hora_local(conn, CR, 1, "10:00"), 25)

    datos = estadisticas(client, beto).json()
    assert datos["resumen"]["pomodoros_completados"] == 0
    assert datos["por_dia"]["series"] == []
    assert historial(client, beto).json()["total"] == 0


def test_sin_token_responde_401(client):
    assert client.get("/api/estadisticas").status_code == 401
    assert client.get("/api/estadisticas/historial").status_code == 401
