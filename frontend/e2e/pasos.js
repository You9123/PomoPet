// Pasos que comparten las pruebas de integración. Cada uno hace lo mismo que haría una persona en la app.
import { expect, test as base } from '@playwright/test'

import { adelantarReloj, borrarUsuario } from './bd.js'

export const PASSWORD = 'pomopet123'

/**
 * `test` con un `correo` nuevo para cada prueba. Al terminar, el usuario se borra de la BD
 * (con su mascota, materias y sesiones), así las pruebas no ensucian la BD local.
 */
export const test = base.extend({
  // Playwright exige el `{}` aunque este fixture no use otros
  // oxlint-disable-next-line no-empty-pattern
  correo: async ({}, usar) => {
    const correo = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@pomopet.test`
    await usar(correo)
    await borrarUsuario(correo)
  },
})

export { expect }

/** Crea una cuenta eligiendo especie, color y nombre de la mascota. */
export async function registrarse(page, { correo, especie, color, mascota }) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Crear una cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Elige a tu compañero' })).toBeVisible()

  await page.locator('label.especie', { hasText: especie }).click()
  await page.locator('label.color', { hasText: color }).click()
  await expect(page.getByRole('radio', { name: color })).toBeChecked()

  await page.getByLabel('Nombre de tu mascota').fill(mascota)
  await page.getByLabel('Correo').fill(correo)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // Ya dentro: la mascota recién nacida aparece en el temporizador
  await expect(page.getByRole('heading', { name: 'Listo para estudiar' })).toBeVisible()
  await expect(page.locator('.escenario__nombre')).toContainText(mascota)
}

export async function irA(page, seccion) {
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: seccion }).click()
}

/** Crea una materia en la pantalla Materias y vuelve al temporizador. */
export async function crearMateria(page, nombre) {
  await irA(page, 'Materias')
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(nombre)
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await expect(materiaEnLista(page, nombre)).toContainText('0 XP')
  await irA(page, 'Pomodoro')
}

export function materiaEnLista(page, nombre) {
  return page.locator('li.materia', { hasText: nombre })
}

/** Elige la materia en el temporizador y arranca un pomodoro. */
export async function iniciarPomodoro(page, materia) {
  await page.getByLabel('Materia', { exact: true }).selectOption({ label: materia })
  await page.getByRole('button', { name: '▶ Iniciar' }).click()
  await expect(page.getByRole('heading', { name: 'Estudiando' })).toBeVisible()
}

/** Crea un Jefe Final para la materia elegida en el temporizador; queda seleccionado. */
export async function crearJefe(page, nombre, hp) {
  await page.getByRole('button', { name: '+ Nuevo jefe' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill(nombre)
  await page.getByLabel('HP (pomodoros)').fill(String(hp))
  await page.getByRole('button', { name: 'Crear jefe' }).click()
  await expect(barraDelJefe(page)).toContainText(`${hp} / ${hp} HP`)
}

/** La barra de vida del jefe (la del temporizador, o la del resultado del quiz). */
export function barraDelJefe(page) {
  return page.locator('.jefe')
}

/**
 * Termina el pomodoro en curso con el "viaje en el tiempo" (como en flujo-completo.spec.js):
 * la sesión empezó hace 26 minutos y, al recargar, el frontend la finaliza en el servidor.
 */
export async function completarPomodoro(page, correo) {
  await adelantarReloj(correo, 26)
  await page.reload()
  await expect(page.getByRole('heading', { name: '¡Lo lograste! +100 XP' })).toBeVisible()
}

/** Una tarjeta del resumen de la pantalla Progreso ("XP total", "Completados"...). */
export function datoDelResumen(page, titulo) {
  return page.locator('.dato', { has: page.locator('dt', { hasText: titulo }) })
}

/** El número grande de una tarjeta del resumen, para compararlo exacto ("0" no debe aceptar "100"). */
export function valorDelResumen(page, titulo) {
  return datoDelResumen(page, titulo).locator('dd').first()
}
