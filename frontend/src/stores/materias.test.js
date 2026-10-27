import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from './auth.js'
import {
  COLORES_SUGERIDOS,
  MAX_MATERIAS,
  cambiosDe,
  horasDe,
  sugerirColor,
  useMateriasStore,
} from './materias.js'

// ---------- Servidor falso: respuestas en cola por "METODO /ruta" ----------

let colas
let llamadas

function responder(clave, ...respuestas) {
  colas[clave] = [...(colas[clave] ?? []), ...respuestas]
}

function ok(json, status = 200) {
  return { status, json }
}

function falla(status, detail) {
  return { status, json: { detail } }
}

globalThis.fetch = async (url, opciones = {}) => {
  const ruta = new URL(url).pathname
  const clave = `${opciones.method ?? 'GET'} ${ruta}`
  llamadas.push({ clave, cuerpo: opciones.body ? JSON.parse(opciones.body) : null })
  const siguiente = colas[clave]?.shift()
  if (!siguiente) throw new Error(`Sin respuesta preparada para ${clave}`)
  return {
    ok: siguiente.status < 400,
    status: siguiente.status,
    json: async () => {
      if (siguiente.json === undefined) throw new SyntaxError('sin cuerpo')
      return siguiente.json
    },
  }
}

function materia(extra = {}) {
  return {
    id: 1,
    nombre: 'Cálculo',
    color: '#ff5a3c',
    horas_semanales: 6,
    creado_en: '2026-10-01T10:00:00Z',
    pomodoros_completados: 4,
    pomodoros_cancelados: 1,
    minutos_estudiados: 108,
    xp: 400,
    ...extra,
  }
}

let auth
let materias

beforeEach(() => {
  colas = {}
  llamadas = []
  setActivePinia(createPinia())
  auth = useAuthStore()
  auth.token = 'token-de-prueba'
  materias = useMateriasStore()
})

// ---------- Funciones puras ----------

test('el campo de horas vacío se envía como null, no como 0', () => {
  assert.equal(horasDe(''), null)
  assert.equal(horasDe(null), null)
  assert.equal(horasDe(0), 0)
  assert.equal(horasDe('6'), 6)
})

test('cambiosDe solo incluye lo que cambió', () => {
  const m = materia()
  assert.deepEqual(cambiosDe(m, { nombre: 'Cálculo', color: '#FF5A3C', horasSemanales: 6 }), {})
  assert.deepEqual(cambiosDe(m, { nombre: '  Física ', color: '#ff5a3c', horasSemanales: 6 }), { nombre: 'Física' })
  assert.deepEqual(cambiosDe(m, { nombre: 'Cálculo', color: '#3ee6b0', horasSemanales: 6 }), { color: '#3ee6b0' })
})

test('cambiosDe permite quitar las horas semanales', () => {
  assert.deepEqual(cambiosDe(materia(), { nombre: 'Cálculo', color: '#ff5a3c', horasSemanales: '' }), {
    horas_semanales: null,
  })
})

test('se sugiere el primer color que no está en uso', () => {
  assert.equal(sugerirColor([]), COLORES_SUGERIDOS[0])
  assert.equal(sugerirColor([materia({ color: COLORES_SUGERIDOS[0].toUpperCase() })]), COLORES_SUGERIDOS[1])
})

test('si todos los colores están en uso, se vuelve a empezar', () => {
  const todas = COLORES_SUGERIDOS.map((color, id) => materia({ id, color }))
  assert.ok(COLORES_SUGERIDOS.includes(sugerirColor(todas)))
})

// ---------- Store ----------

test('cargar trae las materias del usuario', async () => {
  responder('GET /api/materias', ok([materia(), materia({ id: 2, nombre: 'Física' })]))
  assert.equal(await materias.cargar(), true)
  assert.equal(materias.lista.length, 2)
  assert.equal(materias.cargada, true)
})

