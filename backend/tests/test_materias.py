"""Pruebas de la API de materias (issue #4) contra PostgreSQL real."""


# ---------- Utilidades ----------

def registrar(client, correo="ana@una.ac.cr"):
    r = client.post("/api/auth/registro", json={
        "correo": correo, "password": "Pomodoro25", "especie_id": 1, "nombre_mascota": "Michi",
    })
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def crear(client, headers, nombre="Cálculo", **extra):
    return client.post("/api/materias", json={"nombre": nombre, **extra}, headers=headers)


# ---------- Crear ----------

def test_crear_materia(client):
    headers = registrar(client)
    r = crear(client, headers, color="#4F46E5", horas_semanales=6)
    assert r.status_code == 201
    m = r.json()
    assert m["nombre"] == "Cálculo"
    assert m["color"] == "#4F46E5"
    assert m["horas_semanales"] == 6
    assert (m["pomodoros_completados"], m["pomodoros_cancelados"], m["minutos_estudiados"], m["xp"]) == (0, 0, 0, 0)


def test_crear_usa_valores_por_defecto_y_limpia_el_nombre(client):
    headers = registrar(client)
    m = crear(client, headers, nombre="  Física  ").json()
    assert m["nombre"] == "Física"
    assert m["color"] == "#888888"
    assert m["horas_semanales"] is None


def test_crear_rechaza_datos_invalidos(client):
    headers = registrar(client)
    assert crear(client, headers, nombre="   ").status_code == 422
    assert crear(client, headers, nombre="x" * 101).status_code == 422
    assert crear(client, headers, color="rojo").status_code == 422
    assert crear(client, headers, horas_semanales=169).status_code == 422
    assert crear(client, headers, horas_semanales=-1).status_code == 422


def test_crear_requiere_token(client):
    assert client.post("/api/materias", json={"nombre": "Cálculo"}).status_code == 401
    assert client.get("/api/materias").status_code == 401


def test_nombre_repetido_da_409_sin_importar_mayusculas_ni_espacios(client):
    headers = registrar(client)
    assert crear(client, headers, nombre="Cálculo").status_code == 201
    r = crear(client, headers, nombre="  CÁLCULO ")
    assert r.status_code == 409
    assert "nombre" in r.json()["detail"]


def test_nombre_repetido_da_409_sin_importar_tildes(client):
    headers = registrar(client)
    assert crear(client, headers, nombre="Cálculo").status_code == 201
    for nombre in ("Calculo", "calculó", "CALCULO"):
        r = crear(client, headers, nombre=nombre)
        assert r.status_code == 409, nombre


def test_la_enie_no_cuenta_como_tilde(client):
    headers = registrar(client)
    assert crear(client, headers, nombre="Diseño").status_code == 201
    assert crear(client, headers, nombre="Diseno").status_code == 201


def test_dos_usuarios_pueden_tener_el_mismo_nombre(client):
    assert crear(client, registrar(client, "ana@una.ac.cr")).status_code == 201
    assert crear(client, registrar(client, "beto@una.ac.cr")).status_code == 201


# ---------- Tope de 20 (RF-02) ----------

def test_el_tope_es_de_20_materias(client):
    headers = registrar(client)
    for i in range(20):
        assert crear(client, headers, nombre=f"Materia {i}").status_code == 201
    r = crear(client, headers, nombre="Materia 21")
    assert r.status_code == 409
    assert "20" in r.json()["detail"]
    assert len(client.get("/api/materias", headers=headers).json()) == 20


def test_el_tope_es_por_usuario(client):
    ana = registrar(client, "ana@una.ac.cr")
    for i in range(20):
        crear(client, ana, nombre=f"Materia {i}")
    beto = registrar(client, "beto@una.ac.cr")
    assert crear(client, beto).status_code == 201


def test_borrar_una_materia_libera_un_cupo(client):
    headers = registrar(client)
    ids = [crear(client, headers, nombre=f"Materia {i}").json()["id"] for i in range(20)]
    assert crear(client, headers, nombre="Extra").status_code == 409
    assert client.delete(f"/api/materias/{ids[0]}", headers=headers).status_code == 204
    assert crear(client, headers, nombre="Extra").status_code == 201


# ---------- Listar y ver ----------

def test_listar_solo_muestra_las_del_usuario_en_orden_de_creacion(client):
    ana, beto = registrar(client, "ana@una.ac.cr"), registrar(client, "beto@una.ac.cr")
    crear(client, ana, nombre="Cálculo")
    crear(client, ana, nombre="Física")
    crear(client, beto, nombre="Química")
    assert [m["nombre"] for m in client.get("/api/materias", headers=ana).json()] == ["Cálculo", "Física"]
    assert [m["nombre"] for m in client.get("/api/materias", headers=beto).json()] == ["Química"]


