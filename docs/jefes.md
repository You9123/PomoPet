# Modo Jefe Final (Issue #9)

Convierte la preparación de un examen en una batalla: el Jefe Final de una materia tiene HP medido en
**pomodoros** (RF-12) y cada pomodoro completado contra él le quita **1 HP** (RF-06).

Todos los endpoints requieren `Authorization: Bearer <token>` (ver `autenticacion.md`).

## Endpoints

| Método | Ruta                          | Qué hace                                                    | Errores                              |
| ------ | ----------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| GET    | `/api/materias/{id}/jefes`    | Los jefes de la materia con su HP actual                    | `404` materia ajena o inexistente    |
| POST   | `/api/materias/{id}/jefes`    | Crea un jefe → `201`                                        | `404` materia; `422` datos inválidos |
| GET    | `/api/jefes/{id}`             | Un jefe                                                     | `404`                                |
| DELETE | `/api/jefes/{id}`             | Borra el jefe; sus sesiones se conservan sin jefe → `204`   | `404`                                |

Para crear: `{"nombre": "Parcial final", "hp_total": 10, "fecha_limite": "2026-12-01"}`. `fecha_limite` es opcional.

```json
{
  "id": 1, "materia_id": 3, "nombre": "Parcial final", "hp_total": 10,
  "hp_actual": 7, "pomodoros_recibidos": 3, "derrotado": false, "fecha_limite": "2026-12-01"
}
```

## Reglas

- **El HP no se guarda** (3FN): `hp_actual`, `pomodoros_recibidos` y `derrotado` salen de la vista `v_estado_jefe`.
  Solo cuentan las sesiones `completada` con ese `jefe_id`; las canceladas o en curso no hacen daño.
- **Misma materia:** `POST /api/sesiones` con `jefe_id` de otra materia responde `404`
  (y la BD lo impide con una llave foránea compuesta).
- **Jefe derrotado:** no se puede iniciar un pomodoro contra él (`409`).
- **Interfaz:** en el temporizador se elige o crea el jefe de la materia; su barra de vida
  (`JefeBarraVida.vue`) baja al terminar cada pomodoro.
- **Pruebas:** `backend/tests/test_jefes.py` (API) y `backend/tests/test_gamificacion.py` (cálculo del daño en la vista).
