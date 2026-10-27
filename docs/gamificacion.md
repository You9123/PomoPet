# Niveles, rangos y evolución de la mascota (Issue #8)

RF-04. Todo se **calcula**, nada se guarda en la BD (3FN). El código está en `backend/app/gamificacion.py`
y los umbrales están en dos tablas al inicio de ese archivo: para cambiar uno basta editarlo ahí
(y sus pruebas en `backend/tests/test_niveles.py`).

## De dónde sale el XP

Cada pomodoro completado da **100 XP** (mínimo 25 minutos sin contar pausas; ver `sesiones.md`).

- **XP de una materia** = 100 × `pomodoros_completados` (vista `v_progreso_materia`).
- **XP total del usuario** = la suma del XP de todas sus materias.
- Los pomodoros cancelados no dan XP. Si se borra una materia, su XP se pierde con ella.

## Nivel

Empieza en 1 y sube **cada 200 XP** (2 pomodoros): `nivel = XP // 200 + 1`. Se calcula igual para una
materia (con su XP) y para el usuario (con su XP total).

## Rango de cada materia

| Rango | XP de la materia | Pomodoros |
| --- | --- | --- |
| Novato (`novato`) | 0 – 499 | 0 – 4 |
| Estudiante Promedio (`estudiante_promedio`) | 500 – 1499 | 5 – 14 |
| Casi Bachiller (`casi_bachiller`) | 1500 – 2999 | 15 – 29 |
| Maestro (`maestro`) | 3000 o más | 30 o más |

## Etapa de evolución de la mascota

Depende del XP **total** del usuario, no de una sola materia.

| Etapa | XP total | Pomodoros |
| --- | --- | --- |
| Cría (`cria`) | 0 – 499 | 0 – 4 |
| Joven (`joven`) | 500 – 2499 | 5 – 24 |
| Adulta (`adulta`) | 2500 – 4999 | 25 – 49 |
| Legendaria (`legendaria`) | 5000 o más | 50 o más |

## En la API

- `GET /api/materias` y `GET /api/materias/{id}` añaden `nivel` y `rango: {codigo, nombre}`.
- `GET /api/me` añade en `mascota`: `xp_total`, `nivel` y `etapa: {codigo, nombre}`.

Ejemplo de `mascota` en `/api/me`:

```json
{ "nombre": "Michi", "especie": "gato", "xp_total": 500, "nivel": 3, "etapa": {"codigo": "joven", "nombre": "Joven"} }
```

El `codigo` es estable y sirve para el frontend; el `nombre` es el texto para mostrar.

## En la interfaz

- Pantalla de materias: el rango y el nivel de cada materia.
- Temporizador: la etapa y el nivel de la mascota junto a su nombre, y **el dibujo cambia con la etapa**
  (cría en un cascarón, joven, adulta con capa y bufanda, legendaria con alas, corona y capa real; ver `temporizador.md`).
  Se recargan al completar un pomodoro.
