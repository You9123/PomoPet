# PomoPet 🍅🐾

Plataforma gamificada de gestión de tiempo y dominio académico.
Proyecto de Paradigmas de Programación, UNA, II Semestre 2026.

## Arquitectura

| Carpeta     | Lenguaje   | Tecnología           |
| ----------- | ---------- | -------------------- |
| `frontend/` | JavaScript | Vue 3 + Vite + Pinia |
| `backend/`  | Python     | FastAPI              |
| `database/` | SQL        | PostgreSQL 16        |

## Cómo correrlo

### Requisitos

| Programa | Versión | Para qué |
| --- | --- | --- |
| Git | cualquiera | descargar el código |
| Docker Desktop | reciente | corre PostgreSQL y el backend (no hay que instalar PostgreSQL ni Python) |
| Node.js | 22.18 o superior (o 24.12+) | frontend |

> **Windows:** Docker Desktop requiere WSL 2. Instalarlo con `wsl --install` en PowerShell (Administrador) y reiniciar.
> **Mac:** elegir la versión de Docker Desktop que corresponda al chip (Apple Silicon o Intel).

### Pasos

```bash
git clone https://github.com/You9123/PomoPet.git
cd PomoPet
git checkout develop
cp .env.example .env           # y cambiar POSTGRES_PASSWORD y JWT_SECRET (texto largo y aleatorio)
docker compose up --build      # BD + API en http://localhost:8000/docs
```

En **otra terminal**:

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

La primera vez Docker descarga las imágenes y carga `database/init/*.sql`; el backend espera a que
la BD esté lista. Para detener: `Ctrl + C`.

### Probar que todo funciona

```bash
docker compose exec backend pytest -v      # backend (con `docker compose up` corriendo)
cd frontend && npm test                    # frontend
```

Las reglas del esquema (`database/tests/pruebas_reglas.sql`) se explican en `docs/modelo-datos.md`;
el CI también las ejecuta en cada PR.

### Si cambia el esquema de la BD

PostgreSQL solo carga `database/init/` cuando el volumen está vacío. Después de un `git pull` que
toque `database/init/`, recrear la BD (**borra los datos locales**):

```bash
docker compose down -v
docker compose up --build
```

### Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| `Cannot connect to the Docker daemon` | Docker Desktop está cerrado: abrirlo y esperar a que diga "Engine running" |
| `Falta JWT_SECRET en el .env` | No se creó el `.env` o esa línea está vacía |
| Puerto 5432 u 8000 ocupado | Hay otro PostgreSQL o servicio local usándolo: cerrarlo |
| `/docs` abre pero sin botones (Try it out, Authorize) | La página carga sus scripts de `cdn.jsdelivr.net`: revisar bloqueadores, VPN o red |
| `401` en `/docs` | Falta el token: registrarse en `POST /api/auth/registro`, pulsar **Authorize** y pegar el `access_token` sin la palabra `Bearer` |
| `npm install` avisa de la versión de Node | Instalar Node 22.18+ o 24.12+ |

### Checklist para cada integrante (issue #2)

- [ ] `docker compose up --build` termina sin errores y `http://localhost:8000/docs` abre
- [ ] `http://localhost:5173` abre y se puede crear una cuenta
- [ ] `docker compose exec backend pytest -v` pasa
- [ ] `cd frontend && npm test` pasa

## Equipo

Angelin López · Tiber Matamoros · Youfrend Chacón · Marco Rojas · Nataly Arce
