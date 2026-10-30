# Inteligencia artificial en PomoPet (RNF-10)

PomoPet usa IA para dos cosas: el **coach**, que da consejos con la voz de la mascota (RF-14), y el
**quiz contra el Jefe Final**, generado a partir de los apuntes del estudiante (RF-15, RF-16).

Las llamadas salen **solo del backend**. Todo pasa por `backend/app/ia.py`: ningún otro archivo habla
con el proveedor, así que cambiarlo solo toca ese módulo.

## Proveedor

Se eligió **Google Gemini**, con su plan gratuito, porque el proyecto no tiene presupuesto y una
demostración hace pocas solicitudes. Se usa la API de Interactions por REST (`POST /v1beta/interactions`),
con `httpx`, que ya estaba en el proyecto.

Se usa `gemini-3.5-flash-lite`: el 2026-10-30 respondió bien a texto y quiz, mientras `gemini-3.8-flash` daba `503` por alta demanda
o agotaba el tiempo de espera en todos los intentos. Se cambia con `IA_MODELO`, sin tocar código.

Los límites del plan gratuito cambian con el tiempo y dependen del proyecto de Google: se consultan en
[AI Studio](https://aistudio.google.com/rate-limit). Si se agota el cupo, la app sigue funcionando (ver abajo).

## Variables de entorno

| Variable | Para qué | Valor por defecto |
| --- | --- | --- |
| `IA_PROVEEDOR` | `gemini` o `falso` | `gemini` en el backend; `falso` en `docker compose` |
| `IA_API_KEY` | Clave de Google AI Studio. Nunca se sube al repositorio | vacía |
| `IA_MODELO` | Modelo de Gemini | `gemini-3.5-flash-lite` |

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

## Coach: el consejo de la mascota (RF-14, issue #39)

Código en `backend/app/routers/coach.py`; pruebas en `backend/tests/test_coach.py`. Ambos endpoints exigen token.

| Método | Ruta                 | Qué hace                                                        | Errores                        |
| ------ | -------------------- | --------------------------------------------------------------- | ------------------------------ |
| GET    | `/api/coach/consejo` | El último consejo guardado y cuántos quedan hoy                 | `422` zona desconocida         |
| POST   | `/api/coach/consejo` | Pide un consejo nuevo a la IA y lo guarda en `consejos_ia`      | `429` ya pidió 3 hoy; `422` zona |

Los dos responden lo mismo:

```json
{ "texto": "¡Ya llevas 4 pomodoros! ...", "origen": "ia", "creado_en": "2026-10-30T15:20:00Z", "restantes": 2 }
```

- `texto` es `null` (con `origen` y `creado_en` en `null`) si el usuario todavía no tiene consejos.
- **Máximo 3 por día**, contados en `consejos_ia` desde la medianoche en la hora local del usuario. Como en las
  estadísticas, acepta `?zona=` (IANA) y por defecto usa `America/Costa_Rica`.
- **Si la IA falla**, responde `200` con un consejo fijo armado con sus datos y `"origen": "respaldo"`: no se guarda
  ni gasta cupo, así que puede volver a pedir cuando la IA responda.
- **Usuario sin sesiones:** se le pide a la IA un consejo de bienvenida (y el respaldo también es una bienvenida).
- **Lo que se envía:** las mismas estadísticas del panel (`calcular_estadisticas` de `routers/estadisticas.py`):
  totales, cada materia con sus pomodoros, minutos y rango, los minutos de los últimos 7 días, y el nombre y la
  especie de la mascota. Nunca el correo ni otros datos de la cuenta.
- **El prompt:** la mascota habla en primera persona, en español y con un tono cálido y animador: primero celebra lo
  que el estudiante ya logró y luego sugiere un paso pequeño; nunca regaña. Los datos van en JSON entre `<datos>` y
  `</datos>`, sin `<` ni `>` literales, así que un nombre de materia no puede cerrar el bloque ni dar instrucciones.
- **La respuesta** se deja en una sola línea, sin comillas alrededor y en un máximo de 280 caracteres (se corta en un
  espacio y termina en «…»).

## Quiz contra el Jefe Final (RF-15, RF-16, issue #40)

Código en `backend/app/routers/quiz.py`; pruebas en `backend/tests/test_quiz.py`. Todos exigen token.

| Método | Ruta                                  | Qué hace                                             | Errores |
| ------ | ------------------------------------- | ---------------------------------------------------- | ------- |
| POST   | `/api/sesiones/{id}/quiz`             | Crea el quiz con `{"apuntes": "..."}` → `201`        | `404`, `409`, `422`, `503` |
| GET    | `/api/sesiones/{id}/quiz`             | El quiz, para retomarlo al recargar                  | `404` sesión ajena o sin quiz |
| POST   | `/api/sesiones/{id}/quiz/respuestas`  | Corrige `{"respuestas": [0, 1, 2, 3, 0]}` una vez    | `404`, `409`, `422` |

Crear y ver responden `{ "preguntas": [{ "enunciado": "...", "opciones": ["", "", "", ""] }], "respondido": false }`.
Corregir responde `{ "aciertos": 4, "correctas": [0, 1, 2, 0, 0], "dano_extra": true, "jefe": { ... } }`, con el jefe
ya actualizado (ver `jefes.md`).

- **Cuándo se puede:** una vez por cada sesión `completada` contra un Jefe que no esté derrotado. Si no, `409`:
  sesión en curso o cancelada, sin Jefe, Jefe derrotado, o ya tiene quiz. Corregir un quiz ya respondido también
  da `409`. Una sesión ajena o inexistente da `404`.
- **Apuntes:** entre 200 y 8000 caracteres sin contar los espacios de los bordes (si no, `422`). Solo se envían a
  la IA: **no se guardan** en la BD ni se escriben en ningún log.
- **La respuesta correcta nunca viaja al cliente antes de corregir:** crear y ver devuelven solo el enunciado y
  las opciones. Las correctas quedan en `quiz_preguntas` y salen únicamente en la respuesta de corregir.
- **Validación:** `QuizGenerado` exige 5 preguntas, 4 opciones y un índice correcto de 0 a 3; además se rechazan
  enunciados u opciones vacías y opciones repetidas. Si la respuesta falla o no sirve, se **reintenta una vez**.
  Si sigue fallando, `503` y **no se crea el quiz**, así que se puede volver a pedir con los mismos apuntes.
- **Apuntes como datos:** van entre `<apuntes>` y `</apuntes>`, y una etiqueta `</apuntes>` escrita dentro se
  quita para que no cierre el bloque. El prompt le dice a la IA que ignore cualquier instrucción de los apuntes.
- **Daño extra:** con **4 o más aciertos** el Jefe pierde 1 HP extra (`dano_extra: true`). No se guarda: lo calcula
  la vista `v_estado_jefe` con la columna `dano_quiz`. **El quiz no da XP.**
- En modo falso el quiz siempre es el mismo y la correcta es la opción 0: `[0, 0, 0, 0, 1]` da 4 aciertos.

## Privacidad

- Al proveedor solo se envía lo necesario: estadísticas y nombres de materias, o los apuntes del quiz. Nunca el correo
  ni otros datos de la cuenta.
- Las solicitudes van con `store: false`, para que la API de Interactions no guarde la conversación. Aun así, en el plan
  gratuito Google puede tener otras condiciones de uso de los datos: por eso la pantalla del quiz avisa que los apuntes
  se envían a un servicio externo y hay que evitar pegar datos personales.
- Ni la clave ni los apuntes aparecen en los logs: los errores de `ia.py` no incluyen la respuesta del proveedor.
- Lo que escribe el usuario se trata como datos, nunca como instrucciones para la IA.
