import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { ApiError, api } from '../api/cliente.js'
import { useAuthStore } from './auth.js'

/**
 * Consejo de la mascota (RF-14, issue #41). Ver docs/ia.md.
 * La API responde { texto, origen, creado_en, restantes }; `texto` es null si todavía no hay consejos.
 */
export const useCoachStore = defineStore('coach', () => {
  const auth = useAuthStore()

  const texto = ref(null)
  const restantes = ref(null) // consejos que quedan hoy; null = todavía no se sabe
  const cargando = ref(false)
  const error = ref('')

  function aplicar(respuesta) {
    texto.value = respuesta.texto
    restantes.value = respuesta.restantes
  }

  /** Último consejo al entrar. Si falla no se avisa: el coach nunca debe estorbar al temporizador. */
  async function cargar() {
    try {
      aplicar(await api('/api/coach/consejo'))
    } catch {
      // sin conexión: se queda como está
    }
  }

  async function pedir() {
    if (cargando.value || restantes.value === 0) return false
    cargando.value = true
    error.value = ''
    try {
      aplicar(await api('/api/coach/consejo', { metodo: 'POST' }))
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) restantes.value = 0
      error.value = e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
      return false
    } finally {
      cargando.value = false
    }
  }

  function reiniciar() {
    texto.value = null
    restantes.value = null
    error.value = ''
  }

  // Al cerrar sesión no deben quedar los consejos de la persona anterior
  watch(
    () => auth.autenticado,
    (autenticado) => {
      if (!autenticado) reiniciar()
    },
    { flush: 'sync' },
  )

  return { texto, restantes, cargando, error, cargar, pedir, reiniciar }
})
