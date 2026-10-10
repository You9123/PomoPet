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

`public/mascotas/variantes.json` lista las variantes de cada especie con su nombre y un color de
muestra, para armar un selector. El componente `MascotaSprite` recibe la `variante` como propiedad
(por defecto `clasico`).

### Cómo se generan

Los PNG se generan por código, así que nunca se dibujan a mano 90 archivos:

```bash
cd frontend
npm run sprites:base        # dibuja el arte original (variante clasico)
npm run sprites:variantes   # recolorea el clasico y escribe las demás variantes + variantes.json
```

- **Cambiar un dibujo, agregar un estado o una especie:** se edita `tools/sprites-base.mjs` y se
  vuelven a correr los dos comandos.
- **Agregar o quitar una variante:** `tools/recolor.js` (`VARIANTES` define cada color y
  `POR_ESPECIE` cuáles tiene cada especie).
- El recoloreado solo toca el color principal de la especie; contorno, ojos, accesorios y efectos
  (cuernos del dragón, estrellas, libro, nube, zzz) se conservan. Funciona con cualquier sprite
  `clasico`, incluso uno dibujado a mano.
- El tamaño se ajusta a un **múltiplo entero** y se dibuja con `image-rendering: pixelated`.

### Falta decidir: ¿dónde se guarda la variante elegida?

Hoy cada usuario tiene solo la **especie**. Para que el usuario escoja un color hace falta guardarlo
(por ejemplo `mascotas.variante`, validado contra `variantes.json`), recibirlo en el registro y
devolverlo en `GET /api/me`. Eso toca la base de datos y la API, así que lo decide el equipo.

## Provisional

El número de materia se escribe a mano porque todavía no existe la API de materias (issue #4).
Cuando exista, reemplazar ese campo en `components/TemporizadorPomodoro.vue` por un selector.

## Pruebas

```bash
cd frontend
npm test        # node --test: lógica de tiempo, estados del store y recoloreado de sprites
```

Las pruebas del store simulan el paso del tiempo con `reloj.ahora` y una API falsa.
