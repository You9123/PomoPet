# Cómo trabajar en PomoPet

## Ramas

- `main`: solo versiones entregadas en cada sprint. Nadie hace push directo.
- `develop`: integración del trabajo del equipo.
- `feature/nombre-corto`: una rama por tarea (ej. `feature/temporizador`).

## Flujo diario

1. `git checkout develop` y `git pull`
2. `git checkout -b feature/mi-tarea`
3. Trabajar y hacer commits pequeños: `git add .` y `git commit -m "feat: agrega temporizador"`
4. `git push -u origin feature/mi-tarea`
5. En GitHub: abrir Pull Request **hacia develop** y pedir revisión.

## Mensajes de commit

`feat:` nueva funcionalidad · `fix:` corrección · `docs:` documentación · `test:` pruebas · `chore:` configuración
