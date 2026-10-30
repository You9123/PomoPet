// Issue #12: cancelar una sesión. Queda en el historial, cuenta como cancelada y no da XP (RF-11).
import { adelantarReloj } from './bd.js'
import {
  crearMateria,
  datoDelResumen,
  expect,
  iniciarPomodoro,
  irA,
  materiaEnLista,
  registrarse,
  test,
  valorDelResumen,
} from './pasos.js'

test('una sesión cancelada queda en el historial sin dar XP', async ({ page, correo }) => {
  await registrarse(page, { correo, especie: 'Gato', color: 'Ceniza', mascota: 'Michi' })
  await crearMateria(page, 'Física')
  await iniciarPomodoro(page, 'Física')

  // Se estudiaron 10 minutos y se cancela
  await adelantarReloj(correo, 10)
  await page.getByRole('button', { name: '✕ Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Sesión cancelada' })).toBeVisible()

  await irA(page, 'Progreso')
  await expect(valorDelResumen(page, 'XP total')).toHaveText('0')
  await expect(valorDelResumen(page, 'Completados')).toHaveText('0')
  await expect(valorDelResumen(page, 'Cancelados')).toHaveText('1')
  await expect(datoDelResumen(page, 'Cancelados')).toContainText('10 min sin XP')
  await expect(valorDelResumen(page, 'Éxito')).toHaveText('0%')

  // Historial: la cancelada aparece con su filtro y no con el de completadas
  const historial = page.locator('section', { has: page.getByRole('heading', { name: 'Historial' }) })
  await historial.getByRole('button', { name: 'Canceladas' }).click()
  const sesion = historial.locator('li.sesion')
  await expect(sesion).toHaveCount(1)
  await expect(sesion).toContainText('Física')
  await expect(sesion).toContainText('Cancelada')
  await expect(sesion).toContainText('Sin XP')

  await historial.getByRole('button', { name: 'Completadas' }).click()
  await expect(historial).toContainText('Todavía no completas ningún pomodoro.')

  await irA(page, 'Materias')
  await expect(materiaEnLista(page, 'Física')).toContainText('0 XP')
})
