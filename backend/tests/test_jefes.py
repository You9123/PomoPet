"""Pruebas de la API del Jefe Final (issue #9) contra PostgreSQL real."""

from tests.test_sesiones import accion, crear_usuario, iniciar, retrasar_inicio


# ---------- Utilidades ----------

def crear_jefe(client, headers, materia_id, nombre="Parcial", hp_total=3, **extra):
    return client.post(
        f"/api/materias/{materia_id}/jefes",
        json={"nombre": nombre, "hp_total": hp_total, **extra},
        headers=headers,
    )


def completar_pomodoro(client, conn, headers, materia_id, jefe_id):
    sesion = iniciar(client, headers, materia_id, jefe_id=jefe_id).json()
    retrasar_inicio(conn, sesion["id"], 25)
    assert accion(client, headers, sesion["id"], "finalizar").status_code == 200


def ver(client, headers, jefe_id):
    return client.get(f"/api/jefes/{jefe_id}", headers=headers).json()


# ---------- Crear y leer ----------

def test_crear_jefe_empieza_con_el_hp_completo(client, conn):
    headers, materia = crear_usuario(client, conn)
    r = crear_jefe(client, headers, materia, hp_total=10, fecha_limite="2030-12-01")
    assert r.status_code == 201
    jefe = r.json()
    assert jefe["materia_id"] == materia
    assert (jefe["hp_total"], jefe["hp_actual"], jefe["pomodoros_recibidos"]) == (10, 10, 0)
    assert jefe["derrotado"] is False
    assert jefe["fecha_limite"] == "2030-12-01"


def test_crear_jefe_rechaza_datos_invalidos(client, conn):
    headers, materia = crear_usuario(client, conn)
    assert crear_jefe(client, headers, materia, nombre="   ").status_code == 422
    assert crear_jefe(client, headers, materia, hp_total=0).status_code == 422
    assert crear_jefe(client, headers, materia, hp_total=-2).status_code == 422
    assert crear_jefe(client, headers, materia, fecha_limite="pronto").status_code == 422


def test_listar_jefes_de_la_materia(client, conn):
    headers, materia = crear_usuario(client, conn)
    crear_jefe(client, headers, materia, nombre="Parcial 1")
    crear_jefe(client, headers, materia, nombre="Parcial 2")
    r = client.get(f"/api/materias/{materia}/jefes", headers=headers)
    assert [j["nombre"] for j in r.json()] == ["Parcial 1", "Parcial 2"]


def test_los_jefes_ajenos_dan_404(client, conn):
    _, materia_ana = crear_usuario(client, conn, "ana@una.ac.cr")
    otro, _ = crear_usuario(client, conn, "beto@una.ac.cr")
    assert crear_jefe(client, otro, materia_ana).status_code == 404
    assert client.get(f"/api/materias/{materia_ana}/jefes", headers=otro).status_code == 404


def test_jefes_requieren_token(client):
    assert client.get("/api/materias/1/jefes").status_code == 401
    assert client.get("/api/jefes/1").status_code == 401


def test_ver_y_borrar_jefe(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = crear_jefe(client, headers, materia).json()
    assert ver(client, headers, jefe["id"])["nombre"] == "Parcial"
    assert client.delete(f"/api/jefes/{jefe['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/jefes/{jefe['id']}", headers=headers).status_code == 404


# ---------- Daño por pomodoro (RF-12) ----------

def test_cada_pomodoro_completado_quita_1_de_hp(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = crear_jefe(client, headers, materia, hp_total=3).json()
    for esperado in (2, 1):
        completar_pomodoro(client, conn, headers, materia, jefe["id"])
        estado = ver(client, headers, jefe["id"])
        assert estado["hp_actual"] == esperado
        assert estado["derrotado"] is False


def test_el_ultimo_pomodoro_derrota_al_jefe(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = crear_jefe(client, headers, materia, hp_total=1).json()
    completar_pomodoro(client, conn, headers, materia, jefe["id"])
    estado = ver(client, headers, jefe["id"])
    assert (estado["hp_actual"], estado["pomodoros_recibidos"], estado["derrotado"]) == (0, 1, True)


def test_un_pomodoro_cancelado_no_daña_al_jefe(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = crear_jefe(client, headers, materia, hp_total=2).json()
    sesion = iniciar(client, headers, materia, jefe_id=jefe["id"]).json()
    accion(client, headers, sesion["id"], "cancelar")
    assert ver(client, headers, jefe["id"])["hp_actual"] == 2


# ---------- Reglas de la sesión con jefe ----------

def test_no_se_puede_atacar_a_un_jefe_derrotado(client, conn):
    headers, materia = crear_usuario(client, conn)
    jefe = crear_jefe(client, headers, materia, hp_total=1).json()
    completar_pomodoro(client, conn, headers, materia, jefe["id"])
    r = iniciar(client, headers, materia, jefe_id=jefe["id"])
    assert r.status_code == 409
    assert "derrotado" in r.json()["detail"]


def test_el_jefe_debe_ser_de_la_misma_materia(client, conn):
    headers, materia = crear_usuario(client, conn)
    otra = conn.execute(
        "INSERT INTO materias (usuario_id, nombre) "
        "SELECT usuario_id, 'Física' FROM materias WHERE id = %s RETURNING id",
        (materia,),
    ).fetchone()["id"]
    jefe_de_otra = crear_jefe(client, headers, otra).json()
    assert iniciar(client, headers, materia, jefe_id=jefe_de_otra["id"]).status_code == 404
