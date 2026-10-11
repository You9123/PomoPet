<script setup>
// Un tomate de 9x9 "píxeles" dibujado con rectángulos SVG. `lleno` indica un pomodoro completado.
defineProps({ lleno: { type: Boolean, default: false } })

const MAPA = [
  '....g....',
  '..gggg...',
  '.rrgrrrr.',
  'rrrrrrrrr',
  'rLLrrrrrr',
  'rLrrrrrrr',
  'rrrrrrrrr',
  '.rrrrrrr.',
  '..rrrrr..',
]

const celdas = MAPA.flatMap((fila, y) =>
  [...fila].map((c, x) => ({ x, y, c })).filter((celda) => celda.c !== '.'),
)
</script>

<template>
  <svg
    class="tomate"
    :class="{ 'tomate--lleno': lleno }"
    viewBox="0 0 9 9"
    shape-rendering="crispEdges"
    aria-hidden="true"
  >
    <rect
      v-for="celda in celdas"
      :key="`${celda.x}-${celda.y}`"
      :x="celda.x"
      :y="celda.y"
      width="1"
      height="1"
      :class="`c-${celda.c}`"
    />
  </svg>
</template>

<style scoped>
.tomate {
  width: 1.5rem;
  height: 1.5rem;
  display: block;
}

.c-r {
  fill: var(--tinta);
  stroke: var(--borde);
  stroke-width: 0.15;
}
.c-L {
  fill: var(--superficie-alta);
}
.c-g {
  fill: var(--menta-oscura);
}

.tomate--lleno .c-r {
  fill: var(--tomate);
  stroke: none;
}
.tomate--lleno .c-L {
  fill: #ffb3a1;
}
.tomate--lleno .c-g {
  fill: var(--menta);
}
</style>
