<script setup>
import { computed, ref, watch } from 'vue'

// Cada estado es una tira horizontal PNG de cuadros cuadrados:
//   public/mascotas/<codigo-de-la-especie>/<estado>.png
// La cantidad de cuadros sale de ancho / alto, así que una animación nueva solo necesita su PNG.
const props = defineProps({
  especie: { type: String, default: 'gato' },
  estado: { type: String, default: 'inactivo' },
  nombre: { type: String, default: 'Tu mascota' },
  tamano: { type: Number, default: 192 }, // lado aproximado en px (se ajusta a un múltiplo entero)
  animada: { type: Boolean, default: true },
})

// "pausado" reutiliza la animación de estudio, pero congelada.
const ARCHIVO = {
  inactivo: 'inactivo',
  estudiando: 'estudiando',
  pausado: 'estudiando',
  exito: 'exito',
  cancelado: 'cancelado',
  descanso: 'descanso',
}

// Segundos que dura un ciclo completo de la animación
const DURACION = { inactivo: 1.4, estudiando: 1.0, pausado: 1.0, exito: 0.7, cancelado: 1.2, descanso: 2.0 }

const DESCRIPCION = {
  inactivo: 'esperando para empezar',
  estudiando: 'estudiando contigo',
  pausado: 'en pausa',
  exito: 'celebrando que terminaste',
  cancelado: 'triste porque cancelaste',
  descanso: 'descansando',
}

const src = computed(() => `/mascotas/${props.especie}/${ARCHIVO[props.estado] ?? 'inactivo'}.png`)
const cuadros = ref(4)
const lado = ref(32) // lado del cuadro original, en px

watch(
  src,
  (url) => {
    const img = new Image()
    img.onload = () => {
      lado.value = img.naturalHeight
      cuadros.value = Math.max(1, Math.round(img.naturalWidth / img.naturalHeight))
    }
    img.src = url
  },
  { immediate: true },
)

// Escala entera: el pixel art no se ve bien con escalas fraccionarias.
const escala = computed(() => Math.max(1, Math.floor(props.tamano / lado.value)))
const ladoFinal = computed(() => lado.value * escala.value)

const estilo = computed(() => ({
  '--lado': `${ladoFinal.value}px`,
  '--n': cuadros.value,
  '--dur': `${DURACION[props.estado] ?? 1.2}s`,
  backgroundImage: `url(${src.value})`,
}))

const alt = computed(() => `${props.nombre} está ${DESCRIPCION[props.estado] ?? ''}`)
</script>

<template>
  <div
    role="img"
    :aria-label="alt"
    :class="['sprite', { 'sprite--quieto': !animada || estado === 'pausado' }]"
    :style="estilo"
  />
</template>

<style scoped>
.sprite {
  width: var(--lado);
  height: var(--lado);
  background-repeat: no-repeat;
  background-size: calc(var(--lado) * var(--n)) var(--lado);
  background-position-x: 0;
  image-rendering: pixelated;
  animation: reproducir var(--dur) steps(var(--n)) infinite;
}

.sprite--quieto {
  animation-play-state: paused;
}

@keyframes reproducir {
  to {
    background-position-x: calc(var(--lado) * var(--n) * -1);
  }
}
</style>
