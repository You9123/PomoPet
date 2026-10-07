import os

# Se leen del entorno (docker-compose las toma del archivo .env).
# El valor por defecto solo sirve para desarrollo local.
DATABASE_URL = os.environ.get("DATABASE_URL") or "postgresql://pomopet:cambia_esto@localhost:5432/pomopet"
JWT_SECRET = os.environ.get("JWT_SECRET") or "solo-para-desarrollo-local-cambiar-en-env"
JWT_HORAS = int(os.environ.get("JWT_HORAS") or 24)
