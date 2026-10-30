// Issue #43 (RF-14): la mascota da un consejo de la IA. El backend corre con IA_PROVEEDOR=falso:
// no sale a internet ni gasta cupo, y el consejo siempre es el mismo texto.
import { expect, registrarse, test } from './pasos.js'

const CONSEJO_FALSO = '¡Vas muy bien! Un pomodoro más y descansamos juntos.'

test('pedir un consejo lo muestra en el globo y baja el contador del día', async ({ page, correo }) => {
  await registrarse(page, { correo, especie: 'Perro', color: 'Clásico', mascota: 'Firulais' })

  const consejo = page.getByRole('region', { name: 'Consejo de Firulais' })
  const globo = consejo.locator('.consejo__globo')
  const boton = consejo.getByRole('button', { name: /Pedir consejo/ })

  // Todavía sin consejos: texto de bienvenida y los 3 del día disponibles
  await expect(globo).toHaveText('Firulais tiene algo que decirte sobre tu estudio.')
  await expect(boton).toHaveText('Pedir consejo (3 hoy)')

  await boton.click()
  await expect(globo).toHaveText(CONSEJO_FALSO)
  await expect(boton).toHaveText('Pedir consejo (2 hoy)')

  // El consejo quedó guardado en la BD: al recargar se sigue viendo
  await page.reload()
  await expect(globo).toHaveText(CONSEJO_FALSO)
  await expect(boton).toHaveText('Pedir consejo (2 hoy)')

  // Con los 3 del día gastados, el botón se apaga
  await boton.click()
  await expect(boton).toHaveText('Pedir consejo (1 hoy)')
  await boton.click()
  await expect(boton).toHaveText('Pedir consejo (0 hoy)')
  await expect(boton).toBeDisabled()
})
