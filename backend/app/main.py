from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ORIGENES_CORS
from app.routers import auth, coach, estadisticas, jefes, materias, quiz, sesiones

app = FastAPI(title="PomoPet API", version="0.1.0")

# Permite que el frontend llame a la API: Vite en local (puerto 5173) y, en producción,
# los dominios de CORS_ORIGINS (ver app/config.py)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_CORS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "PomoPet"}


app.include_router(auth.router)
app.include_router(materias.router)
app.include_router(jefes.router)
app.include_router(sesiones.router)
app.include_router(estadisticas.router)
app.include_router(coach.router)
app.include_router(quiz.router)
