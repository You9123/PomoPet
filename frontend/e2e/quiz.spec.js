// Issue #43 (RF-15, RF-16): golpe extra contra el Jefe Final con un quiz creado por la IA.
// El backend corre con IA_PROVEEDOR=falso: el quiz siempre tiene 5 preguntas y la correcta es «Correcta».
import {
  barraDelJefe,
  completarPomodoro,
  crearJefe,
  crearMateria,
  expect,
  iniciarPomodoro,
  irA,
  registrarse,
  test,
  valorDelResumen,
} from './pasos.js'

const APUNTES =
  'La fotosíntesis es el proceso por el cual las plantas, las algas y algunas bacterias transforman la ' +
  'energía de la luz en energía química. Ocurre en los cloroplastos, usa agua y dióxido de carbono, y ' +
  'libera oxígeno. La clorofila es el pigmento verde que absorbe la luz.'

/** Registro → materia → jefe de 3 HP → un pomodoro completado contra él (le quita 1 HP). */
async function vencerUnPomodoro(page, correo) {
  await registrarse(page, { correo, especie: 'Gato', color: 'Clásico', mascota: 'Michi' })
  await crearMateria(page, 'Biología')
  await page.getByLabel('Materia', { exact: true }).selectOption({ label: 'Biología' })
  await crearJefe(page, 'Parcial de Biología', 3)
  await iniciarPomodoro(page, 'Biología')
  await completarPomodoro(page, correo)
  await expect(barraDelJefe(page)).toContainText('2 / 3 HP')
}

/** Abre el quiz, pega los apuntes y responde las 5 preguntas: acierta las primeras `aciertos`. */
async function hacerQuiz(page, aciertos) {
  await page.getByRole('button', { name: '⚔ Golpe extra: quiz' }).click()
  const quiz = page.getByRole('region', { name: 'Golpe extra' })

  await quiz.getByLabel('Pega tus apuntes').fill(APUNTES)
  await quiz.getByRole('button', { name: 'Crear quiz' }).click()

  for (let i = 0; i < 5; i++) {
    await expect(quiz.getByText(`Pregunta ${i + 1} de 5`)).toBeVisible()
    const opcion = i < aciertos ? 'Correcta' : 'Incorrecta A'
    await quiz.getByRole('button', { name: opcion, exact: true }).click()
  }
  await expect(quiz.getByText(`${aciertos} de 5 aciertos`)).toBeVisible()
  return quiz
}

test('con 4 aciertos el jefe pierde 1 HP extra y el XP no cambia', async ({ page, correo }) => {
  await vencerUnPomodoro(page, correo)

  const quiz = await hacerQuiz(page, 4)
  await expect(quiz).toContainText('¡Golpe crítico! El jefe pierde 1 HP extra.')
  // HP 3 - 1 pomodoro - 1 del quiz
  await expect(barraDelJefe(page)).toContainText('1 / 3 HP')

  await quiz.getByRole('button', { name: 'Listo' }).click()
  await expect(quiz).toBeHidden()
  await expect(barraDelJefe(page)).toContainText('1 / 3 HP')
  // Ya se usó el quiz de este pomodoro: no se vuelve a ofrecer
  await expect(page.getByRole('button', { name: '⚔ Golpe extra: quiz' })).toBeHidden()

  // El quiz no da XP: siguen siendo los 100 del pomodoro
  await irA(page, 'Progreso')
  await expect(valorDelResumen(page, 'XP total')).toHaveText('100')
  await expect(valorDelResumen(page, 'Completados')).toHaveText('1')
})

test('con 3 aciertos no hay daño extra', async ({ page, correo }) => {
  await vencerUnPomodoro(page, correo)

  const quiz = await hacerQuiz(page, 3)
  await expect(quiz).toContainText('Te faltó poco: se necesitan 4 aciertos para el golpe extra.')
  await expect(barraDelJefe(page)).toContainText('2 / 3 HP')

  await quiz.getByRole('button', { name: 'Listo' }).click()
  await expect(barraDelJefe(page)).toContainText('2 / 3 HP')
})
