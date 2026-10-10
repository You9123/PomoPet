# Sesiones Pomodoro (Issue #5)

Iniciar, pausar, reanudar, finalizar y cancelar un pomodoro. **El servidor decide cuánto
tiempo pasó** (RF-09): el cliente nunca envía horas, solo pide la acción.

Todos los endpoints requieren `Authorization: Bearer <token>` (ver `autenticacion.md`).

## Endpoints

| Método | Ruta                            | Qué hace                                                           | Errores                                    |
| ------ | ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| POST   | `/api/sesiones`                 | Inicia una sesión: `{"materia_id": 1, "jefe_id": null}` → `201`    | `404` materia o jefe; `409` ya hay una en curso o jefe derrotado |
| GET    | `/api/sesiones/actual`          | La sesión en curso del usuario, o `null` (para retomar el temporizador al recargar) | —                                          |
| POST   | `/api/sesiones/{id}/pausar`     | Abre una pausa (RF-01)                                             | `409` ya está en pausa o ya terminó        |
| POST   | `/api/sesiones/{id}/reanudar`   | Cierra la pausa abierta                                            | `409` no está en pausa o ya terminó        |
| POST   | `/api/sesiones/{id}/finalizar`  | Completa la sesión si hay 25 min efectivos o más (RF-03, RF-09)    | `409` faltan minutos (sigue en curso)      |
| POST   | `/api/sesiones/{id}/cancelar`   | Cancela: queda en el historial y no da XP (RF-11)                  | `409` ya terminó                           |

Los cuatro últimos devuelven la sesión; si no es del usuario del token responden `404`.

```json
{
  "id": 7, "materia_id": 1, "jefe_id": null, "estado": "completada",
  "inicio": "2026-10-10T15:00:00Z", "fin": "2026-10-10T15:27:10Z",
  "pausada": false, "segundos_pausados": 120, "segundos_efectivos": 1510,
  "xp_otorgado": 100
}
```

## Reglas

- **Tiempo efectivo** = `fin − inicio − tiempo en pausa`. Se necesitan **25:00 o más**; con 24:59 se rechaza
  (`app/pomodoro.py`, funciones `tiempo_efectivo` y `xp_por_sesion`).
- **Una sola sesión en curso por usuario**, aunque sean de materias distintas. Se valida en el backend
  y la petición bloquea la fila del usuario para que dos peticiones simultáneas no creen dos sesiones.
- **Finalizar rechazado no escribe nada:** la sesión sigue en curso y, si estaba en pausa, sigue en pausa.
  Al completar o cancelar, la pausa abierta se cierra.
- **El XP no se guarda** (3FN): `xp_otorgado` es 100 solo en sesiones completadas y se calcula con la
  regla de arriba. El XP de una materia es 100 × `pomodoros_completados` de `v_progreso_materia`.
- Un Jefe ya derrotado (`v_estado_jefe.derrotado`) no se puede atacar. Su HP baja solo, porque la vista
  cuenta las sesiones completadas asociadas a él.

## Probar a mano

En http://localhost:8000/docs: registrarse → **Authorize** con el token → `POST /api/sesiones`.
Para no esperar 25 minutos, en la BD se puede retrasar el inicio de la sesión:

```bash
docker compose exec db psql -U pomopet -d pomopet -c \
  "UPDATE sesiones SET inicio = now() - interval '26 minutes' WHERE id = 1"
```

## Pruebas

```bash
docker compose exec backend pytest -v
```

`tests/test_pomodoro.py` prueba la regla pura (24:59 vs 25:00, con y sin pausas) y
`tests/test_sesiones.py` los endpoints contra PostgreSQL. Como la transacción de prueba congela
`now()`, el paso del tiempo se simula retrasando `sesiones.inicio` y las filas de `pausas`.
