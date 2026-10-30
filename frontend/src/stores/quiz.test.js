import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from './auth.js'
import { useQuizStore } from './quiz.js'

// ---------- Navegador y servidor falsos ----------

const almacen = new Map()
globalThis.localStorage = {
  getItem: (k) => almacen.get(k) ?? null,
  setItem: (k, v) => almacen.set(k, v),
  removeItem: (k) => almacen.delete(k),
}

let colas
let llamadas

function responder(clave, ...respuestas) {
  colas[clave] = [...(colas[clave] ?? []), ...respuestas]
}

const ok = (json, status = 200) => ({ status, json })
const falla = (status, detail) => ({ status, json: { detail } })

globalThis.fetch = async (url, opciones = {}) => {
  const clave = `${opciones.method ?? 'GET'} ${new URL(url).pathname}`
  llamadas.push({ clave, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined })
  const siguiente = colas[clave]?.shift()
  if (!siguiente) throw new Error(`Sin respuesta preparada para ${clave}`)
  return { ok: siguiente.status < 400, status: siguiente.status, json: async () => siguiente.json }
}

const RUTA = '/api/sesiones/7/quiz'
const CLAVE_SESION = 'pomopet.quiz.sesion'
const quizNuevo = (extra = {}) => ({
  preguntas: Array.from({ length: 5 }, (_, i) => ({ enunciado: `P${i}`, opciones: ['a', 'b', 'c', 'd'] })),
  respondido: false,
  ...extra,
})

let auth
let quiz

beforeEach(() => {
  colas = {}
  llamadas = []
  almacen.clear()
  setActivePinia(createPinia())
  auth = useAuthStore()
  auth.token = 'token-de-prueba'
  quiz = useQuizStore()
})

async function contestarTodo() {
  for (const opcion of [0, 1, 2, 3, 0]) await quiz.responder(opcion)
}

test('generar envía los apuntes y pasa a las preguntas, sin guardar los apuntes', async () => {
  responder(`POST ${RUTA}`, ok(quizNuevo(), 201))
  quiz.abrir(7)
  assert.equal(quiz.paso, 'apuntes')
  assert.equal(await quiz.generar('mis apuntes secretos'), true)
  assert.equal(quiz.paso, 'preguntas')
  assert.deepEqual(llamadas[0].cuerpo, { apuntes: 'mis apuntes secretos' })
  assert.equal(almacen.get(CLAVE_SESION), '7')
  assert.ok(![...almacen.values()].some((v) => v.includes('secretos')))
})

test('un 503 deja reintentar: sigue en apuntes y luego funciona', async () => {
  responder(`POST ${RUTA}`, falla(503, 'IA caída'), ok(quizNuevo(), 201))
  quiz.abrir(7)
  assert.equal(await quiz.generar('apuntes'), false)
  assert.equal(quiz.paso, 'apuntes')
  assert.match(quiz.error, /Inténtalo de nuevo/)
  assert.equal(await quiz.generar('apuntes'), true)
  assert.equal(quiz.error, '')
})

test('otros errores muestran el mensaje del backend', async () => {
  responder(`POST ${RUTA}`, falla(409, 'Ya existe un quiz para esta sesión'))
  quiz.abrir(7)
  await quiz.generar('apuntes')
  assert.equal(quiz.error, 'Ya existe un quiz para esta sesión')
})

test('avanza pregunta por pregunta y corrige solo al responder la última', async () => {
  responder(`POST ${RUTA}`, ok(quizNuevo(), 201))
  responder(`POST ${RUTA}/respuestas`, ok({ aciertos: 4, correctas: [0, 1, 2, 0, 0], dano_extra: true, jefe: { id: 1 } }))
  quiz.abrir(7)
  await quiz.generar('apuntes')

  await quiz.responder(0)
  assert.equal(quiz.actual, 1)
  assert.equal(quiz.pregunta.enunciado, 'P1')
  assert.equal(llamadas.length, 1)

  for (const opcion of [1, 2, 3, 0]) await quiz.responder(opcion)
  assert.deepEqual(llamadas[1].cuerpo, { respuestas: [0, 1, 2, 3, 0] })
  assert.equal(quiz.paso, 'resultado')
  assert.equal(quiz.resultado.dano_extra, true)
  assert.equal(almacen.has(CLAVE_SESION), false)
})

test('si corregir falla, se conserva todo para volver a intentarlo', async () => {
  responder(`POST ${RUTA}`, ok(quizNuevo(), 201))
  responder(
    `POST ${RUTA}/respuestas`,
    falla(500, 'Error interno'),
    ok({ aciertos: 1, correctas: [0, 0, 0, 0, 0], dano_extra: false, jefe: { id: 1 } }),
  )
  quiz.abrir(7)
  await quiz.generar('apuntes')
  await contestarTodo()
  assert.equal(quiz.paso, 'preguntas')
  assert.equal(quiz.error, 'Error interno')
  assert.equal(almacen.get(CLAVE_SESION), '7')

  await quiz.responder(0) // reintenta desde la última pregunta
  assert.equal(quiz.paso, 'resultado')
})

test('al recargar retoma el quiz sin responder', async () => {
  almacen.set(CLAVE_SESION, '7')
  responder(`GET ${RUTA}`, ok(quizNuevo()))
  await quiz.retomar()
  assert.equal(quiz.paso, 'preguntas')
  assert.equal(quiz.sesionId, 7)
  assert.equal(quiz.actual, 0)
})

test('al recargar no retoma uno ya respondido', async () => {
  almacen.set(CLAVE_SESION, '7')
  responder(`GET ${RUTA}`, ok(quizNuevo({ respondido: true })))
  await quiz.retomar()
  assert.equal(quiz.paso, null)
  assert.equal(almacen.has(CLAVE_SESION), false)
})

test('un 404 al retomar olvida la sesión; sin conexión la conserva', async () => {
  almacen.set(CLAVE_SESION, '7')
  responder(`GET ${RUTA}`, falla(500, 'Error interno'))
  await quiz.retomar()
  assert.equal(almacen.get(CLAVE_SESION), '7')

  responder(`GET ${RUTA}`, falla(404, 'No existe'))
  await quiz.retomar()
  assert.equal(almacen.has(CLAVE_SESION), false)
  assert.equal(quiz.paso, null)
})

test('sin quiz pendiente no se llama a la API', async () => {
  await quiz.retomar()
  assert.deepEqual(llamadas, [])
})

test('al cerrar sesión se borra el quiz de la persona anterior', async () => {
  responder(`POST ${RUTA}`, ok(quizNuevo(), 201))
  quiz.abrir(7)
  await quiz.generar('apuntes')
  auth.cerrarSesion()
  assert.equal(quiz.paso, null)
  assert.deepEqual(quiz.preguntas, [])
  assert.equal(almacen.has(CLAVE_SESION), false)
})
