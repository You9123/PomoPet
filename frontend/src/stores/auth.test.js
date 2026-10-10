import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { useAuthStore } from './auth.js'

let peticiones

globalThis.fetch = async (url, opciones = {}) => {
  const ruta = new URL(url).pathname
  peticiones.push({ ruta, metodo: opciones.method, cuerpo: opciones.body ? JSON.parse(opciones.body) : null })
  const json =
    ruta === '/api/auth/registro'
      ? { access_token: 'token-nuevo', token_type: 'bearer' }
      : {
          id: 1,
          correo: 'ana@una.ac.cr',
          descanso_largo_min: 20,
          mascota: {
            nombre: 'Brasas',
            especie: 'dragon',
            especie_nombre: 'Dragón',
            variante: 'fuego',
            variante_nombre: 'Fuego',
          },
        }
  return { ok: true, status: 200, json: async () => json }
}

beforeEach(() => {
  peticiones = []
  setActivePinia(createPinia())
})

test('el registro envía el color elegido', async () => {
  const auth = useAuthStore()
  await auth.registrar({
    correo: 'ana@una.ac.cr',
    password: 'Pomodoro25',
    especieId: 3,
    variante: 'fuego',
    nombreMascota: 'Brasas',
  })
  const registro = peticiones.find((p) => p.ruta === '/api/auth/registro')
  assert.equal(registro.cuerpo.variante, 'fuego')
  assert.equal(registro.cuerpo.especie_id, 3)
})

test('sin elegir color se envía el clásico', async () => {
  const auth = useAuthStore()
  await auth.registrar({ correo: 'a@b.cr', password: 'Pomodoro25', especieId: 1, nombreMascota: 'Michi' })
  assert.equal(peticiones.find((p) => p.ruta === '/api/auth/registro').cuerpo.variante, 'clasico')
})

test('el perfil expone el color de la mascota', async () => {
  const auth = useAuthStore()
  await auth.cargarPerfil()
  assert.equal(auth.especieCodigo, 'dragon')
  assert.equal(auth.varianteCodigo, 'fuego')
})

test('sin perfil el color por defecto es el clásico', () => {
  assert.equal(useAuthStore().varianteCodigo, 'clasico')
})
