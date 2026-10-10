"""Pruebas de las sesiones Pomodoro (issue #5) contra PostgreSQL real.

La transacción de prueba congela now(), así que el paso del tiempo se simula
retrasando `sesiones.inicio` y las filas de `pausas`.
"""


# ---------- Utilidades ----------

def crear_usuario(client, conn, correo="ana@una.ac.cr"):
    """Registra un usuario con una materia. Devuelve (headers, materia_id)."""
    r = client.post("/api/auth/registro", json={
        "correo": correo, "password": "Pomodoro25", "especie_id": 1, "nombre_mascota": "Michi",
    })
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    usuario_id = client.get("/api/me", headers=headers).json()["id"]
    materia = conn.execute(
        "INSERT INTO materias (usuario_id, nombre) VALUES (%s, 'Cálculo') RETURNING id", (usuario_id,)
    ).fetchone()
    return headers, materia["id"]


def iniciar(client, headers, materia_id, **extra):
    return client.post("/api/sesiones", json={"materia_id": materia_id, **extra}, headers=headers)


def accion(client, headers, sesion_id, nombre):
    return client.post(f"/api/sesiones/{sesion_id}/{nombre}", headers=headers)


def retrasar_inicio(conn, sesion_id, minutos, segundos=0):
    """Hace que la sesión haya empezado hace `minutos:segundos`."""
    conn.execute(
        "UPDATE sesiones SET inicio = now() - make_interval(secs => %s) WHERE id = %s",
        (minutos * 60 + segundos, sesion_id),
    )


def agregar_pausa_cerrada(conn, sesion_id, hace_seg, duracion_seg):
    conn.execute(
        """
        INSERT INTO pausas (sesion_id, inicio, fin)
        VALUES (%s, now() - make_interval(secs => %s), now() - make_interval(secs => %s))
        """,
        (sesion_id, hace_seg, hace_seg - duracion_seg),
    )


def progreso(conn, materia_id):
    return conn.execute(
        "SELECT pomodoros_completados, pomodoros_cancelados FROM v_progreso_materia WHERE materia_id = %s",
        (materia_id,),
    ).fetchone()


def estado_en_bd(conn, sesion_id):
    return conn.execute("SELECT estado, fin FROM sesiones WHERE id = %s", (sesion_id,)).fetchone()


# ---------- Iniciar ----------

def test_iniciar_crea_sesion_en_curso(client, conn):
    headers, materia = crear_usuario(client, conn)
    r = iniciar(client, headers, materia)
    assert r.status_code == 201
    cuerpo = r.json()
    assert cuerpo["estado"] == "en_curso"
    assert cuerpo["fin"] is None
    assert cuerpo["pausada"] is False
    assert cuerpo["xp_otorgado"] == 0


def test_no_se_permiten_dos_sesiones_en_curso(client, conn):
    headers, materia = crear_usuario(client, conn)
    otra = conn.execute(
        "INSERT INTO materias (usuario_id, nombre) SELECT usuario_id, 'Física' FROM materias WHERE id = %s RETURNING id",
        (materia,),
    ).fetchone()["id"]
    assert iniciar(client, headers, materia).status_code == 201
    r = iniciar(client, headers, otra)          # aunque sea de otra materia
    assert r.status_code == 409
    assert "en curso" in r.json()["detail"]


def test_materia_de_otro_usuario_da_404(client, conn):
    _, materia_ajena = crear_usuario(client, conn, "ana@una.ac.cr")
    headers_beto, _ = crear_usuario(client, conn, "beto@una.ac.cr")
    assert iniciar(client, headers_beto, materia_ajena).status_code == 404


def test_jefe_de_otra_materia_da_404(client, conn):
    headers, materia = crear_usuario(client, conn)
    otra = conn.execute(
        "INSERT INTO materias (usuario_id, nombre) SELECT usuario_id, 'Física' FROM materias WHERE id = %s RETURNING id",
        (materia,),
    ).fetchone()["id"]
    jefe = conn.execute(
        "INSERT INTO jefes_finales (materia_id, nombre, hp_total) VALUES (%s, 'Parcial', 3) RETURNING id", (otra,)
    ).fetchone()["id"]
    assert iniciar(client, headers, materia, jefe_id=jefe).status_code == 404


