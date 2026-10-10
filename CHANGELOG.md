# Bitácora de cambios

## [Sprint 2] - en curso (entrega: Semana 13)

### Agregado

- Modelo de datos relacional en PostgreSQL 16 (#1, PR #15): usuarios, mascotas y su catálogo de especies, materias, jefes finales, sesiones, pausas y logros.
- Reglas en la BD: tope de 20 materias por usuario (trigger), correo y nombre de materia únicos sin importar mayúsculas, una pausa abierta por sesión y Jefe de la misma materia que la sesión.
- Vistas `v_progreso_materia` y `v_estado_jefe`: el XP, los minutos estudiados (sin pausas) y el HP del Jefe se calculan, no se guardan (3FN).
- Datos iniciales: logros y especies de mascota (gato, perro, conejo).
- 18 pruebas de reglas del esquema (`database/tests/pruebas_reglas.sql`) y diagrama entidad-relación en `docs/modelo-datos.md`.
- Registro e inicio de sesión (#3): endpoints `/api/auth/registro`, `/api/auth/login`, `/api/especies` y `/api/me`; contraseñas con bcrypt y sesión con JWT (`docs/autenticacion.md`).
- Pruebas del backend contra PostgreSQL: el CI levanta un servicio postgres:16 y carga el esquema antes de `pytest`.

### Cambiado

- Se reorganizaron los issues #3 a #12 para reflejar el nuevo modelo (mascota, pausas y datos calculados) y se creó el #16 (pruebas de la BD en el CI).

### Notas

- Después de actualizar `develop` hay que recrear la BD: `docker compose down -v` y `docker compose up --build`.
- Agregar `JWT_SECRET` al `.env` de cada integrante (ver `.env.example`).

## [Sprint 1] - 2026-09-23

### Agregado

- Estructura inicial del repositorio (frontend, backend, database, docs).
- Docker Compose para backend y PostgreSQL.
- CI con pytest y build del frontend.
- Documento de Alcance del Sprint 1 en /docs.
