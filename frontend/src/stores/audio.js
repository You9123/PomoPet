import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

// Pistas del reproductor (RF-07). Los WAV se generan con `npm run audio` (ver docs/audio.md).
export const PISTAS = [
  { codigo: 'lluvia', nombre: 'Lluvia', archivo: '/audio/lluvia.wav' },
  { codigo: 'lofi', nombre: 'Lo-Fi', archivo: '/audio/lofi.wav' },
  { codigo: 'ruido-blanco', nombre: 'Ruido blanco', archivo: '/audio/ruido-blanco.wav' },
]
export const VOLUMEN_POR_DEFECTO = 0.5

const CLAVE_PREFERENCIAS = 'pomopet.audio'

// Reproductor reemplazable: las pruebas usan uno falso (en Node no existe `Audio`).
export const fabrica = { crear: (src) => new Audio(src) }

const esPista = (codigo) => PISTAS.some((p) => p.codigo === codigo)
const acotar = (v) => Math.min(1, Math.max(0, v))

function leerPreferencias() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS)) ?? {}
    return {
      pista: esPista(guardado.pista) ? guardado.pista : PISTAS[0].codigo,
      volumen: Number.isFinite(guardado.volumen) ? acotar(guardado.volumen) : VOLUMEN_POR_DEFECTO,
    }
  } catch {
    return { pista: PISTAS[0].codigo, volumen: VOLUMEN_POR_DEFECTO }
  }
}

/**
 * Reproductor de audio ambiental (RF-07): una pista en bucle con reproducir, pausar y volumen.
 * La pista elegida y el volumen se recuerdan en el navegador. El audio es independiente del
 * temporizador: sigue sonando al cambiar de pantalla y se detiene al cerrar sesión.
 */
export const useAudioStore = defineStore('audio', () => {
  const preferencias = leerPreferencias()
  const pistaCodigo = ref(preferencias.pista)
  const volumen = ref(preferencias.volumen) // 0 a 1
  const reproduciendo = ref(false)
  const error = ref('')
  let elemento = null // <audio> de la pista actual; se crea al reproducir por primera vez

  const pista = computed(() => PISTAS.find((p) => p.codigo === pistaCodigo.value))

  function guardarPreferencias() {
    try {
      localStorage.setItem(
        CLAVE_PREFERENCIAS,
        JSON.stringify({ pista: pistaCodigo.value, volumen: volumen.value }),
      )
    } catch {
      // sin almacenamiento: se usan los valores por defecto al recargar
    }
  }

  function obtenerElemento() {
    if (!elemento) {
      const nuevo = fabrica.crear(pista.value.archivo)
      nuevo.loop = true
      nuevo.volume = volumen.value
      // Si el navegador lo pausa por su cuenta (p. ej. teclas multimedia), el botón se entera.
      // Solo cuenta el elemento actual: uno viejo que se pausa al cambiar de pista no afecta.
      nuevo.addEventListener('pause', () => {
        if (nuevo === elemento) reproduciendo.value = false
      })
      nuevo.addEventListener('play', () => {
        if (nuevo === elemento) reproduciendo.value = true
      })
      elemento = nuevo
    }
    return elemento
  }

  function soltarElemento() {
    if (!elemento) return
    const viejo = elemento
    elemento = null
    viejo.pause()
  }

  async function reproducir() {
    error.value = ''
    const actual = obtenerElemento()
    actual.volume = volumen.value
    try {
      await actual.play()
      if (actual === elemento) reproduciendo.value = true
    } catch (e) {
      if (actual !== elemento || e?.name === 'AbortError') return // se pausó o cambió de pista antes
      reproduciendo.value = false
      error.value = 'No se pudo reproducir el sonido. Inténtalo de nuevo.'
    }
  }

  function pausar() {
    elemento?.pause()
    reproduciendo.value = false
  }

  function alternar() {
    return reproduciendo.value ? pausar() : reproducir()
  }

  /** Cambia de pista; si estaba sonando, la nueva empieza a sonar enseguida. */
  async function elegir(codigo) {
    if (!esPista(codigo) || codigo === pistaCodigo.value) return
    const seguia = reproduciendo.value
    soltarElemento()
    reproduciendo.value = false
    pistaCodigo.value = codigo
    guardarPreferencias()
    if (seguia) await reproducir()
  }

  function cambiarVolumen(valor) {
    const v = Number(valor)
    if (!Number.isFinite(v)) return
    volumen.value = acotar(v)
    if (elemento) elemento.volume = volumen.value
    guardarPreferencias()
  }

  /** Al cerrar sesión: silencio y se libera el audio. Las preferencias se conservan. */
  function detener() {
    soltarElemento()
    reproduciendo.value = false
    error.value = ''
  }

  return {
    pistaCodigo,
    pista,
    volumen,
    reproduciendo,
    error,
    reproducir,
    pausar,
    alternar,
    elegir,
    cambiarVolumen,
    detener,
  }
})
