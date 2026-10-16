# Materias (Issue #4)

Crear, listar, editar y borrar las materias del usuario, con un **máximo de 20 por usuario** (RF-02).
Cada materia incluye su progreso, calculado desde `v_progreso_materia`.

Todos los endpoints requieren `Authorization: Bearer <token>` (ver `autenticacion.md`).

## Endpoints

| Método | Ruta                    | Qué hace                                                      | Errores                                              |
| ------ | ----------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| GET    | `/api/materias`         | Las materias del usuario, de la más antigua a la más nueva    | —                                                    |
| POST   | `/api/materias`         | Crea una materia → `201`                                      | `409` ya tiene 20 o el nombre está repetido; `422` datos inválidos |
| GET    | `/api/materias/{id}`    | Una materia                                                   | `404` no existe o es de otro usuario                 |
| PATCH  | `/api/materias/{id}`    | Cambia solo los campos enviados                               | `404`; `409` nombre repetido; `422` datos inválidos  |
| DELETE | `/api/materias/{id}`    | Borra la materia con sus jefes, sesiones y pausas → `204`     | `404`; `409` tiene una sesión en curso               |

Para crear: `{"nombre": "Cálculo", "color": "#4F46E5", "horas_semanales": 6}`. Solo `nombre` es obligatorio.

```json
{
  "id": 1, "nombre": "Cálculo", "color": "#4F46E5", "horas_semanales": 6,
  "creado_en": "2026-10-10T15:00:00Z",
  "pomodoros_completados": 4, "pomodoros_cancelados": 1, "minutos_estudiados": 108,
  "xp": 400
}
```

## Reglas

- **Tope de 20 materias por usuario.** Se valida en dos lugares: el backend lo revisa antes de insertar
  (para dar un mensaje claro, `409`) y el trigger `materias_tope_20` de la BD es la red de seguridad.
  La petición bloquea la fila del usuario, así que dos peticiones simultáneas no pueden pasar ambas del tope.
  Borrar una materia libera un cupo.
- **Nombre:** 1 a 100 caracteres, sin espacios al inicio ni al final, y único por usuario sin importar
  mayúsculas, espacios ni tildes (índice `materias_nombre_unico`): "Calculo" choca con "Cálculo".
  La ñ sí cuenta ("Diseño" y "Diseno" son distintas). Dos usuarios sí pueden tener el mismo nombre.
- **Color:** `#RRGGBB`. Por defecto `#888888`.
- **Horas semanales:** de 0 a 168, o `null`. En `PATCH` se puede enviar `null` para quitarlas.
- **El XP no se guarda** (3FN): `xp` es `XP_POR_POMODORO` (100) × `pomodoros_completados`, igual que en `sesiones.md`.
- Una materia de otro usuario responde `404`, igual que una inexistente, para no revelar su existencia.
- **No se puede borrar una materia con una sesión en curso** (`409`): hay que terminarla o cancelarla antes.
  Así el temporizador del frontend no se queda corriendo sobre una sesión que ya no existe.
- **Borrar es definitivo:** también se borra el historial de sesiones de esa materia. El frontend debería pedir confirmación.
