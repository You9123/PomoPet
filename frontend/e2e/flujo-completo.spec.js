// Issue #12: registro con mascota → crear materia → pomodoro con una pausa → ver el XP en estadísticas.
// Recorre Vue, FastAPI y PostgreSQL juntos: nada de la API ni de la BD es falso.
import { adelantarReloj } from './bd.js'
import {
  crearMateria,
  expect,
  iniciarPomodoro,
  irA,
  materiaEnLista,
  registrarse,
  test,
  valorDelResumen,
} from './pasos.js'

test('un pomodoro completado con una pausa da 100 XP y aparece en las estadísticas', async ({ page, correo }) => {
  await registrarse(page, { correo, especie: 'Dragón', color: 'Hielo', mascota: 'Chispa' })
  await crearMateria(page, 'Cálculo')
  await iniciarPomodoro(page, 'Cálculo')

  // Pausa de verdad: el servidor la guarda y la resta del tiempo estudiado
  await page.getByRole('button', { name: '❚❚ Pausar' }).click()
  await expect(page.getByRole('heading', { name: 'En pausa' })).toBeVisible()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: '▶ Reanudar' }).click()
  await expect(page.getByRole('heading', { name: 'Estudiando' })).toBeVisible()

  // Viaje en el tiempo: la sesión empezó hace 26 min. Al recargar, el frontend la retoma desde el
  // servidor, ve que ya se cumplió el tiempo y la finaliza; el backend valida los 25 min efectivos.
  await adelantarReloj(correo, 26)
  await page.reload()
  await expect(page.getByRole('heading', { name: '¡Lo lograste! +100 XP' })).toBeVisible()

  // Estadísticas
  await irA(page, 'Progreso')
  await expect(valorDelResumen(page, 'XP total')).toHaveText('100')
  await expect(valorDelResumen(page, 'Completados')).toHaveText('1')
  await expect(valorDelResumen(page, 'Cancelados')).toHaveText('0')
  await expect(valorDelResumen(page, 'Éxito')).toHaveText('100%')
  await expect(page.getByRole('img', { name: /Minutos estudiados en los últimos 7 días: .*Cálculo/ })).toBeVisible()

  const sesion = page.locator('li.sesion')
  await expect(sesion).toHaveCount(1)
  await expect(sesion).toContainText('Cálculo')
  await expect(sesion).toContainText('Completada')
  await expect(sesion).toContainText('+100 XP')
  await expect(sesion).toContainText('en pausa')

  // La pantalla Materias cuenta lo mismo
  await irA(page, 'Materias')
  await expect(materiaEnLista(page, 'Cálculo')).toContainText('1 pomodoros')
  await expect(materiaEnLista(page, 'Cálculo')).toContainText('100 XP')
})
