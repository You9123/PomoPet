import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { reloj } from '../utils/temporizador.js'
import { useAuthStore } from './auth.js'
import { usePomodoroStore } from './pomodoro.js'

const MIN = 60 * 1000
const T0 = 1_800_000_000_000

// ---------- Servidor falso: respuestas en cola por "METODO /ruta" ----------

let colas
let llamadas

function responder(clave, ...respuestas) {
  colas[clave] = [...(colas[clave] ?? []), ...respuestas]
}

function ok(json, status = 200) {
  return { status, json }
}

globalThis.fetch = async (url, opciones = {}) => {
  const ruta = new URL(url).pathname
  const clave = `${opciones.method ?? 'GET'} ${ruta}`
  llamadas.push(clave)
  const siguiente = colas[clave]?.shift()
  if (!siguiente) throw new Error(`Sin respuesta preparada para ${clave}`)
  return {
    ok: siguiente.status < 400,
    status: siguiente.status,
    json: async () => siguiente.json,
  }
}

function sesion(extra = {}) {
  return {
    id: 7,
    materia_id: 1,
    jefe_id: null,
    estado: 'en_curso',
    inicio: '2026-01-01T10:00:00Z',
    fin: null,
    pausada: false,
    segundos_pausados: 0,
    segundos_efectivos: 0,
    xp_otorgado: 0,
    ...extra,
  }
}

let t
let pomodoro
let auth

beforeEach(() => {
  colas = {}
  llamadas = []
  t = T0
  reloj.ahora = () => t
  setActivePinia(createPinia())
  auth = useAuthStore()
  auth.token = 'token-de-prueba'
  auth.perfil = { id: 1, descanso_largo_min: 20, mascota: { especie: 'gato' } }
  pomodoro = usePomodoroStore()
  pomodoro.completados = 0
  pomodoro.materiaId = 1
})

async function iniciarPomodoro() {
  responder('POST /api/sesiones', ok(sesion(), 201))
  await pomodoro.iniciar()
}

/** Avanza el reloj hasta que termina el pomodoro y deja que se finalice (una sola vez, sin ticks previos). */
async function terminarPomodoro() {
  responder('POST /api/sesiones/7/finalizar', ok(sesion({ estado: 'completada', xp_otorgado: 100 })))
  t += 25 * MIN
  pomodoro.tick()
  await new Promise((r) => setTimeout(r, 0))
}

// ---------- Marcas de tiempo (RNF-07) ----------

test('iniciar: queda estudiando con 25:00 por delante', async () => {
  await iniciarPomodoro()
  assert.equal(pomodoro.fase, 'estudiando')
  assert.equal(pomodoro.restanteMs, 25 * MIN)
})

test('el restante sale de la hora, no de los ticks: una pestaña dormida 10 min muestra 15:00', async () => {
  await iniciarPomodoro()
  t += 10 * MIN // ningún tick durante 10 minutos
  pomodoro.tick() // un solo tick al volver a la pestaña
  assert.equal(pomodoro.restanteMs, 15 * MIN)
})

test('si la pestaña estuvo dormida más de 25 min, al volver se finaliza solo', async () => {
  await iniciarPomodoro()
  await terminarPomodoro()
  assert.ok(llamadas.includes('POST /api/sesiones/7/finalizar'))
  assert.equal(pomodoro.fase, 'exito')
  assert.equal(pomodoro.completados, 1)
})

test('retomar una sesión usa los segundos efectivos del servidor', async () => {
  responder('GET /api/sesiones/actual', ok(sesion({ segundos_efectivos: 10 * 60 })))
  await pomodoro.recuperar()
  assert.equal(pomodoro.fase, 'estudiando')
  assert.equal(pomodoro.restanteMs, 15 * MIN)
})

test('la barra de progreso avanza con el tiempo y se congela en pausa', async () => {
  await iniciarPomodoro()
  assert.equal(pomodoro.progreso, 0)
  t += 5 * MIN
  pomodoro.tick()
  assert.equal(pomodoro.progreso, 0.2)
  responder('POST /api/sesiones/7/pausar', ok(sesion({ pausada: true, segundos_efectivos: 5 * 60 })))
  await pomodoro.pausar()
  t += 60 * MIN
  pomodoro.tick()
  assert.equal(pomodoro.progreso, 0.2)
})

// ---------- Pausas (RF-01) ----------

