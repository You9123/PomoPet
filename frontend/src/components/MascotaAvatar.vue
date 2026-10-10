<script setup>
import { computed } from 'vue'

// Estados con imagen propia; "pausado" reutiliza "estudiando" (la mascota sigue concentrada).
const props = defineProps({
  especie: { type: String, default: 'gato' },
  estado: { type: String, default: 'inactivo' },
  nombre: { type: String, default: 'Tu mascota' },
})

const IMAGEN = {
  inactivo: 'inactivo',
  estudiando: 'estudiando',
  pausado: 'estudiando',
  exito: 'exito',
  cancelado: 'cancelado',
  descanso: 'descanso',
}

const DESCRIPCION = {
  inactivo: 'esperando para empezar',
  estudiando: 'estudiando contigo',
  pausado: 'en pausa',
  exito: 'celebrando que terminaste',
  cancelado: 'triste porque cancelaste',
  descanso: 'descansando',
}

const src = computed(() => `/mascotas/${props.especie}/${IMAGEN[props.estado] ?? 'inactivo'}.svg`)
const alt = computed(() => `${props.nombre} está ${DESCRIPCION[props.estado] ?? ''}`)
</script>

<template>
  <img
    :src="src"
    :alt="alt"
    :class="['mascota', `mascota--${estado}`]"
    width="200"
    height="200"
  />
</template>

<style scoped>
.mascota {
  display: block;
  width: min(60vw, 220px);
  height: auto;
  margin-inline: auto;
  transition: filter 0.3s ease, transform 0.3s ease;
}

.mascota--pausado {
  filter: grayscale(0.6) opacity(0.85);
}

.mascota--exito {
  animation: saltito 0.6s ease-in-out 3;
}

.mascota--descanso {
  animation: respirar 3s ease-in-out infinite;
}

@keyframes saltito {
  50% {
    transform: translateY(-14px);
  }
}

@keyframes respirar {
  50% {
    transform: scale(1.03);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mascota {
    animation: none;
  }
}
</style>