test('crear envía los datos limpios y agrega la materia a la lista', async () => {
  responder('POST /api/materias', ok(materia({ id: 5, nombre: 'Física', horas_semanales: null }), 201))
  const creada = await materias.crear({ nombre: '  Física ', color: '#3ee6b0', horasSemanales: '' })
  assert.equal(creada, true)
  assert.deepEqual(llamadas[0].cuerpo, { nombre: 'Física', color: '#3ee6b0', horas_semanales: null })
  assert.deepEqual(
    materias.lista.map((m) => m.id),
    [5],
  )
})

test('si el backend rechaza la materia, se muestra su mensaje y la lista no cambia', async () => {
  responder('POST /api/materias', falla(409, 'Ya tienes 20 materias, que es el máximo permitido'))
  assert.equal(await materias.crear({ nombre: 'Química', color: '#ff5a3c', horasSemanales: '' }), false)
  assert.equal(materias.error, 'Ya tienes 20 materias, que es el máximo permitido')
  assert.equal(materias.lista.length, 0)
})

test('lleno se activa con 20 materias', async () => {
  responder('GET /api/materias', ok(Array.from({ length: MAX_MATERIAS }, (_, i) => materia({ id: i + 1 }))))
  await materias.cargar()
  assert.equal(materias.lleno, true)
})

test('editar envía solo los campos que cambiaron y reemplaza la materia', async () => {
  responder('GET /api/materias', ok([materia()]))
  await materias.cargar()
  responder('PATCH /api/materias/1', ok(materia({ nombre: 'Cálculo II' })))

  assert.equal(await materias.editar(1, { nombre: 'Cálculo II', color: '#ff5a3c', horasSemanales: 6 }), true)
  assert.deepEqual(llamadas.at(-1).cuerpo, { nombre: 'Cálculo II' })
  assert.equal(materias.lista[0].nombre, 'Cálculo II')
})

test('editar sin cambios no llama a la API', async () => {
  responder('GET /api/materias', ok([materia()]))
  await materias.cargar()
  assert.equal(await materias.editar(1, { nombre: 'Cálculo', color: '#ff5a3c', horasSemanales: 6 }), true)
  assert.equal(llamadas.length, 1) // solo el GET
})

test('editar con nombre repetido muestra el error y no cambia la lista', async () => {
  responder('GET /api/materias', ok([materia()]))
  await materias.cargar()
  responder('PATCH /api/materias/1', falla(409, 'Ya tienes una materia con ese nombre'))

  assert.equal(await materias.editar(1, { nombre: 'Física', color: '#ff5a3c', horasSemanales: 6 }), false)
  assert.equal(materias.error, 'Ya tienes una materia con ese nombre')
  assert.equal(materias.lista[0].nombre, 'Cálculo')
})

test('eliminar quita la materia de la lista', async () => {
  responder('GET /api/materias', ok([materia(), materia({ id: 2, nombre: 'Física' })]))
  await materias.cargar()
  responder('DELETE /api/materias/1', ok(undefined, 204))

  assert.equal(await materias.eliminar(1), true)
  assert.deepEqual(
    materias.lista.map((m) => m.id),
    [2],
  )
})

test('si tiene una sesión en curso no se borra y se muestra el aviso', async () => {
  responder('GET /api/materias', ok([materia()]))
  await materias.cargar()
  const aviso = 'Tienes una sesión en curso en esta materia: termínala o cancélala antes de borrarla'
  responder('DELETE /api/materias/1', falla(409, aviso))

  assert.equal(await materias.eliminar(1), false)
  assert.equal(materias.error, aviso)
  assert.equal(materias.lista.length, 1)
})

test('al cerrar sesión se borran las materias de la persona anterior', async () => {
  responder('GET /api/materias', ok([materia()]))
  await materias.cargar()
  auth.cerrarSesion()
  assert.equal(materias.lista.length, 0)
  assert.equal(materias.cargada, false)
})
