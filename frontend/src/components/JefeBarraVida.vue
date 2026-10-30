<script setup>
import { computed } from 'vue'

// Barra de vida del Jefe Final (RF-12). El HP lo calcula el servidor: aquí solo se dibuja.
const props = defineProps({
  jefe: { type: Object, required: true },
})

const porcentaje = computed(() => {
  const { hp_actual: actual, hp_total: total } = props.jefe
  return total > 0 ? Math.round((Math.min(total, Math.max(0, actual)) / total) * 100) : 0
})

// Verde con vida de sobra, amarillo a media vida, rojo cuando le queda poco
const nivel = computed(() => (porcentaje.value > 50 ? 'alto' : porcentaje.value > 25 ? 'medio' : 'bajo'))

const limite = computed(() => {
  if (!props.jefe.fecha_limite) return ''
  const [anio, mes, dia] = props.jefe.fecha_limite.split('-')
  return `${dia}/${mes}/${anio}`
})
</script>

<template>
  <div class="jefe marco" :class="{ 'jefe--derrotado': jefe.derrotado }">
    <div class="jefe__cabecera">
      <strong class="jefe__nombre">{{ jefe.nombre }}</strong>
      <span v-if="jefe.derrotado" class="jefe__estado">¡Derrotado!</span>
      <span v-else class="jefe__hp">{{ jefe.hp_actual }} / {{ jefe.hp_total }} HP</span>
    </div>
    <div
      class="jefe__barra"
      role="progressbar"
      :aria-label="`Vida de ${jefe.nombre}`"
      aria-valuemin="0"
      :aria-valuemax="jefe.hp_total"
      :aria-valuenow="jefe.hp_actual"
    >
      <div class="jefe__vida" :class="`jefe__vida--${nivel}`" :style="{ width: `${porcentaje}%` }" />
    </div>
    <small v-if="limite" class="jefe__limite">Fecha límite: {{ limite }}</small>
  </div>
</template>

<style scoped>
.jefe {
  --marco-color: var(--tinta);
  display: grid;
  gap: 0.5rem;
  margin: 4px;
  padding: 0.75rem 0.9rem;
  background: var(--tinta);
}

.jefe__cabecera {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-family: var(--fuente-pixel);
  font-size: 0.6rem;
}

.jefe__nombre {
  color: var(--rosa);
}

.jefe__barra {
  height: 1.1rem;
  background: rgb(255 255 255 / 0.12);
  overflow: hidden;
}

.jefe__vida {
  height: 100%;
  transition: width 0.4s steps(8);
  background:
    repeating-linear-gradient(90deg, transparent 0 10px, rgb(0 0 0 / 0.35) 10px 12px),
    var(--menta);
}
.jefe__vida--medio {
  background-color: var(--oro);
}
.jefe__vida--bajo {
  background-color: var(--tomate);
}

.jefe--derrotado .jefe__nombre {
  text-decoration: line-through;
  opacity: 0.7;
}

.jefe__estado {
  color: var(--oro);
}

.jefe__limite {
  color: var(--color-text-suave);
}
</style>
