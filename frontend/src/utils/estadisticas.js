// Funciones puras del panel de estadísticas (issue #11). No dependen de Vue ni de Chart.js,
// así que se prueban con `npm test` (estadisticas.test.js).

export const ZONA_POR_DEFECTO = 'America/Costa_Rica'
export const PERIODOS = [7, 30] // días que se pueden elegir en el gráfico

/** Zona horaria del navegador (IANA), para que el backend cuente los días en la hora local. */
export function zonaDelNavegador() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ZONA_POR_DEFECTO
  } catch {
    return ZONA_POR_DEFECTO
  }
}

/** 0 → "0 min", 45 → "45 min", 120 → "2 h", 125 → "2 h 05 min". */
export function formatearMinutos(minutos) {
  const total = Math.max(0, Math.round(Number(minutos) || 0))
  const horas = Math.floor(total / 60)
  const resto = total % 60
  if (horas === 0) return `${resto} min`
  if (resto === 0) return `${horas} h`
  return `${horas} h ${String(resto).padStart(2, '0')} min`
}

/** Segundos → "mm:ss" (o "h:mm:ss" si pasa de una hora). */
export function formatearDuracion(segundos) {
  const total = Math.max(0, Math.floor(Number(segundos) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const dos = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`
}

/**
 * "2026-10-28" es un día del calendario, no un instante: se arma la fecha con la hora local para que
 * `new Date("2026-10-28")` (que es medianoche UTC) no se convierta en el 27 en Costa Rica.
 */
export function fechaDeDia(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/** Etiqueta del eje X: con 7 días "lun 27"; con más días solo "27/10" para que quepan. */
export function etiquetaDia(iso, totalDias) {
  const fecha = fechaDeDia(iso)
  if (totalDias <= 7) {
    const semana = fecha.toLocaleDateString('es-CR', { weekday: 'short' }).replace('.', '')
    return `${semana} ${fecha.getDate()}`
  }
  return `${fecha.getDate()}/${fecha.getMonth() + 1}`
}

/** Fecha y hora de una sesión para el historial: "mar 28 oct, 11:30 p. m.". */
export function fechaSesion(instante) {
  return new Date(instante).toLocaleString('es-CR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Total de minutos del periodo (todas las materias). */
export function minutosDelPeriodo(porDia) {
  return (porDia?.series ?? []).reduce((suma, s) => suma + s.minutos.reduce((a, b) => a + b, 0), 0)
}

/**
 * `por_dia` del backend → `data` de Chart.js: una barra apilada por materia, con el color de la materia.
 */
export function datosGrafico(porDia) {
  const dias = porDia?.dias ?? []
  return {
    labels: dias.map((d) => etiquetaDia(d, dias.length)),
    datasets: (porDia?.series ?? []).map((s) => ({
      label: s.nombre,
      data: s.minutos,
      backgroundColor: s.color,
      hoverBackgroundColor: s.color,
      borderWidth: 0,
      borderRadius: 0, // pixel art: esquinas rectas
      stack: 'minutos',
    })),
  }
}

/** Texto para lectores de pantalla: el canvas del gráfico no se puede leer. */
export function descripcionGrafico(porDia) {
  const dias = porDia?.dias?.length ?? 0
  const total = minutosDelPeriodo(porDia)
  if (total === 0) return `Sin minutos estudiados en los últimos ${dias} días`
  const partes = (porDia.series ?? []).map(
    (s) => `${s.nombre}: ${formatearMinutos(s.minutos.reduce((a, b) => a + b, 0))}`,
  )
  return `Minutos estudiados en los últimos ${dias} días: ${formatearMinutos(total)}. ${partes.join(', ')}.`
}

/** Cuántas páginas tiene el historial (al menos 1, aunque esté vacío). */
export function totalPaginas(total, porPagina) {
  return Math.max(1, Math.ceil((Number(total) || 0) / porPagina))
}
