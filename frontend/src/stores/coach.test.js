import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from './auth.js'
import { useCoachStore } from './coach.js'

// ---------- Servidor falso: respuestas en cola por "METODO /ruta" ----------

let colas
let llamadas

function responder(clave, ...respuestas) {
  colas[clave] = [...(colas[clave] ?? []), ...respuestas]
}

const ok = (json, status = 200) => ({ status, json })
const falla = (status, detail) => ({ status, json: { detail } })

globalThis.fetch = async (url, opciones = {}) => {
  const clave = `${opciones.method ?? 'GET'} ${new URL(url).pathname}`
  llamadas.push(clave)
  const siguiente = colas[clave]?.shift()
  if (!siguiente) throw new Error(`Sin respuesta preparada para ${clave}`)
  return { ok: siguiente.status < 400, status: siguiente.status, json: async () => siguiente.json }
}

const consejo = (extra = {}) => ({ texto: '¡A estudiar!', origen: 'ia', creado_en: '2026-10-30T10:00:00Z', restantes: 2, ...extra })

let auth
let coach

beforeEach(() => {
  colas = {}
  llamadas = []
  setActivePinia(createPinia())
  auth = useAuthStore()
  auth.token = 'token-de-prueba'
  coach = useCoachStore()
})

test('cargar trae el último consejo y cuántos quedan hoy', async () => {
  responder('GET /api/coach/consejo', ok(consejo()))
  await coach.cargar()
  assert.equal(coach.texto, '¡A estudiar!')
  assert.equal(coach.restantes, 2)
})

test('cargar sin consejos previos deja el texto vacío', async () => {
  responder('GET /api/coach/consejo', ok(consejo({ texto: null, restantes: 3 })))
  await coach.cargar()
  assert.equal(coach.texto, null)
  assert.equal(coach.restantes, 3)
})

test('si cargar falla no se muestra ningún error', async () => {
  responder('GET /api/coach/consejo', falla(500, 'Error interno'))
  await coach.cargar()
  assert.equal(coach.error, '')
  assert.equal(coach.texto, null)
})

test('pedir muestra el consejo nuevo y baja el contador', async () => {
  responder('POST /api/coach/consejo', ok(consejo({ texto: 'Repasa Física', restantes: 1 })))
  assert.equal(await coach.pedir(), true)
  assert.equal(coach.texto, 'Repasa Física')
  assert.equal(coach.restantes, 1)
  assert.equal(coach.cargando, false)
})

test('un consejo de respaldo se muestra igual, sin mensajes técnicos', async () => {
  responder('POST /api/coach/consejo', ok(consejo({ texto: 'Sigue así', origen: 'respaldo' })))
  assert.equal(await coach.pedir(), true)
  assert.equal(coach.texto, 'Sigue así')
  assert.equal(coach.error, '')
})

test('sin consejos restantes no se llama a la API', async () => {
  coach.restantes = 0
  assert.equal(await coach.pedir(), false)
  assert.deepEqual(llamadas, [])
})

test('un 429 agota el contador y muestra el mensaje', async () => {
  coach.restantes = 1
  responder('POST /api/coach/consejo', falla(429, 'Ya pediste 3 consejos hoy'))
  assert.equal(await coach.pedir(), false)
  assert.equal(coach.restantes, 0)
  assert.equal(coach.error, 'Ya pediste 3 consejos hoy')
})

test('un error conserva el consejo anterior', async () => {
  coach.texto = 'El de antes'
  responder('POST /api/coach/consejo', falla(500, 'Error interno'))
  assert.equal(await coach.pedir(), false)
  assert.equal(coach.texto, 'El de antes')
  assert.equal(coach.cargando, false)
})

test('al cerrar sesión se borra el consejo de la persona anterior', async () => {
  responder('GET /api/coach/consejo', ok(consejo()))
  await coach.cargar()
  auth.cerrarSesion()
  assert.equal(coach.texto, null)
  assert.equal(coach.restantes, null)
})
