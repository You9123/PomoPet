from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import JWT_HORAS, JWT_SECRET

ALGORITMO = "HS256"

# Muestra el botón "Authorize" en /docs para pegar el token
bearer = HTTPBearer(auto_error=False)


# ---------- Contraseñas (RNF-05) ----------

def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    datos = password.encode("utf-8")
    if len(datos) > 72:  # límite de bcrypt: nunca puede coincidir (y bcrypt lanzaría error)
        return False
    return bcrypt.checkpw(datos, password_hash.encode("utf-8"))


# ---------- Token JWT ----------

def crear_token(usuario_id: int) -> str:
    ahora = datetime.now(timezone.utc)
    datos = {"sub": str(usuario_id), "iat": ahora, "exp": ahora + timedelta(hours=JWT_HORAS)}
    return jwt.encode(datos, JWT_SECRET, algorithm=ALGORITMO)


def usuario_actual(credenciales: HTTPAuthorizationCredentials | None = Depends(bearer)) -> int:
    """Dependencia para endpoints protegidos: devuelve el id del usuario del token."""
    no_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o vencido",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credenciales is None:
        raise no_autorizado
    try:
        datos = jwt.decode(
            credenciales.credentials, JWT_SECRET, algorithms=[ALGORITMO],
            options={"require": ["exp", "sub"]},  # rechaza tokens sin vencimiento
        )
        return int(datos["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise no_autorizado
