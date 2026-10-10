import re

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import errors
from pydantic import BaseModel, Field, field_validator

from app.db import get_conn
from app.seguridad import crear_token, hashear_password, usuario_actual, verificar_password

router = APIRouter(prefix="/api", tags=["usuarios"])

# Mismo formato que el CHECK correo_formato de la tabla usuarios
CORREO_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Hash de relleno: el login tarda lo mismo exista o no el correo
HASH_FALSO = hashear_password("relleno-para-tiempo-constante")


# ---------- Esquemas (validación con Pydantic) ----------

class Credenciales(BaseModel):
    correo: str = Field(max_length=255, examples=["ana@una.ac.cr"])
    password: str = Field(examples=["Pomodoro25"])

    @field_validator("correo")
    @classmethod
    def normalizar_correo(cls, v: str) -> str:
        v = v.strip().lower()
        if not CORREO_REGEX.match(v):
            raise ValueError("El correo no tiene un formato válido")
        return v


class Registro(Credenciales):
    especie_id: int = Field(examples=[1])
    nombre_mascota: str = Field(min_length=1, max_length=50, examples=["Michi"])

    @field_validator("password")
    @classmethod
    def password_segura(cls, v: str) -> str:
        # RF-13: requisitos mínimos de la contraseña
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        if len(v.encode("utf-8")) > 72:  # límite de bcrypt
            raise ValueError("La contraseña es demasiado larga (máximo 72 bytes)")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("La contraseña debe tener al menos una letra y un número")
        return v

    @field_validator("nombre_mascota")
    @classmethod
    def limpiar_nombre(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La mascota necesita un nombre")
        return v


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Endpoints ----------

@router.get("/especies")
def listar_especies(conn=Depends(get_conn)):
    """Especies de mascota que se pueden elegir al registrarse."""
    return conn.execute(
        "SELECT id, codigo, nombre, descripcion FROM especies_mascota ORDER BY id"
    ).fetchall()


@router.post("/auth/registro", response_model=Token, status_code=status.HTTP_201_CREATED)
def registrar(datos: Registro, conn=Depends(get_conn)):
    """Crea el usuario y su mascota en la misma transacción (si algo falla, no se guarda nada)."""
    try:
        usuario = conn.execute(
            "INSERT INTO usuarios (correo, password_hash) VALUES (%s, %s) RETURNING id",
            (datos.correo, hashear_password(datos.password)),
        ).fetchone()
        conn.execute(
            "INSERT INTO mascotas (usuario_id, especie_id, nombre) VALUES (%s, %s, %s)",
            (usuario["id"], datos.especie_id, datos.nombre_mascota),
        )
    except errors.UniqueViolation:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese correo")
    except errors.ForeignKeyViolation:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La especie elegida no existe")
    return Token(access_token=crear_token(usuario["id"]))


@router.post("/auth/login", response_model=Token)
def iniciar_sesion(datos: Credenciales, conn=Depends(get_conn)):
    usuario = conn.execute(
        "SELECT id, password_hash FROM usuarios WHERE LOWER(correo) = %s",
        (datos.correo,),
    ).fetchone()
    hash_guardado = usuario["password_hash"] if usuario else HASH_FALSO
    if not verificar_password(datos.password, hash_guardado) or usuario is None:
        # Mismo mensaje en ambos casos: no revela si el correo existe
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")
    return Token(access_token=crear_token(usuario["id"]))


@router.get("/me")
def mi_perfil(usuario_id: int = Depends(usuario_actual), conn=Depends(get_conn)):
    """Datos del usuario del token, con su mascota."""
    fila = conn.execute(
        """
        SELECT u.id, u.correo, u.descanso_largo_min,
               m.nombre AS mascota_nombre, e.codigo AS especie_codigo, e.nombre AS especie_nombre
        FROM usuarios u
        JOIN mascotas m         ON m.usuario_id = u.id
        JOIN especies_mascota e ON e.id = m.especie_id
        WHERE u.id = %s
        """,
        (usuario_id,),
    ).fetchone()
    if fila is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "El usuario ya no existe")
    return {
        "id": fila["id"],
        "correo": fila["correo"],
        "descanso_largo_min": fila["descanso_largo_min"],
        "mascota": {
            "nombre": fila["mascota_nombre"],
            "especie": fila["especie_codigo"],
            "especie_nombre": fila["especie_nombre"],
        },
    }
