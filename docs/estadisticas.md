# Panel de estadísticas (Issue #11)

RF-08: muestra el progreso general y por materia, el tiempo estudiado por día y el historial de sesiones
(completadas **y** canceladas). Todo se calcula con SQL directo sobre las vistas `v_progreso_materia` y
`v_historial_sesiones`; no se guarda nada nuevo (3FN).

Los endpoints requieren `Authorization: Bearer <token>` (ver `autenticacion.md`).

## Base de datos

**Vista `v_historial_sesiones`** (`database/init/01_schema.sql`): una fila por sesión terminada
(`completada` o `cancelada`; las que están `en_curso` no aparecen porque su tiempo todavía cambia).

| Columna | Qué es |
| --- | --- |
| `sesion_id`, `usuario_id`, `materia_id`, `jefe_id` | De quién y de qué es la sesión |
| `estado`, `inicio`, `fin` | Igual que en `sesiones` |
| `pausado` | Suma de sus pausas (`interval`) |
| `efectivo` | `fin − inicio − pausado` (`interval`, nunca negativo) |

También se agregó el índice `sesiones_materia_inicio_idx (materia_id, inicio)` para filtrar por fecha.
Para una BD que ya tiene datos (Render) está `database/migraciones/002_vista_historial_sesiones.sql`.
La prueba 23 de `database/tests/pruebas_reglas.sql` revisa la vista.

## Endpoints

| Método | Ruta | Qué hace | Errores |
| --- | --- | --- | --- |
| GET | `/api/estadisticas?dias=7&zona=America/Costa_Rica` | Resumen, progreso por materia y minutos por día | `422` `dias` fuera de 1–365 o zona desconocida |
| GET | `/api/estadisticas/historial?pagina=1&por_pagina=10&estado=cancelada` | Sesiones terminadas, de la más reciente a la más antigua | `422` página < 1, `por_pagina` fuera de 1–50 o estado inválido |

`dias` (por defecto 7) solo afecta a `por_dia`; el resumen y `por_materia` cuentan **todo** el historial.
`zona` es la zona horaria IANA del navegador (por defecto `America/Costa_Rica`): los días se cortan a la
medianoche **local**, así que un pomodoro a las 11:30 p. m. cuenta para ese día y no para el siguiente
(que ya lo sería en UTC). `estado` es opcional: `completada` o `cancelada`.

### `GET /api/estadisticas`

```json
{
  "resumen": {
    "minutos_estudiados": 77, "minutos_en_canceladas": 12,
    "pomodoros_completados": 3, "pomodoros_cancelados": 1,
    "tasa_exito": 75, "xp_total": 300, "nivel": 2
  },
  "por_materia": [
    { "id": 1, "nombre": "Cálculo", "color": "#ff5a3c", "pomodoros_completados": 2,
      "pomodoros_cancelados": 1, "minutos_estudiados": 51, "xp": 200, "nivel": 2,
      "rango": { "codigo": "novato", "nombre": "Novato" } }
  ],
  "por_dia": {
    "zona": "America/Costa_Rica",
    "dias": ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"],
    "series": [
      { "materia_id": 1, "nombre": "Cálculo", "color": "#ff5a3c", "minutos": [0, 0, 0, 26, 0] },
      { "materia_id": 2, "nombre": "Física",  "color": "#3ee6b0", "minutos": [0, 26, 0, 0, 0] }
    ],
    "completados": [0, 1, 0, 1, 0],
    "cancelados":  [0, 1, 0, 0, 0]
  }
}
```

- `minutos_estudiados` y el XP solo cuentan sesiones **completadas** (igual que en `materias.md` y `/api/me`).
- Las **canceladas** se cuentan aparte: `pomodoros_cancelados`, `minutos_en_canceladas` (tiempo efectivo
  antes de cancelar, sin XP) y `cancelados` por día.
- `tasa_exito` = completadas / (completadas + canceladas), en %; `null` si todavía no hay sesiones.
- `por_materia` va de la materia con más pomodoros a la de menos e incluye las que están en 0.
- `por_dia.dias` siempre tiene `dias` elementos (los días sin sesiones salen en 0, gracias a `generate_series`).
  Cada serie tiene un valor por día, en el mismo orden; solo aparecen las materias con minutos en el periodo.

### `GET /api/estadisticas/historial`

```json
{
  "total": 4, "pagina": 1, "por_pagina": 10,
  "sesiones": [
    { "id": 19, "materia_id": 1, "materia_nombre": "Cálculo", "materia_color": "#ff5a3c",
      "jefe_nombre": "Parcial 1", "estado": "completada",
      "inicio": "2026-10-29T05:30:00Z", "fin": "2026-10-29T06:00:00Z",
      "segundos_pausados": 240, "segundos_efectivos": 1560, "xp": 100 }
  ]
}
```

`total` es el número de sesiones con el filtro aplicado (para la paginación). Una página después de la
última devuelve `sesiones: []`.

## Pantalla (frontend)

En `/estadisticas` (menú **Progreso**). Archivos: `utils/estadisticas.js` (funciones puras),
`stores/estadisticas.js`, `components/PanelEstadisticas.vue`, `components/GraficoMinutosDia.vue` y
`views/EstadisticasView.vue`.

- **Resumen:** tiempo estudiado, XP total y nivel, % de éxito, pomodoros completados y cancelados
  (con los minutos que se perdieron en canceladas).
- **Minutos por día:** barras apiladas de Chart.js (`vue-chartjs`), una por materia con su color.
  Selector de **7 o 30 días**. El tooltip muestra cada materia y el total del día. Si no hay minutos en el
  periodo se muestra un mensaje en lugar del gráfico. El gráfico tiene una descripción en texto para
  lectores de pantalla y no se anima si el sistema pide reducir el movimiento.
- **Historial:** 10 sesiones por página, filtro Todas / Completadas / Canceladas, con fecha, materia,
  tiempo efectivo, pausas, XP y Jefe Final.
- Chart.js se registra por piezas (`BarElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend`) y la
  ruta se carga aparte, así que no pesa en las demás pantallas.
- Si el backend no conoce la zona horaria del navegador (`422`), el store reintenta con `America/Costa_Rica`.
- Al cerrar sesión se limpian los datos. Pruebas: `utils/estadisticas.test.js` y `stores/estadisticas.test.js`
  (`npm test`); backend: `backend/tests/test_estadisticas.py`.
