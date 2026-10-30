# Reproductor de audio ambiental (Issue #10)

Sonidos de fondo para acompañar las sesiones de estudio (RF-07). Está en la pantalla **Pomodoro**,
debajo del temporizador.

## Qué hace

| Control | Qué hace |
| --- | --- |
| **Lluvia / Lo-Fi / Ruido blanco** | Elige la pista. Si ya sonaba algo, la nueva empieza enseguida |
| **▶ Reproducir / ❚❚ Pausar** | Reproduce o pausa. Al volver a reproducir sigue donde iba |
| **Volumen** | De 0 a 100 %, se aplica al instante |

- Cada pista se repite en bucle sin cortes.
- La pista elegida y el volumen se recuerdan en el navegador (`localStorage`, clave `pomopet.audio`).
  Nunca empieza a sonar solo al cargar la página: los navegadores lo bloquean y molestaría.
- El sonido es **independiente del temporizador**: sigue sonando al pausar el pomodoro o ir a
  **Materias**, y se apaga al cerrar sesión (o si vence la sesión).
- El audio no se descarga hasta que se pulsa **Reproducir** la primera vez.

## Código

| Archivo | Para qué |
| --- | --- |
| `frontend/src/stores/audio.js` | Store de Pinia: pistas, reproducir, pausar, volumen y preferencias |
| `frontend/src/components/ReproductorAmbiental.vue` | Los controles en pantalla |
| `frontend/tools/sintesis.js` | Genera las pistas por código (filtros, bucles, instrumentos) |
| `frontend/tools/audio-ambiental.mjs` | Escribe los WAV: `npm run audio` |
| `frontend/public/audio/<pista>.wav` | Las pistas generadas |

Pruebas: `frontend/src/stores/audio.test.js` (controles) y `frontend/tools/audio.test.js` (los WAV
existen, suenan a un volumen parecido, no saturan, repiten sin saltos y cada pista suena distinta).

## Las pistas

| Archivo | Duración del bucle | Cómo se hace |
| --- | --- | --- |
| `lluvia.wav` | 20 s | Ruido filtrado que sube y baja como ráfagas, más unas 1400 gotas sueltas (senos cortos que se apagan rápido) |
| `lofi.wav` | 24 s (8 compases a 80 BPM) | Piano eléctrico con progresión ii-V-I (Dm9, G13, Cmaj9, Am9…), bajo, batería con swing, una melodía corta y crujido de vinilo, con filtro "cálido" |
| `ruido-blanco.wav` | 10 s | Ruido gaussiano: todas las frecuencias por igual |

Son WAV mono de 16 bits a 22 050 Hz (unos 2,3 MB entre las tres). La síntesis usa una semilla fija,
así que `npm run audio` da siempre el mismo resultado. Para cambiar una pista: editar
`tools/sintesis.js`, correr `npm run audio` y subir los WAV nuevos.

## Licencia de los audios

Las tres pistas son **obra original del equipo de PomoPet**: se generan íntegramente por código
(`frontend/tools/sintesis.js`) y no usan grabaciones, muestras (samples) ni música de terceros.
Por eso no hay derechos de terceros que pagar ni atribuciones que dar.

Se publican bajo **CC0 1.0 Universal (dominio público)**:
<https://creativecommons.org/publicdomain/zero/1.0/deed.es>. Cualquiera puede copiarlas,
modificarlas y usarlas, incluso con fines comerciales, sin pedir permiso.

Si en el futuro se agrega un audio de otra fuente, debe ser libre de derechos (por ejemplo CC0 o
CC BY) y anotarse en una tabla aquí con: archivo, autor, URL de origen y licencia.
