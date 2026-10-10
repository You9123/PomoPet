import jwt
import pytest

from app.config import JWT_SECRET

REGISTRO = {
    "correo": "Ana@UNA.ac.cr",
    "password": "Pomodoro25",
    "especie_id": 1,
    "nombre_mascota": "Michi",
}


def registrar(client, **cambios):
    return client.post("/api/auth/registro", json={**REGISTRO, **cambios})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Especies ----------

def test_lista_especies(client):
    r = client.get("/api/especies")
    assert r.status_code == 200
    assert [e["codigo"] for e in r.json()] == ["gato", "perro", "conejo"]


# ---------- Registro válido ----------

def test_registro_valido_crea_usuario_y_mascota(client):
    r = registrar(client)
    assert r.status_code == 201
    token = r.json()["access_token"]

    me = client.get("/api/me", headers=auth(token)).json()
    assert me["correo"] == "ana@una.ac.cr"          # se guarda en minúscula
    assert me["descanso_largo_min"] == 15            # valor por defecto (RF-10)
    assert me["mascota"] == {"nombre": "Michi", "especie": "gato", "especie_nombre": "Gato"}


# ---------- Registro inválido ----------

def test_correo_repetido_sin_importar_mayusculas(client):
    assert registrar(client).status_code == 201
    r = registrar(client, correo="ana@una.AC.CR")
    assert r.status_code == 409


@pytest.mark.parametrize("correo", ["sin-arroba.com", "ana@una", "ana @una.ac.cr", ""])
def test_correo_invalido(client, correo):
    assert registrar(client, correo=correo).status_code == 422


@pytest.mark.parametrize("password", ["corta1", "sinnumeros", "12345678", "a1" * 40])
def test_password_debil_o_muy_larga(client, password):
    assert registrar(client, password=password).status_code == 422


def test_mascota_sin_nombre(client):
    assert registrar(client, nombre_mascota="   ").status_code == 422


def test_especie_inexistente_no_crea_el_usuario(client):
    r = registrar(client, especie_id=999)
    assert r.status_code == 422
    # misma transacción: el usuario tampoco se guardó
    login = client.post("/api/auth/login", json={"correo": REGISTRO["correo"], "password": REGISTRO["password"]})
    assert login.status_code == 401


def test_password_no_se_guarda_en_texto_plano(client, conn):
    registrar(client)
    fila = conn.execute("SELECT password_hash FROM usuarios WHERE correo = 'ana@una.ac.cr'").fetchone()
    assert fila["password_hash"] != REGISTRO["password"]
    assert fila["password_hash"].startswith("$2b$")   # formato bcrypt (RNF-05)


# ---------- Login ----------

def test_login_correcto(client):
    registrar(client)
    r = client.post("/api/auth/login", json={"correo": "ANA@una.ac.cr", "password": "Pomodoro25"})
    assert r.status_code == 200
    assert client.get("/api/me", headers=auth(r.json()["access_token"])).status_code == 200


@pytest.mark.parametrize("correo, password", [
    ("ana@una.ac.cr", "Incorrecta99"),   # contraseña equivocada
    ("nadie@una.ac.cr", "Pomodoro25"),   # correo que no existe
    ("ana@una.ac.cr", "a1" * 50),        # más de 72 bytes: antes daba 500
])
def test_login_incorrecto_mismo_mensaje(client, correo, password):
    registrar(client)
    r = client.post("/api/auth/login", json={"correo": correo, "password": password})
    assert r.status_code == 401
    assert r.json()["detail"] == "Correo o contraseña incorrectos"


# ---------- Endpoint protegido ----------

def test_me_sin_token(client):
    assert client.get("/api/me").status_code == 401


def test_me_con_token_falso(client):
    assert client.get("/api/me", headers=auth("no.es.un.token")).status_code == 401



def test_me_con_token_sin_vencimiento(client):
    # Firmado con la clave correcta pero sin "exp": no debe aceptarse
    token = jwt.encode({"sub": "1"}, JWT_SECRET, algorithm="HS256")
    assert client.get("/api/me", headers=auth(token)).status_code == 401
