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

### Pruebas de integración (las tres capas juntas)

Usan [Playwright](https://playwright.dev): abre un Chrome real y recorre la app como una persona.
Vue llama a FastAPI y FastAPI guarda en PostgreSQL; nada es falso. Están en `frontend/e2e/`:

| Prueba | Qué recorre |
| --- | --- |
| `flujo-completo.spec.js` | Registro con mascota → crear materia → pomodoro con una pausa → 100 XP en **Progreso** y en **Materias** |
| `cancelar.spec.js` | Iniciar y cancelar una sesión → aparece en el historial como cancelada y sin XP |

Con `docker compose up` corriendo, en otra terminal:

```bash
cd frontend
npx playwright install chromium   # solo la primera vez: descarga el navegador
npm run test:e2e                  # levanta Vite solo si no está corriendo
```

- **Para no esperar 25 minutos**, la prueba "viaja en el tiempo": mueve en la BD la hora de inicio de
  la sesión 26 minutos hacia atrás (lo mismo que `retrasar_inicio` en las pruebas del backend). El
  backend sigue validando los 25 minutos efectivos igual que siempre; el código de la app no cambia.
- Cada prueba crea su propio usuario (`e2e-…@pomopet.test`) y lo borra al terminar: tus datos no se tocan.
- Para ver el navegador mientras corre: `npm run test:e2e -- --headed`. Para ir paso a paso: `-- --ui`.
- Si una prueba falla, Playwright guarda una captura y la traza en `frontend/test-results/`
  (abrirla con `npx playwright show-trace <archivo .zip>`).
- El CI las corre en cada PR (job `integration-tests`), con `docker compose` como aquí.

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
- [ ] `cd frontend && npm run test:e2e` pasa (con `docker compose up` corriendo)

## Equipo

Angelin López · Tiber Matamoros · Youfrend Chacón · Marco Rojas · Nataly Arce
