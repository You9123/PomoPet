# Modelo de datos — PomoPet

Esquema en `database/init/01_schema.sql` (PostgreSQL 16).
Issue relacionado: #1 · Requerimientos: RF-02, RF-11, RF-12, RNF-03, RNF-05

## Diagrama entidad-relación

```mermaid
erDiagram
    usuarios ||--o{ materias : "tiene (max 20)"
    usuarios ||--o{ logros_usuario : "desbloquea"
    logros ||--o{ logros_usuario : "es otorgado en"
    materias ||--o{ jefes_finales : "enfrenta"
    materias ||--o{ sesiones : "registra"
    jefes_finales |o--o{ sesiones : "recibe dano de"

    usuarios {
        serial id PK
        varchar correo UK "unico sin mayusculas"
        varchar password_hash "bcrypt o Argon2"
        timestamptz creado_en
    }
    materias {
        serial id PK
        int usuario_id FK
        varchar nombre "unico por usuario"
        char color "#RRGGBB"
        smallint horas_semanales "0 a 168"
        timestamptz creado_en
    }
    jefes_finales {
        serial id PK
        int materia_id FK
        varchar nombre
        int hp_total "en pomodoros"
        int hp_actual "0 a hp_total"
        date fecha_limite
        boolean derrotado "generada: hp_actual = 0"
        timestamptz creado_en
    }
    sesiones {
        serial id PK
        int materia_id FK
        int jefe_id FK "opcional, misma materia"
        timestamptz inicio "lo fija el servidor"
        timestamptz fin
        varchar estado "en_curso, completada, cancelada"
        int xp_otorgado "0 si no esta completada"
    }
    logros {
        serial id PK
        varchar codigo UK
        varchar nombre
        text descripcion
    }
    logros_usuario {
        int usuario_id PK, FK
        int logro_id PK, FK
        timestamptz obtenido_en
    }
```

## Reglas que garantiza la base de datos

| Regla                                             | Cómo se implementa                                 | Req.   |
| ------------------------------------------------- | -------------------------------------------------- | ------ |
| Máximo 20 materias por usuario                    | Trigger `materias_tope_20`                         | RF-02  |
| Contraseña nunca en texto plano                   | Solo existe la columna `password_hash`             | RNF-05 |
| Correo único sin importar mayúsculas              | Índice único sobre `LOWER(correo)`                 | RF-13  |
| Sesión cancelada no da XP                         | `CHECK (estado = 'completada' OR xp_otorgado = 0)` | RF-11  |
| Una sesión en curso no tiene `fin`                | `CHECK ((estado = 'en_curso') = (fin IS NULL))`    | RF-01  |
| El Jefe pertenece a la misma materia de la sesión | Llave foránea compuesta `(jefe_id, materia_id)`    | RF-06  |
| El Jefe queda derrotado al llegar a HP 0          | Columna generada `derrotado`                       | RF-12  |
| Un logro se obtiene una sola vez por usuario      | Llave primaria `(usuario_id, logro_id)`            | —      |

## XP y progreso

El XP **no se guarda en `materias`**: se calcula sumando `sesiones.xp_otorgado`
con la vista `v_progreso_materia`, para que exista una sola fuente de verdad.

```sql
SELECT * FROM v_progreso_materia WHERE usuario_id = 1;
```

Devuelve por materia: `xp_total`, `pomodoros_completados`,
`pomodoros_cancelados` y `minutos_estudiados`.

## Si cambia el esquema

PostgreSQL solo ejecuta `database/init/` cuando el volumen está vacío.
Después de traer cambios del esquema hay que recrearlo (**borra los datos locales**):

```bash
docker compose down -v
docker compose up --build
```
