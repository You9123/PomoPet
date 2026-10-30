import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { ApiError, api } from '../api/cliente.js'
import { useAuthStore } from './auth.js'

// RF-02. El backend también lo valida (409); aquí sirve para avisar antes de llenar el formulario.
export const MAX_MATERIAS = 20

// Colores que se proponen al crear una materia, en orden. Se usa el primero que no esté ocupado.
export const COLORES_SUGERIDOS = ['#ff5a3c', '#3ee6b0', '#4cc9f0', '#ffd23f', '#ff7ac6', '#7c5cff']

/** Primer color sugerido que ninguna materia usa todavía (si todos están usados, vuelve a empezar). */
export function sugerirColor(materias) {
  const usados = new Set(materias.map((m) => m.color.toLowerCase()))
  return COLORES_SUGERIDOS.find((c) => !usados.has(c)) ?? COLORES_SUGERIDOS[materias.length % COLORES_SUGERIDOS.length]
}

/** El campo de horas vacío significa "sin horas" (null), no 0. */
export function horasDe(valor) {
  if (valor === '' || valor === null || valor === undefined) return null
  return Number(valor)
}

/** Para el PATCH: solo los campos del formulario que son distintos a la materia guardada. */
export function cambiosDe(materia, formulario) {
  const cambios = {}
  const nombre = formulario.nombre.trim()
  if (nombre !== materia.nombre) cambios.nombre = nombre
  if (formulario.color.toLowerCase() !== materia.color.toLowerCase()) cambios.color = formulario.color
  const horas = horasDe(formulario.horasSemanales)
  if (horas !== materia.horas_semanales) cambios.horas_semanales = horas
  return cambios
}

/**
 * Materias del usuario (RF-02), con su progreso: pomodoros, minutos y XP (ver docs/materias.md).
 *
 * Cada acción devuelve true si salió bien. Si falla, el mensaje del backend queda en `error`
 * (tope de 20, nombre repetido, sesión en curso al borrar...) y la lista no cambia.
 */
export const useMateriasStore = defineStore('materias', () => {
  const auth = useAuthStore()

  // [{ id, nombre, color, horas_semanales, creado_en, pomodoros_completados, pomodoros_cancelados, minutos_estudiados, xp }]
  const lista = ref([])
  const cargada = ref(false) // ya se pidió la lista al menos una vez
  const error = ref('')
  const ocupado = ref(false)

  const lleno = computed(() => lista.value.length >= MAX_MATERIAS)

  function buscar(id) {
    return lista.value.find((m) => m.id === id) ?? null
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

  async function cargar() {
    return ejecutar(async () => {
      lista.value = await api('/api/materias')
      cargada.value = true
    })
  }

  async function crear({ nombre, color, horasSemanales }) {
    return ejecutar(async () => {
      const nueva = await api('/api/materias', {
        metodo: 'POST',
        cuerpo: { nombre: nombre.trim(), color, horas_semanales: horasDe(horasSemanales) },
      })
      lista.value = [...lista.value, nueva]
    })
  }

  async function editar(id, formulario) {
    const materia = buscar(id)
    if (!materia) return false
    const cambios = cambiosDe(materia, formulario)
    if (Object.keys(cambios).length === 0) return true // nada que guardar
    return ejecutar(async () => {
      const editada = await api(`/api/materias/${id}`, { metodo: 'PATCH', cuerpo: cambios })
      lista.value = lista.value.map((m) => (m.id === id ? editada : m))
    })
  }

  /** Borra la materia con sus sesiones y Jefes (el backend responde 409 si tiene una sesión en curso). */
  async function eliminar(id) {
    return ejecutar(async () => {
      await api(`/api/materias/${id}`, { metodo: 'DELETE' })
      lista.value = lista.value.filter((m) => m.id !== id)
    })
  }

  function limpiarError() {
    error.value = ''
  }

  function reiniciar() {
    lista.value = []
    cargada.value = false
    error.value = ''
  }

  // Al cerrar sesión no deben quedar las materias de la persona anterior
  watch(
    () => auth.autenticado,
    (autenticado) => {
      if (!autenticado) reiniciar()
    },
    { flush: 'sync' },
  )

  return {
    lista,
    cargada,
    error,
    ocupado,
    lleno,
    buscar,
    cargar,
    crear,
    editar,
    eliminar,
    limpiarError,
    reiniciar,
  }
})
