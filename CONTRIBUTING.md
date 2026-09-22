# Cómo trabajar en PomoPet

La guía completa del equipo (instalación y flujo de trabajo) está en el enlace compartido en el grupo.

## Ramas

- `main`: solo lo entregado en cada sprint. Se actualiza por PR desde `develop`.
- `develop`: integración del equipo. Solo por Pull Request (1 aprobación + CI en verde).
- `feature/<issue>-<nombre>`, `fix/<issue>-<nombre>`, `docs/<nombre>`: una rama por issue.

## Flujo diario

1. `git checkout develop` y `git pull`
2. `git checkout -b feature/5-sesiones-pomodoro`
3. Agregar archivos por nombre (nunca `git add .`) y hacer un commit por cambio lógico:
   `git add <archivos>` y `git commit -m "feat(backend): ..."`
4. `git pull origin develop` para traer lo nuevo, y probar (`pytest -v` / `npm run build`)
5. `git push -u origin feature/5-sesiones-pomodoro`
6. Abrir el Pull Request **hacia develop**, llenar la plantilla, poner `Closes #N` y pedir revisión.

## Mensajes de commit

`tipo(capa): qué hace`. Tipos: `feat` · `fix` · `test` · `docs` · `refactor` · `chore`