test('pausar congela el tiempo y reanudar lo continúa', async () => {
  await iniciarPomodoro()
  t += 5 * MIN
  responder('POST /api/sesiones/7/pausar', ok(sesion({ pausada: true, segundos_efectivos: 5 * 60 })))
  await pomodoro.pausar()
  assert.equal(pomodoro.fase, 'pausado')
  assert.equal(pomodoro.restanteMs, 20 * MIN)

  t += 30 * MIN // 30 min en pausa: el reloj no se mueve
  pomodoro.tick()
  assert.equal(pomodoro.restanteMs, 20 * MIN)
  assert.equal(pomodoro.fase, 'pausado')

  responder('POST /api/sesiones/7/reanudar', ok(sesion({ segundos_efectivos: 5 * 60, segundos_pausados: 1800 })))
  await pomodoro.reanudar()
  assert.equal(pomodoro.fase, 'estudiando')
  assert.equal(pomodoro.restanteMs, 20 * MIN)
})

test('retomar una sesión en pausa la deja en pausa', async () => {
  responder('GET /api/sesiones/actual', ok(sesion({ pausada: true, segundos_efectivos: 600 })))
  await pomodoro.recuperar()
  assert.equal(pomodoro.fase, 'pausado')
  assert.equal(pomodoro.restanteMs, 15 * MIN)
})

// ---------- Cancelar ----------

test('cancelar: estado cancelado y se rompe la racha', async () => {
  pomodoro.completados = 3
  await iniciarPomodoro()
  responder('POST /api/sesiones/7/cancelar', ok(sesion({ estado: 'cancelada' })))
  await pomodoro.cancelar()
  assert.equal(pomodoro.fase, 'cancelado')
  assert.equal(pomodoro.completados, 0)
})

// ---------- Descansos (RF-10) ----------

test('tras el éxito viene un descanso corto de 5 minutos y luego queda libre', async () => {
  await iniciarPomodoro()
  await terminarPomodoro()
  assert.equal(pomodoro.fase, 'exito')

  t += 4 * 1000 // fin de la celebración
  pomodoro.tick()
  assert.equal(pomodoro.fase, 'descanso')
  assert.equal(pomodoro.descansoTipo, 'corto')
  assert.equal(pomodoro.restanteMs, 5 * MIN)

  t += 5 * MIN
  pomodoro.tick()
  assert.equal(pomodoro.fase, 'inactivo')
})

test('el cuarto pomodoro seguido da el descanso largo con los minutos del usuario', async () => {
  pomodoro.completados = 3
  await iniciarPomodoro()
  await terminarPomodoro()
  assert.equal(pomodoro.completados, 4)

  t += 4 * 1000
  pomodoro.tick()
  assert.equal(pomodoro.descansoTipo, 'largo')
  assert.equal(pomodoro.restanteMs, 20 * MIN) // descanso_largo_min del perfil
  assert.equal(pomodoro.completados, 0) // empieza una nueva ronda
})

// ---------- Errores ----------

test('si ya hay una sesión en curso en otra pestaña, la retoma', async () => {
  responder('POST /api/sesiones', ok({ detail: 'Ya tienes una sesión en curso (id 7)' }, 409))
  responder('GET /api/sesiones/actual', ok(sesion({ segundos_efectivos: 60 })))
  await pomodoro.iniciar()
  assert.equal(pomodoro.fase, 'estudiando')
  assert.equal(pomodoro.error, '')
})

test('un 409 al finalizar se reintenta y termina bien', async () => {
  await iniciarPomodoro()
  responder(
    'POST /api/sesiones/7/finalizar',
    ok({ detail: 'Aún no se cumplen 25 minutos efectivos: faltan 0 min 1 s' }, 409),
    ok(sesion({ estado: 'completada', xp_otorgado: 100 })),
  )
  t += 25 * MIN
  pomodoro.tick()
  await new Promise((r) => setTimeout(r, 1200)) // espera del reintento
  assert.equal(pomodoro.fase, 'exito')
  assert.equal(llamadas.filter((c) => c === 'POST /api/sesiones/7/finalizar').length, 2)
})

test('sin materia no se puede iniciar', () => {
  pomodoro.materiaId = null
  assert.equal(pomodoro.puedeIniciar, false)
})

// ---------- Cambio de cuenta ----------

test('al cerrar sesión se borra la racha: otra persona no hereda los tomates', () => {
  pomodoro.completados = 3
  pomodoro.materiaId = 5
  auth.cerrarSesion()
  assert.equal(pomodoro.completados, 0)
  assert.equal(pomodoro.materiaId, null)
  assert.equal(pomodoro.fase, 'inactivo')
})

test('cerrar sesión con un pomodoro en marcha lo suelta del reloj', async () => {
  await iniciarPomodoro()
  assert.equal(pomodoro.fase, 'estudiando')
  auth.cerrarSesion()
  assert.equal(pomodoro.fase, 'inactivo')
  assert.equal(pomodoro.sesion, null)
})
