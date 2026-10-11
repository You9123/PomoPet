import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DESCANSO_CORTO_SEG,
  descansoQueToca,
  formatear,
  restanteDelPomodoroSeg,
  restanteMs,
} from './temporizador.js'

test('el tiempo restante depende de las marcas de tiempo, no de cuántos ticks hubo', () => {
  const inicio = 1_000_000
  const fin = inicio + 25 * 60 * 1000
  // la pestaña "durmió" 10 minutos: un solo cálculo da el valor correcto
  assert.equal(restanteMs(fin, inicio + 10 * 60 * 1000), 15 * 60 * 1000)
})

test('el tiempo restante nunca es negativo', () => {
  assert.equal(restanteMs(1000, 5000), 0)
})

test('restante del pomodoro según el tiempo efectivo del servidor', () => {
  assert.equal(restanteDelPomodoroSeg(0), 25 * 60)
  assert.equal(restanteDelPomodoroSeg(24 * 60 + 59), 1)
  assert.equal(restanteDelPomodoroSeg(25 * 60), 0)
  assert.equal(restanteDelPomodoroSeg(40 * 60), 0)
})

test('formatear redondea hacia arriba: 00:00 solo cuando terminó', () => {
  assert.equal(formatear(25 * 60 * 1000), '25:00')
  assert.equal(formatear(24 * 60 * 1000 + 59_001), '25:00')
  assert.equal(formatear(1), '00:01')
  assert.equal(formatear(0), '00:00')
  assert.equal(formatear(-500), '00:00')
})

test('descanso corto de 5 minutos tras los primeros pomodoros', () => {
  for (const n of [1, 2, 3]) {
    const d = descansoQueToca(n, 20)
    assert.equal(d.tipo, 'corto')
    assert.equal(d.duracionMs, DESCANSO_CORTO_SEG * 1000)
  }
})

test('descanso largo tras 4 pomodoros usa los minutos del usuario (15 a 30)', () => {
  assert.deepEqual(descansoQueToca(4, 20), { tipo: 'largo', duracionMs: 20 * 60 * 1000 })
  assert.deepEqual(descansoQueToca(4, 30), { tipo: 'largo', duracionMs: 30 * 60 * 1000 })
  assert.equal(descansoQueToca(4).duracionMs, 15 * 60 * 1000)
})