def test_listar_sin_materias_devuelve_lista_vacia(client):
    assert client.get("/api/materias", headers=registrar(client)).json() == []


def test_ver_materia_ajena_o_inexistente_da_404(client):
    ana, beto = registrar(client, "ana@una.ac.cr"), registrar(client, "beto@una.ac.cr")
    materia_id = crear(client, ana).json()["id"]
    assert client.get(f"/api/materias/{materia_id}", headers=ana).status_code == 200
    assert client.get(f"/api/materias/{materia_id}", headers=beto).status_code == 404
    assert client.get("/api/materias/999999", headers=ana).status_code == 404


def test_el_progreso_cuenta_xp_y_minutos(client, conn):
    headers = registrar(client)
    materia_id = crear(client, headers).json()["id"]
    # Dos completadas (una de 30 min, otra de 25) y una cancelada
    for estado, minutos in (("completada", 30), ("completada", 25), ("cancelada", 5)):
        conn.execute(
            """
            INSERT INTO sesiones (materia_id, estado, inicio, fin)
            VALUES (%s, %s, now() - make_interval(mins => %s), now())
            """,
            (materia_id, estado, minutos),
        )
    m = client.get(f"/api/materias/{materia_id}", headers=headers).json()
    assert m["pomodoros_completados"] == 2
    assert m["pomodoros_cancelados"] == 1
    assert m["xp"] == 200
    assert m["minutos_estudiados"] == 55


# ---------- Editar ----------

def test_editar_cambia_solo_lo_enviado(client):
    headers = registrar(client)
    materia_id = crear(client, headers, color="#4F46E5", horas_semanales=6).json()["id"]
    r = client.patch(f"/api/materias/{materia_id}", json={"nombre": "Cálculo II"}, headers=headers)
    assert r.status_code == 200
    m = r.json()
    assert (m["nombre"], m["color"], m["horas_semanales"]) == ("Cálculo II", "#4F46E5", 6)


def test_editar_permite_quitar_las_horas_semanales(client):
    headers = registrar(client)
    materia_id = crear(client, headers, horas_semanales=6).json()["id"]
    r = client.patch(f"/api/materias/{materia_id}", json={"horas_semanales": None}, headers=headers)
    assert r.json()["horas_semanales"] is None


def test_editar_rechaza_nombre_repetido_o_invalido(client):
    headers = registrar(client)
    crear(client, headers, nombre="Cálculo")
    otra = crear(client, headers, nombre="Física").json()["id"]
    url = f"/api/materias/{otra}"
    assert client.patch(url, json={"nombre": "cálculo"}, headers=headers).status_code == 409
    assert client.patch(url, json={"nombre": "  "}, headers=headers).status_code == 422
    assert client.patch(url, json={"nombre": None}, headers=headers).status_code == 422
    assert client.patch(url, json={"color": "azul"}, headers=headers).status_code == 422
    # Renombrarse a sí misma con otras mayúsculas sí se permite
    assert client.patch(url, json={"nombre": "FÍSICA"}, headers=headers).status_code == 200


def test_editar_materia_ajena_da_404(client):
    ana, beto = registrar(client, "ana@una.ac.cr"), registrar(client, "beto@una.ac.cr")
    materia_id = crear(client, ana).json()["id"]
    r = client.patch(f"/api/materias/{materia_id}", json={"nombre": "Mía ahora"}, headers=beto)
    assert r.status_code == 404
    assert client.get(f"/api/materias/{materia_id}", headers=ana).json()["nombre"] == "Cálculo"


# ---------- Borrar ----------

def test_borrar_materia_borra_sus_sesiones(client, conn):
    headers = registrar(client)
    materia_id = crear(client, headers).json()["id"]
    conn.execute("INSERT INTO sesiones (materia_id) VALUES (%s)", (materia_id,))
    assert client.delete(f"/api/materias/{materia_id}", headers=headers).status_code == 204
    assert client.get(f"/api/materias/{materia_id}", headers=headers).status_code == 404
    assert conn.execute("SELECT 1 FROM sesiones WHERE materia_id = %s", (materia_id,)).fetchone() is None


def test_borrar_materia_ajena_da_404(client):
    ana, beto = registrar(client, "ana@una.ac.cr"), registrar(client, "beto@una.ac.cr")
    materia_id = crear(client, ana).json()["id"]
    assert client.delete(f"/api/materias/{materia_id}", headers=beto).status_code == 404
    assert client.get(f"/api/materias/{materia_id}", headers=ana).status_code == 200
