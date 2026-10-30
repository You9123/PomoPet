<script setup>
// Minutos estudiados por día, una barra apilada por materia (issue #11). Usa Chart.js con vue-chartjs.
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'

import { datosGrafico, descripcionGrafico, formatearMinutos } from '../utils/estadisticas.js'

// Solo las piezas que se usan: así el bundle no carga todo Chart.js
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps({
  porDia: { type: Object, required: true }, // `por_dia` de GET /api/estadisticas
})

// Chart.js dibuja en un canvas y no entiende variables CSS: se leen de :root una vez
function color(variable, respaldo) {
  if (typeof document === 'undefined') return respaldo
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || respaldo
}

const TEXTO = color('--texto-suave', '#c9b8f5')
const REJILLA = 'rgb(124 92 255 / 0.25)'
const TINTA = color('--tinta', '#150b2e')
const FUENTE_PIXEL = color('--fuente-pixel', 'monospace')
const SIN_ANIMACION =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const datos = computed(() => datosGrafico(props.porDia))
const descripcion = computed(() => descripcionGrafico(props.porDia))

const opciones = {
  responsive: true,
  maintainAspectRatio: false,
  animation: SIN_ANIMACION ? false : { duration: 400 },
  interaction: { mode: 'index', intersect: false }, // el tooltip muestra todas las materias del día
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      border: { color: REJILLA },
      ticks: { color: TEXTO, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 6 },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: { color: REJILLA },
      border: { display: false },
      ticks: { color: TEXTO, font: { size: 11 }, precision: 0 },
      title: { display: true, text: 'minutos', color: TEXTO, font: { size: 11 } },
    },
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: TEXTO, boxWidth: 10, boxHeight: 10, font: { family: FUENTE_PIXEL, size: 8 }, padding: 12 },
    },
    tooltip: {
      backgroundColor: TINTA,
      borderColor: '#7c5cff',
      borderWidth: 2,
      cornerRadius: 0,
      titleFont: { family: FUENTE_PIXEL, size: 9 },
      filter: (item) => item.parsed.y > 0, // no listar las materias con 0 minutos ese día
      callbacks: {
        label: (item) => ` ${item.dataset.label}: ${formatearMinutos(item.parsed.y)}`,
        footer: (items) => `Total: ${formatearMinutos(items.reduce((suma, i) => suma + i.parsed.y, 0))}`,
      },
    },
  },
}
</script>

<template>
  <div class="grafico" role="img" :aria-label="descripcion">
    <Bar :data="datos" :options="opciones" />
  </div>
</template>

<style scoped>
.grafico {
  position: relative;
  height: 15rem;
}
</style>
