# Inteligencia artificial en PomoPet (RNF-10)

PomoPet usa IA para dos cosas: el **coach**, que da consejos con la voz de la mascota (RF-14), y el
**quiz contra el Jefe Final**, generado a partir de los apuntes del estudiante (RF-15, RF-16).

Las llamadas salen **solo del backend**. Todo pasa por `backend/app/ia.py`: ningún otro archivo habla
con el proveedor, así que cambiarlo solo toca ese módulo.

## Proveedor

Se eligió **Google Gemini**, con su plan gratuito, porque el proyecto no tiene presupuesto y una
demostración hace pocas solicitudes. Se usa la API de Interactions por REST (`POST /v1beta/interactions`),
con `httpx`, que ya estaba en el proyecto.

Los límites del plan gratuito cambian con el tiempo y dependen del proyecto de Google: se consultan en
[AI Studio](https://aistudio.google.com/rate-limit). Si se agota el cupo, la app sigue funcionando (ver abajo).

## Variables de entorno

| Variable | Para qué | Valor por defecto |
| --- | --- | --- |
| `IA_PROVEEDOR` | `gemini` o `falso` | `gemini` en el backend; `falso` en `docker compose` |
| `IA_API_KEY` | Clave de Google AI Studio. Nunca se sube al repositorio | vacía |
| `IA_MODELO` | Modelo de Gemini | `gemini-3.8-flash` |

- **Sin clave** el backend arranca igual: las funciones de IA informan que no están disponibles.
- **`IA_PROVEEDOR=falso`** responde siempre lo mismo, sin internet ni clave. Es el que usan `pytest`, el CI y las
  pruebas E2E. En su quiz la opción correcta siempre es la primera.

## Cómo usarlo desde el backend

```python
from app import ia

try:
    consejo = ia.generar_texto(prompt, sistema)
    quiz = ia.generar_json(prompt, sistema, ia.QuizGenerado)   # devuelve un QuizGenerado ya validado
except ia.IAnoDisponible:
    ...  # coach: consejo de respaldo. Quiz: 503 y no se crea
```

`IAnoDisponible` cubre todos los fallos: falta de clave, caída, cupo agotado, 15 segundos sin respuesta, o una
respuesta sin texto o que no cumple el esquema. Reintentar es decisión de quien llama.

## Privacidad

- Al proveedor solo se envía lo necesario: estadísticas y nombres de materias, o los apuntes del quiz. Nunca el correo
  ni otros datos de la cuenta.
- Las solicitudes van con `store: false`, para que la API de Interactions no guarde la conversación. Aun así, en el plan
  gratuito Google puede tener otras condiciones de uso de los datos: por eso la pantalla del quiz avisa que los apuntes
  se envían a un servicio externo y hay que evitar pegar datos personales.
- Ni la clave ni los apuntes aparecen en los logs: los errores de `ia.py` no incluyen la respuesta del proveedor.
- Lo que escribe el usuario se trata como datos, nunca como instrucciones para la IA.
