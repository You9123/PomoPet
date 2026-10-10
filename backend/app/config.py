import os

# Se leen del entorno (docker-compose las toma del archivo .env).
# El valor por defecto solo sirve para desarrollo local.
DATABASE_URL = os.environ.get("DATABASE_URL") or "postgresql://pomopet:cambia_esto@localhost:5432/pomopet"

# Sin valor por defecto: con una clave conocida cualquiera podría fabricar tokens.
# Si falta, el backend no arranca (mejor que arrancar inseguro).
JWT_SECRET = os.environ.get("JWT_SECRET", "")
if len(JWT_SECRET) < 32 or JWT_SECRET == "cambia_esto_por_un_texto_largo_y_aleatorio":
    raise RuntimeError(
        "Falta JWT_SECRET en el .env (mínimo 32 caracteres y distinto al de .env.example). "
        "Ver docs/autenticacion.md"
    )
    
JWT_HORAS = int(os.environ.get("JWT_HORAS") or 24)
