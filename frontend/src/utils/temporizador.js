// Lógica de tiempo del temporizador. Todo se calcula con marcas de tiempo (ms desde 1970),
// nunca contando ticks de setInterval: si la pestaña se duerme, el resultado sigue siendo exacto (RNF-07).

export const POMODORO_SEG = 25 * 60
export const DESCANSO_CORTO_SEG = 5 * 60
export const DESCANSO_LARGO_POR_DEFECTO_MIN = 15
export const POMODOROS_PARA_DESCANSO_LARGO = 4
export const MS_CELEBRACION = 4000

// Reloj reemplazable: las pruebas lo controlan para simular el paso del tiempo.
export const reloj = { ahora: () => Date.now() }

/** Milisegundos que faltan para `finMs` (nunca negativo). */
export function restanteMs(finMs, ahoraMs) {
  return Math.max(0, finMs - ahoraMs)
}

/** Segundos que le faltan a un pomodoro que ya acumuló `segundosEfectivos` de estudio. */
export function restanteDelPomodoroSeg(segundosEfectivos) {
  return Math.max(0, POMODORO_SEG - segundosEfectivos)
}

/** "24:59": se redondea hacia arriba para que 00:00 aparezca solo cuando de verdad terminó. */
export function formatear(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** RF-10: descanso corto de 5 min; largo (15 a 30 min del usuario) tras 4 pomodoros seguidos. */
export function descansoQueToca(completados, descansoLargoMin = DESCANSO_LARGO_POR_DEFECTO_MIN) {
  if (completados >= POMODOROS_PARA_DESCANSO_LARGO) {
    return { tipo: 'largo', duracionMs: descansoLargoMin * 60 * 1000 }
  }
  return { tipo: 'corto', duracionMs: DESCANSO_CORTO_SEG * 1000 }
}
