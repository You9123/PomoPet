# Temporizador Pomodoro (Issue #6)

Pantalla principal del frontend: mascota, reloj de 25 minutos, pausa, cancelación y descansos.
Usa los endpoints de `docs/sesiones.md` y de `docs/autenticacion.md`.

## Cómo calcula el tiempo (RNF-07)

El reloj **no cuenta ticks**. Cada respuesta de la API trae `segundos_efectivos`; con eso se calcula
`finMs`, la marca de tiempo local en la que termina el pomodoro, y en pantalla se muestra
`finMs − ahora`. Un `setInterval` solo repinta (cada 250 ms) y al volver a la pestaña se recalcula al
instante con `visibilitychange`. Si la pestaña se duerme 10 minutos, al volver se ven 10 minutos menos.

El servidor sigue siendo quien valida los 25 minutos efectivos (RF-09). Al llegar a 0 el frontend pide
`finalizar`; si el servidor responde `409` por unos milisegundos de latencia, reintenta.

## Estados

```
inactivo → estudiando ⇄ pausado → exito → descanso → inactivo
                │
                └→ cancelado → inactivo
```

| Fase | Imagen de la mascota | Cómo se sale |
| --- | --- | --- |
| `inactivo` | `inactivo.svg` | Botón **Iniciar** |
| `estudiando` | `estudiando.svg` | **Pausar**, **Cancelar** o llegar a 0 |
| `pausado` | `estudiando.svg` (atenuada) | **Reanudar** o **Cancelar** |
| `exito` | `exito.svg` | Automático a los 4 s |
| `descanso` | `descanso.svg` | Termina solo o **Saltar descanso** |
| `cancelado` | `cancelado.svg` | **Volver a empezar** |

- **Descansos (RF-10):** corto de 5 min; tras 4 pomodoros seguidos, largo con `descanso_largo_min`
  del usuario (15 a 30). Cancelar rompe la racha. Son locales: no se guardan en la API.
- **Recargar la página:** `GET /api/sesiones/actual` retoma la sesión en curso, con su pausa.
- **Imágenes:** `public/mascotas/<codigo-de-la-especie>/<estado>.svg` (gato, perro, conejo).
  Para agregar una especie, crear su carpeta con los 5 archivos.

## Provisional

El número de materia se escribe a mano porque todavía no existe la API de materias (issue #4).
Cuando exista, reemplazar ese campo en `components/TemporizadorPomodoro.vue` por un selector.

## Pruebas

```bash
cd frontend
npm test        # node --test: lógica de tiempo y estados del store, sin navegador
```

Las pruebas del store simulan el paso del tiempo con `reloj.ahora` y una API falsa.
