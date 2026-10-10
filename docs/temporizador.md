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
- **Mascotas (pixel art):** una tira horizontal PNG por estado y variante de color en
  `public/mascotas/<especie>/<variante>/<estado>.png` (gato, perro, dragon). Ver más abajo.
  Para agregar una especie, crear su carpeta con los 5 archivos.

## Mascotas: sprites y variantes de color

Cada mascota es pixel art animado: una **tira horizontal PNG por estado**, de cuadros cuadrados
(32 x 32, 4 cuadros), en:

```
frontend/public/mascotas/<especie>/<variante>/<estado>.png
                         dragon    clasico     estudiando.png
```

- **Especies:** `gato`, `perro`, `dragon` (el `codigo` de `especies_mascota`).
- **Estados (5 archivos):** `inactivo`, `estudiando`, `exito`, `cancelado`, `descanso`.
  `pausado` reutiliza `estudiando`, congelado.
- **Variantes:** `clasico` es el arte original; las demás son recoloreos automáticos.

| Especie | Variantes |
| --- | --- |
| gato | clasico (naranja), ceniza, sombra, nieve, rosa, celeste |
| perro | clasico (café), ceniza, sombra, nieve, dorado, celeste |
| dragon | clasico (verde), fuego, hielo, violeta, sombra, nieve |

La lista de colores de cada especie vive en la base de datos (`variantes_mascota`) y la API la
entrega en `GET /api/especies`, que es lo que usa el selector del registro. El componente
`MascotaSprite` recibe la `variante` como propiedad (por defecto `clasico`).

### Cómo se generan

Los PNG se generan por código, así que nunca se dibujan a mano 90 archivos:

```bash
cd frontend
npm run sprites:base        # dibuja el arte original (variante clasico)
npm run sprites:variantes   # recolorea el clasico, escribe las demás variantes y database/init/04_variantes.sql
```

- **Cambiar un dibujo, agregar un estado o una especie:** se edita `tools/sprites-base.mjs` y se
  vuelven a correr los dos comandos.
- **Agregar o quitar una variante:** `tools/recolor.js` (`VARIANTES` define cada color y
  `POR_ESPECIE` cuáles tiene cada especie).
- El recoloreado solo toca el color principal de la especie; contorno, ojos, accesorios y efectos
  (cuernos del dragón, estrellas, libro, nube, zzz) se conservan. Funciona con cualquier sprite
  `clasico`, incluso uno dibujado a mano.
- El tamaño se ajusta a un **múltiplo entero** y se dibuja con `image-rendering: pixelated`.

### Elección del color

- **Registro:** después de elegir la especie aparece "Elige su color" con una muestra por variante.
  Al cambiar de especie se vuelve al `clasico`, y la mascota de la tarjeta se ve con el color elegido.
- **API:** `POST /api/auth/registro` recibe `variante` (opcional, por defecto `clasico`). Si el color no
  existe para esa especie responde `422` y no se crea el usuario. `GET /api/me` devuelve
  `mascota.variante` y `mascota.variante_nombre`.
- **Base de datos:** `mascotas.variante`, con llave foránea compuesta `(especie_id, variante)` hacia
  `variantes_mascota`, así que un gato no puede tener un color de dragón.
- **Agregar o quitar un color:** editar `tools/recolor.js`, correr `npm run sprites:variantes` y
  recrear la base de datos (`docker compose down -v` y `up -d --build`).
- Todavía **no se puede cambiar el color después de registrarse**; sería un `PATCH` a la mascota.

## Provisional

El número de materia se escribe a mano porque todavía no existe la API de materias (issue #4).
Cuando exista, reemplazar ese campo en `components/TemporizadorPomodoro.vue` por un selector.

## Pruebas

```bash
cd frontend
npm test        # node --test: lógica de tiempo, estados del store y recoloreado de sprites
```

Las pruebas del store simulan el paso del tiempo con `reloj.ahora` y una API falsa.
