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
| DELETE | `/api/materias/{id}`    | Borra la materia con sus jefes, sesiones y pausas → `204`     | `404`                                                |

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
  mayúsculas ni espacios (índice `materias_nombre_unico`). Dos usuarios sí pueden tener el mismo nombre.
- **Color:** `#RRGGBB`. Por defecto `#888888`.
- **Horas semanales:** de 0 a 168, o `null`. En `PATCH` se puede enviar `null` para quitarlas.
- **El XP no se guarda** (3FN): `xp` es 100 × `pomodoros_completados`, igual que en `sesiones.md`.
- Una materia de otro usuario responde `404`, igual que una inexistente, para no revelar su existencia.
- **Borrar es definitivo:** también se borra el historial de sesiones de esa materia. El frontend debería pedir confirmación.

## Pantalla de materias (frontend, issue #24)

En `/materias` (menú **Materias**). Archivos: `stores/materias.js`, `components/PanelMaterias.vue` y
`views/MateriasView.vue`.

- **Lista** con color, pomodoros, minutos, XP y horas semanales de cada materia, y el contador `n/20`.
- **Crear:** nombre, color (se propone uno que no esté en uso) y horas por semana (vacío = sin horas).
  Con 20 materias el formulario se oculta y se explica el tope.
- **Editar:** el `PATCH` envía solo los campos que cambiaron; si no cambió nada, no llama a la API.
- **Borrar:** pide confirmación y avisa cuántas sesiones se pierden, además de los Jefes Finales.
  La materia del pomodoro en curso no se puede borrar: el botón se desactiva.
- **Errores:** se muestra el mensaje del backend (tope de 20, nombre repetido, sesión en curso).
- Al cerrar sesión se limpia la lista. Las pruebas están en `stores/materias.test.js` (`npm test`).
