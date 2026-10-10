from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, sesiones

app = FastAPI(title="PomoPet API", version="0.1.0")

# Permite que el frontend (Vite corre en el puerto 5173) llame a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "PomoPet"}


app.include_router(auth.router)
app.include_router(sesiones.router)
