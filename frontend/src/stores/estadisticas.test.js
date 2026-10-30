import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from './auth.js'
import { POR_PAGINA, useEstadisticasStore } from './estadisticas.js'

// ---------- Servidor falso: respuestas en cola por "METODO /ruta" (sin la query) ----------

let colas
let llamadas

function responder(clave, ...respuestas) {
  colas[clave] = [...(colas[clave] ?? []), ...respuestas]
}

const ok = (json, status = 200) => ({ status, json })
const falla = (status, detail) => ({ status, json: { detail } })

globalThis.fetch = async (url, opciones = {}) => {
  const direccion = new URL(url)
  const clave = `${opciones.method ?? 'GET'} ${direccion.pathname}`
  llamadas.push({ clave, params: Object.fromEntries(direccion.searchParams) })
  const siguiente = colas[clave]?.shift()
  if (!siguiente) throw new Error(`Sin respuesta preparada para ${clave}`)
  return { ok: siguiente.status < 400, status: siguiente.status, json: async () => siguiente.json }
}

function estadisticas(extra = {}) {
  return {
    resumen: {
      minutos_estudiados: 77, minutos_en_canceladas: 12, pomodoros_completados: 3,
      pomodoros_cancelados: 1, tasa_exito: 75, xp_total: 300, nivel: 2,
    },
    por_materia: [],
    por_dia: { zona: 'America/Costa_Rica', dias: [], series: [], completados: [], cancelados: [] },
    ...extra,
  }
}

function historial(extra = {}) {
  return { total: 0, pagina: 1, por_pagina: POR_PAGINA, sesiones: [], ...extra }
}

let auth
let est

beforeEach(() => {
  colas = {}
  llamadas = []
  setActivePinia(createPinia())
  auth = useAuthStore()
  auth.token = 'token-de-prueba'
  est = useEstadisticasStore()
})

test('cargar pide 7 días con la zona horaria del navegador', async () => {
  responder('GET /api/estadisticas', ok(estadisticas()))
  assert.equal(await est.cargar(), true)
  assert.equal(est.datos.resumen.xp_total, 300)
  assert.equal(llamadas[0].params.dias, '7')
  assert.ok(llamadas[0].params.zona.length > 0)
})

test('cambiar el periodo vuelve a pedir los datos; el mismo periodo no', async () => {
  responder('GET /api/estadisticas', ok(estadisticas()))
  await est.cambiarPeriodo(30)
  assert.equal(est.periodo, 30)
  assert.equal(llamadas[0].params.dias, '30')
  await est.cambiarPeriodo(30)
  assert.equal(llamadas.length, 1)
})

test('el historial se pide por páginas y con el filtro de estado', async () => {
  responder('GET /api/estadisticas/historial', ok(historial({ total: 12, pagina: 2 })), ok(historial()))
  await est.cargarHistorial(2)
  assert.deepEqual(llamadas[0].params, { pagina: '2', por_pagina: String(POR_PAGINA) })
  assert.equal(est.historial.total, 12)

  await est.cambiarFiltro('cancelada')
  assert.deepEqual(llamadas[1].params, { pagina: '1', por_pagina: String(POR_PAGINA), estado: 'cancelada' })
  assert.equal(est.filtro, 'cancelada')
})

test('si el backend falla, se muestra su mensaje', async () => {
  responder('GET /api/estadisticas', falla(500, 'Error interno'))
  assert.equal(await est.cargar(), false)
  assert.equal(est.error, 'Error interno')
  assert.equal(est.cargando, false)
})

test('si el backend no conoce la zona del navegador, reintenta con la de Costa Rica', async (t) => {
  t.mock.method(Intl, 'DateTimeFormat', () => ({ resolvedOptions: () => ({ timeZone: 'Marte/Olympus' }) }))
  responder('GET /api/estadisticas', falla(422, 'Zona horaria desconocida: Marte/Olympus'), ok(estadisticas()))
  assert.equal(await est.cargar(), true)
  assert.deepEqual(
    llamadas.map((l) => l.params.zona),
    ['Marte/Olympus', 'America/Costa_Rica'],
  )
  assert.equal(est.error, '')
})

test('cargarTodo trae el resumen y el historial juntos', async () => {
  responder('GET /api/estadisticas', ok(estadisticas()))
  responder('GET /api/estadisticas/historial', ok(historial({ total: 1 })))
  assert.equal(await est.cargarTodo(), true)
  assert.ok(est.datos)
  assert.equal(est.historial.total, 1)
})

test('al cerrar sesión se borran las estadísticas de la persona anterior', async () => {
  responder('GET /api/estadisticas', ok(estadisticas()))
  await est.cargar()
  est.periodo = 30
  auth.cerrarSesion()
  assert.equal(est.datos, null)
  assert.equal(est.periodo, 7)
  assert.equal(est.historial.total, 0)
})
