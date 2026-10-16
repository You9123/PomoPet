# Bitácora de cambios

## [Sprint 2] - en curso (entrega: Semana 13)

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
