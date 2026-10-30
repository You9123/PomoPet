import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { ApiError, api } from '../api/cliente.js'
import { useAuthStore } from './auth.js'

export const MIN_APUNTES = 200
export const MAX_APUNTES = 8000

const CLAVE_SESION = 'pomopet.quiz.sesion'

function leerSesion() {
  try {
    return Number(localStorage.getItem(CLAVE_SESION)) || null
  } catch {
    return null
  }
}

function guardarSesion(id) {
  try {
    if (id) localStorage.setItem(CLAVE_SESION, String(id))
    else localStorage.removeItem(CLAVE_SESION)
  } catch {
    // sin almacenamiento: el quiz se pierde al recargar, pero sigue en el servidor
  }
}

/**
 * Quiz contra el Jefe Final (RF-15, RF-16, issue #42). Ver docs/ia.md.
 *
 * paso: null (cerrado) → apuntes → preguntas → resultado
 *
 * La API nunca manda las respuestas correctas antes de corregir. Los apuntes solo viven en el
 * componente: no se guardan aquí ni en el navegador.
 */
export const useQuizStore = defineStore('quiz', () => {
  const auth = useAuthStore()

  const paso = ref(null)
  const sesionId = ref(null)
  const preguntas = ref([]) // [{ enunciado, opciones }]
  const respuestas = ref([]) // índice elegido en cada pregunta
  const actual = ref(0)
  const resultado = ref(null) // { aciertos, correctas, dano_extra, jefe }
  const cargando = ref(false)
  const error = ref('')

  const pregunta = computed(() => preguntas.value[actual.value] ?? null)

  function abrir(id) {
    limpiar()
    sesionId.value = id
    paso.value = 'apuntes'
  }

  function mostrarPreguntas(quiz) {
    preguntas.value = quiz.preguntas
    respuestas.value = []
    actual.value = 0
    paso.value = 'preguntas'
    guardarSesion(sesionId.value)
  }

  /** Crea el quiz. Si la IA falla, devuelve false y se puede reintentar con los mismos apuntes. */
  async function generar(apuntes) {
    if (cargando.value) return false
    cargando.value = true
    error.value = ''
    try {
      mostrarPreguntas(
        await api(`/api/sesiones/${sesionId.value}/quiz`, { metodo: 'POST', cuerpo: { apuntes } }),
      )
      return true
    } catch (e) {
      error.value =
        e instanceof ApiError && e.status === 503
          ? 'La IA no está disponible en este momento. Inténtalo de nuevo: tus apuntes siguen aquí.'
          : e instanceof ApiError
            ? e.message
            : 'Ocurrió un error inesperado'
      return false
    } finally {
      cargando.value = false
    }
  }

  /** Retoma un quiz sin responder al recargar la página. */
  async function retomar() {
    const id = leerSesion()
    if (!id || paso.value) return
    try {
      const quiz = await api(`/api/sesiones/${id}/quiz`)
      if (quiz.respondido) {
        guardarSesion(null)
        return
      }
      sesionId.value = id
      mostrarPreguntas(quiz)
    } catch (e) {
      // 404: ya no existe. Con otro error (sin conexión) se conserva para la próxima carga.
      if (e instanceof ApiError && e.status === 404) guardarSesion(null)
    }
  }

  /** Guarda la opción elegida y pasa a la siguiente pregunta; con la última, corrige. */
  async function responder(opcion) {
    if (cargando.value) return false
    respuestas.value[actual.value] = opcion
    if (actual.value < preguntas.value.length - 1) {
      actual.value += 1
      return true
    }
    cargando.value = true
    error.value = ''
    try {
      resultado.value = await api(`/api/sesiones/${sesionId.value}/quiz/respuestas`, {
        metodo: 'POST',
        cuerpo: { respuestas: respuestas.value },
      })
      paso.value = 'resultado'
      guardarSesion(null)
      return true
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
      return false
    } finally {
      cargando.value = false
    }
  }

  function limpiar() {
    paso.value = null
    sesionId.value = null
    preguntas.value = []
    respuestas.value = []
    actual.value = 0
    resultado.value = null
    error.value = ''
  }

  /** Cerrar el panel. Un quiz sin responder se puede retomar al recargar. */
  function cerrar() {
    limpiar()
  }

  // Al cerrar sesión no debe quedar el quiz de la persona anterior
  watch(
    () => auth.autenticado,
    (autenticado) => {
      if (!autenticado) {
        limpiar()
        guardarSesion(null)
      }
    },
    { flush: 'sync' },
  )

  return {
    paso,
    sesionId,
    preguntas,
    respuestas,
    actual,
    pregunta,
    resultado,
    cargando,
    error,
    abrir,
    generar,
    retomar,
    responder,
    cerrar,
  }
})
