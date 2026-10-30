# Único módulo que habla con el proveedor de IA (issue #37, RNF-10). Ver docs/ia.md.
# El resto del backend usa generar_texto y generar_json, y nunca sabe qué proveedor hay detrás.
import json
from typing import ClassVar

import httpx
from pydantic import BaseModel, Field, ValidationError

from app import config

URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/interactions"
TIEMPO_MAXIMO_SEG = 15

TEXTO_FALSO = "¡Vas muy bien! Un pomodoro más y descansamos juntos."


class IAnoDisponible(Exception):
    """La IA no respondió algo usable: sin clave, caída, cupo agotado, tiempo agotado o respuesta inválida."""


# ---------- Esquemas de las respuestas en JSON ----------

class PreguntaQuiz(BaseModel):
    enunciado: str = Field(min_length=1)
    opciones: list[str] = Field(min_length=4, max_length=4)
    correcta: int = Field(ge=0, le=3)   # índice de la opción correcta


class QuizGenerado(BaseModel):
    """Quiz contra el Jefe Final (RF-15). En modo falso la correcta siempre es la opción 0."""

    preguntas: list[PreguntaQuiz] = Field(min_length=5, max_length=5)

    # Lo que se le pide al proveedor. Pydantic vuelve a validar la respuesta, por si no lo cumple.
    ESQUEMA_JSON: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "preguntas": {
                "type": "array",
                "minItems": 5,
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "properties": {
                        "enunciado": {"type": "string"},
                        "opciones": {
                            "type": "array",
                            "minItems": 4,
                            "maxItems": 4,
                            "items": {"type": "string"},
                        },
                        "correcta": {"type": "integer", "minimum": 0, "maximum": 3},
                    },
                    "required": ["enunciado", "opciones", "correcta"],
                },
            },
        },
        "required": ["preguntas"],
    }

    @classmethod
    def ejemplo_falso(cls) -> dict:
        return {
            "preguntas": [
                {
                    "enunciado": f"Pregunta de prueba {n}",
                    "opciones": ["Correcta", "Incorrecta A", "Incorrecta B", "Incorrecta C"],
                    "correcta": 0,
                }
                for n in range(1, 6)
            ],
        }


# ---------- Proveedor ----------

def _texto_de_la_respuesta(datos: dict) -> str:
    """El texto final está en el último paso `model_output` de la interacción."""
    pasos = [p for p in datos.get("steps") or [] if p.get("type") == "model_output"]
    if not pasos:
        raise IAnoDisponible("La IA no devolvió una respuesta")
    partes = [c["text"] for c in pasos[-1].get("content") or [] if c.get("text")]
    if not partes:
        raise IAnoDisponible("La IA no devolvió texto")
    return "".join(partes)


def _llamar_a_gemini(cuerpo: dict) -> str:
    if not config.IA_API_KEY:
        raise IAnoDisponible("Falta IA_API_KEY")
    # La clave va en un encabezado, no en la URL: así no aparece en ningún error ni log.
    # store=False: el proveedor no guarda la conversación (los apuntes son del estudiante).
    try:
        respuesta = httpx.post(
            URL_GEMINI,
            headers={"x-goog-api-key": config.IA_API_KEY},
            json={"model": config.IA_MODELO, "store": False, **cuerpo},
            timeout=TIEMPO_MAXIMO_SEG,
        )
    except httpx.HTTPError as e:
        raise IAnoDisponible("No se pudo contactar a la IA") from e
    if respuesta.status_code != 200:
        raise IAnoDisponible(f"La IA respondió {respuesta.status_code}")
    try:
        return _texto_de_la_respuesta(respuesta.json())
    except ValueError as e:
        raise IAnoDisponible("La IA respondió algo que no es JSON") from e


# ---------- Lo que usa el resto del backend ----------

def generar_texto(prompt: str, sistema: str) -> str:
    if config.IA_PROVEEDOR == "falso":
        return TEXTO_FALSO
    return _llamar_a_gemini({"system_instruction": sistema, "input": prompt})


def generar_json(prompt: str, sistema: str, esquema: type[BaseModel]) -> BaseModel:
    """Devuelve una instancia de `esquema`, que debe definir ESQUEMA_JSON y ejemplo_falso()."""
    if config.IA_PROVEEDOR == "falso":
        return esquema.model_validate(esquema.ejemplo_falso())
    texto = _llamar_a_gemini({
        "system_instruction": sistema,
        "input": prompt,
        "response_format": {"type": "text", "mime_type": "application/json", "schema": esquema.ESQUEMA_JSON},
    })
    try:
        return esquema.model_validate(json.loads(texto))
    except (ValueError, ValidationError):
        # Sin `from e`: el error de validación incluye la respuesta, que puede citar los apuntes
        raise IAnoDisponible("La IA respondió con un formato inválido") from None