def test_iniciar_con_jefe_de_la_misma_materia(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = conn.execute(
        "INSERT INTO jefes_finales (materia_id, nombre, hp_total) VALUES (%s, 'Parcial', 3) RETURNING id", (materia,)
    ).fetchone()["id"]
    r = iniciar(client, headers, materia, jefe_id=jefe)
    assert r.status_code == 201
    assert r.json()["jefe_id"] == jefe


def test_no_se_puede_atacar_a_un_jefe_derrotado(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = conn.execute(
        "INSERT INTO jefes_finales (materia_id, nombre, hp_total) VALUES (%s, 'Parcial', 1) RETURNING id", (materia,)
    ).fetchone()["id"]
    conn.execute(
        """
        INSERT INTO sesiones (materia_id, jefe_id, inicio, fin, estado)
        VALUES (%s, %s, now() - interval '30 minutes', now(), 'completada')
        """,
        (materia, jefe),
    )
    r = iniciar(client, headers, materia, jefe_id=jefe)
    assert r.status_code == 409
    assert "derrotado" in r.json()["detail"]


def test_sin_token_da_401(client):
    assert client.post("/api/sesiones", json={"materia_id": 1}).status_code == 401


# ---------- Sesión actual (para retomar el temporizador) ----------

def test_sesion_actual_sin_sesion_devuelve_null(client, conn):
    headers, _ = crear_usuario(client, conn)
    r = client.get("/api/sesiones/actual", headers=headers)
    assert r.status_code == 200
    assert r.json() is None


def test_sesion_actual_devuelve_la_sesion_en_curso_con_su_pausa(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    accion(client, headers, sesion, "pausar")
    r = client.get("/api/sesiones/actual", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == sesion
    assert r.json()["pausada"] is True


def test_sesion_actual_no_devuelve_sesiones_terminadas_ni_ajenas(client, conn):
    headers_ana, materia = crear_usuario(client, conn, "ana@una.ac.cr")
    headers_beto, _ = crear_usuario(client, conn, "beto@una.ac.cr")
    sesion = iniciar(client, headers_ana, materia).json()["id"]
    assert client.get("/api/sesiones/actual", headers=headers_beto).json() is None
    accion(client, headers_ana, sesion, "cancelar")
    assert client.get("/api/sesiones/actual", headers=headers_ana).json() is None


# ---------- Finalizar: el caso límite de 25 minutos ----------

def test_finalizar_con_25_minutos_completa_y_da_100_xp(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    retrasar_inicio(conn, sesion, 25)
    r = accion(client, headers, sesion, "finalizar")
    assert r.status_code == 200
    assert r.json()["estado"] == "completada"
    assert r.json()["xp_otorgado"] == 100
    assert r.json()["fin"] is not None
    assert progreso(conn, materia)["pomodoros_completados"] == 1


def test_finalizar_con_24_59_se_rechaza_y_sigue_en_curso(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    retrasar_inicio(conn, sesion, 24, 59)
    r = accion(client, headers, sesion, "finalizar")
    assert r.status_code == 409
    assert "faltan 0 min 1 s" in r.json()["detail"]
    bd = estado_en_bd(conn, sesion)
    assert bd["estado"] == "en_curso" and bd["fin"] is None
    assert progreso(conn, materia)["pomodoros_completados"] == 0


def test_la_pausa_no_cuenta_para_los_25_minutos(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    retrasar_inicio(conn, sesion, 40)                       # 40 min transcurridos
    agregar_pausa_cerrada(conn, sesion, hace_seg=30 * 60, duracion_seg=20 * 60)   # 20 min en pausa
    r = accion(client, headers, sesion, "finalizar")        # 20 min efectivos
    assert r.status_code == 409
    assert estado_en_bd(conn, sesion)["estado"] == "en_curso"


def test_con_pausa_corta_si_completa(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    retrasar_inicio(conn, sesion, 40)
    agregar_pausa_cerrada(conn, sesion, hace_seg=30 * 60, duracion_seg=10 * 60)   # 30 min efectivos
    r = accion(client, headers, sesion, "finalizar")
    assert r.status_code == 200
    assert r.json()["estado"] == "completada"
    assert r.json()["segundos_pausados"] == 600
    assert r.json()["segundos_efectivos"] == 30 * 60


def test_finalizar_cierra_la_pausa_abierta(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    retrasar_inicio(conn, sesion, 40)
    assert accion(client, headers, sesion, "pausar").status_code == 200
    conn.execute("UPDATE pausas SET inicio = now() - interval '5 minutes' WHERE sesion_id = %s", (sesion,))
    r = accion(client, headers, sesion, "finalizar")        # 40 - 5 = 35 min efectivos
    assert r.status_code == 200
    assert r.json()["pausada"] is False
    abiertas = conn.execute(
        "SELECT count(*) AS n FROM pausas WHERE sesion_id = %s AND fin IS NULL", (sesion,)
    ).fetchone()["n"]
    assert abiertas == 0


def test_pausa_abierta_tambien_resta_al_intentar_finalizar(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    retrasar_inicio(conn, sesion, 30)
    accion(client, headers, sesion, "pausar")
    conn.execute("UPDATE pausas SET inicio = now() - interval '10 minutes' WHERE sesion_id = %s", (sesion,))
    r = accion(client, headers, sesion, "finalizar")        # 30 - 10 = 20 min efectivos
    assert r.status_code == 409
    # No se escribió nada: la pausa sigue abierta y la sesión en curso
    assert estado_en_bd(conn, sesion)["estado"] == "en_curso"
    assert conn.execute(
        "SELECT count(*) AS n FROM pausas WHERE sesion_id = %s AND fin IS NULL", (sesion,)
    ).fetchone()["n"] == 1


# ---------- Pausar / reanudar ----------

def test_pausar_y_reanudar(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    r = accion(client, headers, sesion, "pausar")
    assert r.status_code == 200 and r.json()["pausada"] is True
    r = accion(client, headers, sesion, "reanudar")
    assert r.status_code == 200 and r.json()["pausada"] is False
    filas = conn.execute("SELECT fin FROM pausas WHERE sesion_id = %s", (sesion,)).fetchall()
    assert len(filas) == 1 and filas[0]["fin"] is not None


def test_no_se_puede_pausar_dos_veces(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    assert accion(client, headers, sesion, "pausar").status_code == 200
    assert accion(client, headers, sesion, "pausar").status_code == 409


def test_no_se_puede_reanudar_sin_pausa(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    assert accion(client, headers, sesion, "reanudar").status_code == 409


# ---------- Cancelar ----------

def test_cancelar_no_da_xp_y_queda_en_el_historial(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    retrasar_inicio(conn, sesion, 60)                       # aunque haya pasado mucho tiempo
    r = accion(client, headers, sesion, "cancelar")
    assert r.status_code == 200
    assert r.json()["estado"] == "cancelada"
    assert r.json()["xp_otorgado"] == 0
    p = progreso(conn, materia)
    assert p["pomodoros_completados"] == 0 and p["pomodoros_cancelados"] == 1


def test_cancelar_cierra_la_pausa_abierta(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    accion(client, headers, sesion, "pausar")
    assert accion(client, headers, sesion, "cancelar").status_code == 200
    abiertas = conn.execute(
        "SELECT count(*) AS n FROM pausas WHERE sesion_id = %s AND fin IS NULL", (sesion,)
    ).fetchone()["n"]
    assert abiertas == 0


def test_sesion_terminada_no_admite_mas_acciones(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    accion(client, headers, sesion, "cancelar")
    for nombre in ("pausar", "reanudar", "finalizar", "cancelar"):
        assert accion(client, headers, sesion, nombre).status_code == 409


def test_despues_de_terminar_se_puede_iniciar_otra(client, conn):
    headers, materia = crear_usuario(client, conn)
    sesion = iniciar(client, headers, materia).json()["id"]
    accion(client, headers, sesion, "cancelar")
    assert iniciar(client, headers, materia).status_code == 201


# ---------- Seguridad ----------

def test_no_se_puede_operar_la_sesion_de_otro_usuario(client, conn):
    headers_ana, materia = crear_usuario(client, conn, "ana@una.ac.cr")
    headers_beto, _ = crear_usuario(client, conn, "beto@una.ac.cr")
    sesion = iniciar(client, headers_ana, materia).json()["id"]
    for nombre in ("pausar", "reanudar", "finalizar", "cancelar"):
        assert accion(client, headers_beto, sesion, nombre).status_code == 404
