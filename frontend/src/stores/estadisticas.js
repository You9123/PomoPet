import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { ApiError, api } from '../api/cliente.js'
import { PERIODOS, ZONA_POR_DEFECTO, zonaDelNavegador } from '../utils/estadisticas.js'
import { useAuthStore } from './auth.js'

export const POR_PAGINA = 10

/**
 * Panel de estadísticas (RF-08, issue #11): resumen, minutos por día e historial de sesiones.
 * Ver docs/estadisticas.md. Cada acción devuelve true si salió bien; si falla, el mensaje queda en `error`.
 */
export const useEstadisticasStore = defineStore('estadisticas', () => {
  const auth = useAuthStore()

  // { resumen: {...}, por_materia: [...], por_dia: { zona, dias, series, completados, cancelados } }
  const datos = ref(null)
  const periodo = ref(PERIODOS[0]) // días del gráfico
  const historial = ref({ total: 0, pagina: 1, por_pagina: POR_PAGINA, sesiones: [] })
  const filtro = ref(null) // null (todas) | 'completada' | 'cancelada'
  const cargando = ref(false)
  const cargandoHistorial = ref(false)
  const error = ref('')

  async function ejecutar(bandera, accion) {
    bandera.value = true
    error.value = ''
    try {
      await accion()
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
      return false
    } finally {
      bandera.value = false
    }
    return true
  }

  async function cargar() {
    return ejecutar(cargando, async () => {
      const pedir = (zona) => api(`/api/estadisticas?${new URLSearchParams({ dias: periodo.value, zona })}`)
      const zona = zonaDelNavegador()
      try {
        datos.value = await pedir(zona)
      } catch (e) {
        // Un navegador con una zona que PostgreSQL no conoce: se usa la de Costa Rica
        if (!(e instanceof ApiError) || e.status !== 422 || zona === ZONA_POR_DEFECTO) throw e
        datos.value = await pedir(ZONA_POR_DEFECTO)
      }
    })
  }

  async function cambiarPeriodo(dias) {
    if (dias === periodo.value) return true
    periodo.value = dias
    return cargar()
  }

  async function cargarHistorial(pagina = 1) {
    return ejecutar(cargandoHistorial, async () => {
      const params = new URLSearchParams({ pagina, por_pagina: POR_PAGINA })
      if (filtro.value) params.set('estado', filtro.value)
      historial.value = await api(`/api/estadisticas/historial?${params}`)
    })
  }

  async function cambiarFiltro(estado) {
    filtro.value = estado
    return cargarHistorial(1)
  }

  /** Todo el panel de una vez (al abrir la pantalla). */
  async function cargarTodo() {
    const [a, b] = await Promise.all([cargar(), cargarHistorial(historial.value.pagina)])
    return a && b
  }

  function reiniciar() {
    datos.value = null
    periodo.value = PERIODOS[0]
    historial.value = { total: 0, pagina: 1, por_pagina: POR_PAGINA, sesiones: [] }
    filtro.value = null
    error.value = ''
  }

  // Al cerrar sesión no deben quedar las estadísticas de la persona anterior
  watch(
    () => auth.autenticado,
    (autenticado) => {
      if (!autenticado) reiniciar()
    },
    { flush: 'sync' },
  )

  return {
    datos,
    periodo,
    historial,
    filtro,
    cargando,
    cargandoHistorial,
    error,
    cargar,
    cambiarPeriodo,
    cargarHistorial,
    cambiarFiltro,
    cargarTodo,
    reiniciar,
  }
})
