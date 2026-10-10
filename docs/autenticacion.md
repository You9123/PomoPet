# Autenticación (Issue #3)

Registro básico con correo y contraseña propios (RF-13), sin proveedores externos.

## Mecanismo de sesión: JWT

1. El usuario se registra o inicia sesión y la API le devuelve un **token JWT**.
2. El frontend guarda el token y lo envía en cada petición protegida:
   `Authorization: Bearer <token>`
3. El backend verifica la firma del token y obtiene el id del usuario (`sub`).

| Dato          | Valor                                               |
| ------------- | --------------------------------------------------- |
| Algoritmo     | HS256 (firmado con `JWT_SECRET` del archivo `.env`) |
| Duración      | 24 horas (`JWT_HORAS`)                              |
| Contenido     | `sub` (id del usuario), `iat`, `exp`                |
| Cerrar sesión | El frontend borra el token                          |

Se eligió JWT porque la API no necesita guardar sesiones en la BD y FastAPI lo integra con el botón **Authorize** de `/docs`.

## Endpoints

| Método | Ruta                 | Protegido | Respuesta                                  |
| ------ | -------------------- | --------- | ------------------------------------------ |
| GET    | `/api/especies`      | No        | Especies de mascota para elegir            |
| POST   | `/api/auth/registro` | No        | `201` + token                              |
| POST   | `/api/auth/login`    | No        | `200` + token                              |
| GET    | `/api/me`            | Sí        | Usuario, su mascota y `descanso_largo_min` |

Ejemplo de registro:

```json
{
  "correo": "ana@una.ac.cr",
  "password": "Pomodoro25",
  "especie_id": 1,
  "nombre_mascota": "Michi"
}
```

## Reglas

- **Correo:** se guarda en minúscula; un correo repetido (sin importar mayúsculas) responde `409`. Esto revela qué correos tienen cuenta (el login no lo revela); se acepta como compromiso para el proyecto.
- **Contraseña:** mínimo 8 caracteres, al menos una letra y un número, máximo 72 bytes (límite de bcrypt).
- **Hash:** bcrypt; la contraseña nunca se guarda en texto plano (RNF-05).
- **Usuario + mascota:** se crean en la **misma transacción**; si la especie no existe (`422`) no se guarda nada.
- **Login incorrecto:** siempre `401` con el mismo mensaje, exista o no el correo, incluso si la contraseña pasa de 72 bytes.
- **Token:** debe traer `exp` y `sub`; un token sin vencimiento se rechaza con `401`.
- **Consultas SQL:** todas parametrizadas con `%s` (RNF-06), nunca armadas con f-strings.

## Cómo proteger un endpoint (para los demás issues)

Agregar la dependencia `usuario_actual`; FastAPI responde `401` si el token falta, es falso o venció:

```python
from fastapi import Depends

from app.db import get_conn
from app.seguridad import usuario_actual

@router.get("/materias")   # router con prefix="/api"
def listar_materias(usuario_id: int = Depends(usuario_actual), conn=Depends(get_conn)):
    ...  # usar usuario_id en el WHERE, nunca un id que mande el cliente
```

## Configuración

> ⚠️ **Antes de levantar el proyecto, agreguen `JWT_SECRET` a su `.env`.** Si falta, es muy corto (menos de 32 caracteres) o es el mismo de `.env.example`, `docker compose` o el backend **no arrancan** a propósito: con una clave conocida cualquiera podría fabricar tokens de otro usuario.

El archivo `.env` debe tener `JWT_SECRET` (ver `.env.example`). Para generar uno aleatorio:

```bash
python -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48))"
```

## Pruebas

```bash
docker compose up -d --build
docker compose exec backend pytest -v
```

Las pruebas usan la BD real dentro de una transacción que se deshace al final: no dejan datos guardados ni borran los que ya existen. Si no hay PostgreSQL disponible, las pruebas de la BD se saltan (en el CI fallan).
