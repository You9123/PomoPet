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

```bash
cp .env.example .env
docker compose up --build      # BD + API en http://localhost:8000/docs
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Equipo

Angelin López · Tiber Matamoros · Youfrend Chacón · Marco Rojas · Nataly Arce
