import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { api, configurarCliente } from '../api/cliente.js'
import { DESCANSO_LARGO_POR_DEFECTO_MIN } from '../utils/temporizador.js'

const CLAVE_TOKEN = 'pomopet.token'

// localStorage puede fallar (modo privado, datos bloqueados): la app debe funcionar sin él.
function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

function guardarToken(valor) {
  try {
    if (valor) localStorage.setItem(CLAVE_TOKEN, valor)
    else localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    // sin almacenamiento: la sesión dura hasta recargar la página
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(leerToken())
  const perfil = ref(null) // { id, correo, descanso_largo_min, mascota: { nombre, especie, especie_nombre } }
  const especies = ref([])

  const autenticado = computed(() => Boolean(token.value))
  const especieCodigo = computed(() => perfil.value?.mascota?.especie ?? null)
  const descansoLargoMin = computed(
    () => perfil.value?.descanso_largo_min ?? DESCANSO_LARGO_POR_DEFECTO_MIN,
  )

  function fijarToken(valor) {
    token.value = valor
    guardarToken(valor)
  }

  function cerrarSesion() {
    fijarToken(null)
    perfil.value = null
  }

  configurarCliente({ token: () => token.value, noAutorizado: cerrarSesion })

  async function cargarPerfil() {
    perfil.value = await api('/api/me')
  }

  async function cargarEspecies() {
    especies.value = await api('/api/especies')
  }

  async function iniciarSesion(correo, password) {
    const r = await api('/api/auth/login', { metodo: 'POST', cuerpo: { correo, password } })
    fijarToken(r.access_token)
    await cargarPerfil()
  }

  async function registrar({ correo, password, especieId, nombreMascota }) {
    const r = await api('/api/auth/registro', {
      metodo: 'POST',
      cuerpo: { correo, password, especie_id: especieId, nombre_mascota: nombreMascota },
    })
    fijarToken(r.access_token)
    await cargarPerfil()
  }

  return {
    token,
    perfil,
    especies,
    autenticado,
    especieCodigo,
    descansoLargoMin,
    cargarPerfil,
    cargarEspecies,
    iniciarSesion,
    registrar,
    cerrarSesion,
  }
})
