import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { ApiError, api } from '../api/cliente.js'
import { useAuthStore } from './auth.js'
import {
  MS_CELEBRACION,
  POMODORO_SEG,
  descansoQueToca,
  reloj,
  restanteDelPomodoroSeg,
  restanteMs as calcularRestanteMs,
} from '../utils/temporizador.js'

const CLAVE_COMPLETADOS = 'pomopet.completados'
const REINTENTOS_FINALIZAR = 4
const ESPERA_REINTENTO_MS = 1000
const ESPERA_TRAS_FALLO_MS = 5000

function leerCompletados() {
  try {
    return Number(localStorage.getItem(CLAVE_COMPLETADOS)) || 0
  } catch {
    return 0
  }
}

function guardarCompletados(n) {
  try {
    localStorage.setItem(CLAVE_COMPLETADOS, String(n))
  } catch {
    // sin almacenamiento: el contador se reinicia al recargar
  }
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

/**
 * Estado global del temporizador (RF-01, RF-10, RNF-07).
 *
 * fase: inactivo → estudiando ⇄ pausado → exito → descanso → inactivo
 *                       └→ cancelado → inactivo
 *
 * El servidor es quien manda: cada respuesta trae `segundos_efectivos` (tiempo estudiado sin
 * pausas). Con eso se calcula `finMs`, la marca de tiempo local en la que terminará el pomodoro.
 * El reloj en pantalla es `finMs - ahora`, de modo que un setInterval retrasado no desvía la hora.
 */
export const usePomodoroStore = defineStore('pomodoro', () => {
  const auth = useAuthStore()

  const fase = ref('inactivo')
  const sesion = ref(null) // última sesión devuelta por la API
  const materiaId = ref(null)
  const completados = ref(leerCompletados()) // pomodoros seguidos, para el descanso largo
  const descansoTipo = ref(null) // 'corto' | 'largo'
  const error = ref('')
  const ocupado = ref(false)

  const ahora = ref(reloj.ahora())
  const finMs = ref(0) // estudiando: cuándo termina el pomodoro
  const restantePausadoMs = ref(0) // pausado: tiempo congelado
  const finCelebracionMs = ref(0) // exito: cuándo empieza el descanso
  const finDescansoMs = ref(0) // descanso: cuándo termina
  const duracionDescansoMs = ref(0) // descanso: cuánto dura en total (para la barra)
  const noReintentarAntesDe = ref(0)

  let intervalo = null
  let finalizando = false

  const restanteMs = computed(() => {
    switch (fase.value) {
      case 'estudiando':
        return calcularRestanteMs(finMs.value, ahora.value)
      case 'pausado':
        return restantePausadoMs.value
      case 'descanso':
        return calcularRestanteMs(finDescansoMs.value, ahora.value)
      case 'exito':
        return 0
      default:
        return POMODORO_SEG * 1000
    }
  })

  /** 0 a 1: cuánto del pomodoro o del descanso ya pasó (barra de progreso). */
  const progreso = computed(() => {
    switch (fase.value) {
      case 'estudiando':
      case 'pausado':
        return (POMODORO_SEG * 1000 - restanteMs.value) / (POMODORO_SEG * 1000)
      case 'descanso':
        return duracionDescansoMs.value
          ? (duracionDescansoMs.value - restanteMs.value) / duracionDescansoMs.value
          : 0
      case 'exito':
        return 1
      default:
        return 0
    }
  })

  const puedeIniciar = computed(
    () => fase.value === 'inactivo' && Number.isInteger(materiaId.value) && materiaId.value > 0,
  )

  // ---------- Reloj ----------

  function tick() {
    const t = reloj.ahora()
    ahora.value = t
    if (fase.value === 'estudiando' && t >= finMs.value && t >= noReintentarAntesDe.value) {
      finalizar()
    } else if (fase.value === 'exito' && t >= finCelebracionMs.value) {
      empezarDescanso()
    } else if (fase.value === 'descanso' && t >= finDescansoMs.value) {
      terminarDescanso()
    }
  }

  function arrancarReloj() {
    if (intervalo !== null) return
    intervalo = setInterval(tick, 250)
    // al volver a la pestaña se recalcula al instante, sin esperar al siguiente tick
    document.addEventListener('visibilitychange', tick)
  }

  function detenerReloj() {
    if (intervalo === null) return
    clearInterval(intervalo)
    intervalo = null
    document.removeEventListener('visibilitychange', tick)
  }

  // ---------- Sincronización con la API ----------

  /** Traduce la sesión del servidor a fase + marcas de tiempo locales. */
  function aplicarSesion(s) {
    sesion.value = s
    if (!s || s.estado !== 'en_curso') return
    const restanteSeg = restanteDelPomodoroSeg(s.segundos_efectivos)
    if (s.pausada) {
      fase.value = 'pausado'
      restantePausadoMs.value = restanteSeg * 1000
    } else {
      fase.value = 'estudiando'
      finMs.value = reloj.ahora() + restanteSeg * 1000
    }
  }

  async function ejecutar(accion) {
    ocupado.value = true
    error.value = ''
    try {
      await accion()
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
      return false
    } finally {
      ocupado.value = false
    }
    return true
  }

  /** Retoma una sesión que quedó en curso (al abrir o recargar la página). */
  async function recuperar() {
    if (!auth.autenticado) return
    try {
      const s = await api('/api/sesiones/actual')
      if (s) {
        materiaId.value = s.materia_id
        aplicarSesion(s)
      } else if (fase.value === 'estudiando' || fase.value === 'pausado') {
        fase.value = 'inactivo'
        sesion.value = null
      }
    } catch {
      // sin conexión: se queda como está
    }
  }

  async function iniciar() {
    if (!puedeIniciar.value) return
    const ok = await ejecutar(async () => {
      const s = await api('/api/sesiones', { metodo: 'POST', cuerpo: { materia_id: materiaId.value } })
      aplicarSesion(s)
    })
    // 409: ya había una sesión en curso (otra pestaña): retomarla
    if (!ok && error.value.includes('en curso')) {
      await recuperar()
      if (fase.value !== 'inactivo') error.value = ''
    }
  }

  async function pausar() {
    if (fase.value !== 'estudiando') return
    await ejecutar(async () => {
      aplicarSesion(await api(`/api/sesiones/${sesion.value.id}/pausar`, { metodo: 'POST' }))
    })
  }

  async function reanudar() {
    if (fase.value !== 'pausado') return
    await ejecutar(async () => {
      aplicarSesion(await api(`/api/sesiones/${sesion.value.id}/reanudar`, { metodo: 'POST' }))
    })
  }

  async function cancelar() {
    if (fase.value !== 'estudiando' && fase.value !== 'pausado') return
    const ok = await ejecutar(async () => {
      sesion.value = await api(`/api/sesiones/${sesion.value.id}/cancelar`, { metodo: 'POST' })
    })
    if (ok) {
      completados.value = 0 // interrumpir rompe la racha de 4 pomodoros
      guardarCompletados(0)
      fase.value = 'cancelado'
    }
  }

  /** Se dispara sola cuando el reloj llega a 0. El servidor valida los 25 minutos (RF-09). */
  async function finalizar() {
    if (finalizando || !sesion.value) return
    finalizando = true
    try {
      for (let intento = 1; intento <= REINTENTOS_FINALIZAR; intento++) {
        try {
          sesion.value = await api(`/api/sesiones/${sesion.value.id}/finalizar`, { metodo: 'POST' })
          completados.value += 1
          guardarCompletados(completados.value)
          fase.value = 'exito'
          finCelebracionMs.value = reloj.ahora() + MS_CELEBRACION
          return
        } catch (e) {
          // 409 = al servidor le faltan milisegundos por la latencia: se reintenta enseguida
          if (e instanceof ApiError && e.status === 409 && intento < REINTENTOS_FINALIZAR) {
            await esperar(ESPERA_REINTENTO_MS)
            continue
          }
          throw e
        }
      }
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'No se pudo finalizar la sesión'
      noReintentarAntesDe.value = reloj.ahora() + ESPERA_TRAS_FALLO_MS
      await recuperar() // vuelve a alinear el reloj con lo que dice el servidor
    } finally {
      finalizando = false
    }
  }

  // ---------- Descansos (RF-10), solo locales ----------

  function empezarDescanso() {
    const { tipo, duracionMs } = descansoQueToca(completados.value, auth.descansoLargoMin)
    if (tipo === 'largo') {
      completados.value = 0
      guardarCompletados(0)
    }
    descansoTipo.value = tipo
    duracionDescansoMs.value = duracionMs
    finDescansoMs.value = reloj.ahora() + duracionMs
    fase.value = 'descanso'
  }

  function terminarDescanso() {
    fase.value = 'inactivo'
    descansoTipo.value = null
    sesion.value = null
  }

  function volverAlInicio() {
    fase.value = 'inactivo'
    descansoTipo.value = null
    sesion.value = null
    error.value = ''
  }

  function reiniciarTodo() {
    detenerReloj()
    volverAlInicio()
    materiaId.value = null
    completados.value = 0 // la racha es de cada persona: no se hereda al cambiar de cuenta
    guardarCompletados(0)
  }

  // Al cerrar sesión (botón Salir o token vencido) se limpia todo lo de la persona anterior
  watch(
    () => auth.autenticado,
    (autenticado) => {
      if (!autenticado) reiniciarTodo()
    },
    { flush: 'sync' },
  )

  return {
    fase,
    sesion,
    materiaId,
    completados,
    descansoTipo,
    error,
    ocupado,
    restanteMs,
    progreso,
    puedeIniciar,
    tick,
    arrancarReloj,
    detenerReloj,
    recuperar,
    iniciar,
    pausar,
    reanudar,
    cancelar,
    saltarDescanso: terminarDescanso,
    volverAlInicio,
    reiniciarTodo,
  }
})
