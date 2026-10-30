# Bitácora de cambios

## [Inteligencia artificial] - sin publicar

Requisito agregado por el profesor después de cerrar el Release Final.

### Agregado

- Requerimientos nuevos en el documento de alcance (#44): RF-14 (coach de la mascota), RF-15 (quiz con IA), RF-16 (daño extra al Jefe) y RNF-10 (la IA solo desde el backend).
- Tablas del coach y del quiz (#38): `consejos_ia`, `quizzes` (uno por sesión, aciertos de 0 a 5) y `quiz_preguntas` (4 opciones y el índice de la correcta). Los apuntes no se guardan. Pruebas 24 a 27 en `pruebas_reglas.sql` y migración `003_ia_consejos_quiz.sql` para la BD de producción.
- API del coach (#39, RF-14): `GET` y `POST /api/coach/consejo`. La mascota da un consejo animador a partir de las estadísticas del panel (sin correo ni datos de la cuenta), con un máximo de 3 por día (`429`) y un consejo de respaldo que no gasta cupo si la IA falla (`docs/ia.md`). Pruebas en `backend/tests/test_coach.py`; `pytest` usa siempre `IA_PROVEEDOR=falso`.
- API del quiz contra el Jefe Final (#40, RF-15, RF-16): `POST` y `GET /api/sesiones/{id}/quiz` y `POST /api/sesiones/{id}/quiz/respuestas`. La IA crea 5 preguntas con los apuntes (que no se guardan), se valida la respuesta y se reintenta una vez (`503` si sigue fallando, sin crear el quiz). La respuesta correcta solo sale al corregir; con 4 o más aciertos el Jefe pierde 1 HP extra y no se da XP. `JefeOut` agrega `dano_quiz`. Pruebas en `backend/tests/test_quiz.py`.
- Pruebas E2E del coach y del quiz (#43): `frontend/e2e/coach.spec.js` (pedir un consejo, verlo en el globo y que el contador baje de 3 a 0) y `frontend/e2e/quiz.spec.js` (con 4 aciertos el jefe pierde 1 HP extra y el XP sigue en 100; con 3 no hay daño extra). El job `integration-tests` usa `IA_PROVEEDOR=falso` sin clave. El README explica cómo correrlas y cómo probar a mano con la IA real.

### Cambiado

- RF-06 y RF-12 admiten el daño extra del quiz; antes el HP bajaba solo con pomodoros.
- `v_estado_jefe` resta 1 HP por cada quiz con 4 o más aciertos y agrega la columna `dano_quiz` al final; `pomodoros_recibidos` no cambia (#38).
- El cálculo de las estadísticas pasa a `calcular_estadisticas()` para que el coach use las mismas consultas (#39). `GET /api/estadisticas` responde igual.

### Corregido

- En **Materias**, el nombre que se escribía mientras cargaba la lista se borraba al terminar la carga (#43). Ahora solo se propone el color.

### Notas

- El esquema agrega las tablas del coach y del quiz (#38): recrear la BD local con `docker compose down -v` y `docker compose up --build`. En producción, correr `database/migraciones/003_ia_consejos_quiz.sql` antes de desplegar el backend.

## [Release Final] - 2026-10-30

### Agregado

- Niveles, rangos y evolución de la mascota (#8, RF-04): `backend/app/gamificacion.py` calcula el nivel (uno cada 200 XP), el rango de cada materia (Novato, Estudiante Promedio, Casi Bachiller, Maestro) y la etapa de la mascota según el XP total (Cría, Joven, Adulta, Legendaria). Nada se guarda en la BD. Umbrales en `docs/gamificacion.md`.
- `GET /api/materias` y `/api/materias/{id}` devuelven `nivel` y `rango`; `GET /api/me` devuelve `xp_total`, `nivel` y `etapa` de la mascota.
- La pantalla de materias muestra el rango y el nivel de cada una, y el temporizador muestra la etapa y el nivel de la mascota (se actualizan al completar un pomodoro).
- Sprites por etapa de evolución: cada mascota tiene un dibujo muy distinto por etapa: cría (diminuta, dentro de un cascarón), joven (el de siempre), adulta (capa roja y bufanda que ondea) y legendaria (alas, corona con gemas, capa real y contorno dorado), en todos sus colores: 360 sprites generados por código. Los PNG pasaron a `public/mascotas/<especie>/<variante>/<etapa>/<estado>.png`; el registro muestra a las mascotas como cría. Prueba nueva: `frontend/tools/sprites.test.js`.
- Modo Jefe Final (#9): `GET/POST /api/materias/{id}/jefes` y `GET/DELETE /api/jefes/{id}`; el HP sale de `v_estado_jefe`. En el temporizador se elige o crea el jefe y se muestra su barra de vida (`docs/jefes.md`).
- Panel de estadísticas (#11, RF-08): `GET /api/estadisticas` (resumen, XP y minutos por materia, minutos por día en la hora local del usuario) y `GET /api/estadisticas/historial` (sesiones completadas y canceladas, paginadas y filtrables), con SQL directo. Vista nueva `v_historial_sesiones` (tiempo efectivo de cada sesión terminada) y migración `002_vista_historial_sesiones.sql` para la BD de Render. Prueba 23 en `pruebas_reglas.sql` y `backend/tests/test_estadisticas.py`.
- Pantalla de estadísticas en `/estadisticas` (menú **Progreso**): tarjetas de resumen, gráfico de barras apiladas por materia con Chart.js (`vue-chartjs`) para 7 o 30 días, e historial con filtro y páginas (`docs/estadisticas.md`).
- Pruebas de los bordes de cada umbral en `backend/tests/test_niveles.py`.
- Reproductor de audio ambiental (#10, RF-07): en la pantalla Pomodoro se elige lluvia, Lo-Fi o ruido blanco, con reproducir, pausar y volumen; la pista y el volumen se recuerdan en el navegador. Las pistas se generan por código (`npm run audio`), son obra propia y se publican como CC0 (`docs/audio.md`).
- Pruebas de integración entre las tres capas (#12): Playwright recorre la app en un Chrome real contra el backend y la BD de `docker compose`. `frontend/e2e/flujo-completo.spec.js` (registro con mascota → materia → pomodoro con pausa → XP en estadísticas) y `frontend/e2e/cancelar.spec.js` (sesión cancelada sin XP). Se corren con `npm run test:e2e` y en el CI (job `integration-tests`). Ver el README.

### Notas

- El esquema agrega la vista `v_historial_sesiones` (#11): recrear la BD local con `docker compose down -v` y `docker compose up --build`. En Render, correr `database/migraciones/002_vista_historial_sesiones.sql`.

## [Sprint 2] - 2026-10-21

### Agregado

- Modelo de datos relacional en PostgreSQL 16 (#1, PR #15): usuarios, mascotas y su catálogo de especies, materias, jefes finales, sesiones, pausas y logros.
- Reglas en la BD: tope de 20 materias por usuario (trigger), correo y nombre de materia únicos sin importar mayúsculas, una pausa abierta por sesión y Jefe de la misma materia que la sesión.
- Vistas `v_progreso_materia` y `v_estado_jefe`: el XP, los minutos estudiados (sin pausas) y el HP del Jefe se calculan, no se guardan (3FN).
- Datos iniciales: logros y especies de mascota (gato, perro, dragón).
- 18 pruebas de reglas del esquema (`database/tests/pruebas_reglas.sql`) y diagrama entidad-relación en `docs/modelo-datos.md`.
- Registro e inicio de sesión (#3): endpoints `/api/auth/registro`, `/api/auth/login`, `/api/especies` y `/api/me`; contraseñas con bcrypt y sesión con JWT (`docs/autenticacion.md`).
- Pruebas del backend contra PostgreSQL: el CI levanta un servicio postgres:16 y carga el esquema antes de `pytest`.
- Sesiones Pomodoro (#5): endpoints para iniciar, pausar, reanudar, finalizar y cancelar (`docs/sesiones.md`). El servidor valida 25 minutos efectivos (sin pausas) antes de dar XP y solo permite una sesión en curso por usuario.
- Temporizador Pomodoro en Vue (#6): reloj basado en marcas de tiempo, pausa y reanudar, descansos corto y largo, mascota en pixel art animada por estados (gato, perro, dragón), registro e ingreso, y `GET /api/sesiones/actual` para retomar la sesión al recargar (`docs/temporizador.md`).
- Variantes de color de las mascotas: 5 por especie además del `clasico` (75 sprites), generadas con `npm run sprites:variantes`. El dibujo base también se genera por código (`npm run sprites:base`).
- Selector de color de la mascota en el registro: tabla `variantes_mascota` y `mascotas.variante` (con llave foránea compuesta a la especie), `variante` en `POST /api/auth/registro`, colores en `GET /api/especies` y `variante` en `GET /api/me`. 2 reglas nuevas en `pruebas_reglas.sql` (20 en total).
- API de materias (#4): `GET/POST /api/materias`, `GET/PATCH/DELETE /api/materias/{id}` con el progreso de cada una y tope de 20 por usuario validado en el backend además del trigger de la BD (`docs/materias.md`).
- Pantalla de materias (#24): en `/materias` se crean, editan y borran las materias (con confirmación que avisa qué se pierde) y el temporizador usa un selector de materias en lugar del número escrito a mano. Menú para cambiar entre Pomodoro y Materias.
- Pruebas de la lógica de gamificación (#7): bordes del XP (24:59 vs 25:00 con y sin pausas), tope de materias (20 sí, 21 no), daño al Jefe Final y progreso por materia (`backend/tests/test_gamificacion.py`). Niveles, rangos y etapas de evolución de la mascota quedan pendientes hasta que existan.
- CI: nuevo job `database-tests` que carga `database/init/*.sql` en un postgres:16 y ejecuta `database/tests/pruebas_reglas.sql`; falla si una regla del esquema se rompe (#16).
- Entorno (#2): el backend espera a que PostgreSQL esté listo (healthcheck en `docker-compose.yml`) y el README trae requisitos, pasos para Windows y Mac, pruebas, solución de problemas y checklist por integrante.

### Cambiado

- El nombre de materia repetido ignora también las tildes: "Calculo" choca con "Cálculo", pero la ñ sí cuenta (#26). Hay que recrear la BD local (`docker compose down -v`); para una BD con datos, como la de Render, está `database/migraciones/001_materias_nombre_sin_tildes.sql`.
- Se reorganizaron los issues #3 a #12 para reflejar el nuevo modelo (mascota, pausas y datos calculados) y se creó el #16 (pruebas de la BD en el CI).

### Corregido

- `DELETE /api/materias/{id}` responde `409` si la materia tiene una sesión en curso, en lugar de borrarla sin avisar (el temporizador recibía un 404 al terminar). El XP de las materias usa `XP_POR_POMODORO` en vez de un 100 fijo.

### Notas

- Después de actualizar `develop` hay que recrear la BD: `docker compose down -v` y `docker compose up --build` (el esquema ahora incluye `variantes_mascota`).
- Agregar `JWT_SECRET` al `.env` de cada integrante (ver `.env.example`).

## [Sprint 1] - 2026-09-23

### Agregado

- Estructura inicial del repositorio (frontend, backend, database, docs).
- Docker Compose para backend y PostgreSQL.
- CI con pytest y build del frontend.
- Documento de Alcance del Sprint 1 en /docs.
