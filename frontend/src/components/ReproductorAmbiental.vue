<script setup>
import { computed } from 'vue'

import { PISTAS, useAudioStore } from '../stores/audio.js'

const audio = useAudioStore()

const porcentaje = computed(() => Math.round(audio.volumen * 100))
</script>

<template>
  <section class="reproductor marco" aria-labelledby="titulo-audio">
    <h2 id="titulo-audio" class="reproductor__titulo">Sonido ambiental</h2>

    <div class="pistas" role="group" aria-label="Pista">
      <button
        v-for="p in PISTAS"
        :key="p.codigo"
        type="button"
        class="pista"
        :aria-pressed="audio.pistaCodigo === p.codigo"
        @click="audio.elegir(p.codigo)"
      >
        {{ p.nombre }}
      </button>
    </div>

    <div class="controles">
      <button
        type="button"
        class="btn reproductor__boton"
        :class="audio.reproduciendo ? 'btn--apagado' : 'btn--menta'"
        :aria-label="audio.reproduciendo ? `Pausar ${audio.pista.nombre}` : `Reproducir ${audio.pista.nombre}`"
        @click="audio.alternar"
      >
        {{ audio.reproduciendo ? '❚❚ Pausar' : '▶ Reproducir' }}
      </button>

      <label class="volumen" for="volumen">
        <span class="volumen__texto">Volumen {{ porcentaje }}%</span>
        <input
          id="volumen"
          type="range"
          min="0"
          max="100"
          step="5"
          :value="porcentaje"
          :aria-valuetext="`${porcentaje}%`"
          @input="audio.cambiarVolumen($event.target.value / 100)"
        />
      </label>
    </div>

    <p v-if="audio.error" class="aviso-error" role="alert">{{ audio.error }}</p>
  </section>
</template>

<style scoped>
.reproductor {
  --marco-color: var(--borde);
  display: grid;
  gap: 0.9rem;
  margin: 1.5rem 4px 4px;
  padding: 0.9rem;
  background: var(--tinta);
}

.reproductor__titulo {
  margin: 0;
  font-size: 0.7rem;
  color: var(--cielo);
  text-shadow: 2px 2px 0 rgb(0 0 0 / 0.5);
}

.pistas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.pista {
  min-height: 2.75rem;
  padding: 0.5rem 0.3rem;
  margin: 3px;
  border: 0;
  cursor: pointer;
  font-family: var(--fuente-pixel);
  font-size: 0.55rem;
  line-height: 1.4;
  color: var(--texto-suave);
  background: var(--noche);
  box-shadow:
    0 -3px 0 0 var(--superficie-alta),
    0 3px 0 0 var(--superficie-alta),
    -3px 0 0 0 var(--superficie-alta),
    3px 0 0 0 var(--superficie-alta);
}

.pista[aria-pressed='true'] {
  color: var(--tinta);
  background: var(--cielo);
  box-shadow:
    0 -3px 0 0 var(--tinta),
    0 3px 0 0 var(--tinta),
    -3px 0 0 0 var(--tinta),
    3px 0 0 0 var(--tinta);
}

.pista:focus-visible,
.volumen input:focus-visible {
  outline: 3px solid var(--foco);
  outline-offset: 4px;
}

.controles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.reproductor__boton {
  flex: 0 0 auto;
  min-width: 10.5rem;
}

.volumen {
  display: grid;
  flex: 1 1 9rem;
  gap: 0.4rem;
  font-family: var(--fuente-pixel);
  font-size: 0.55rem;
  color: var(--texto-suave);
}

.volumen input {
  width: 100%;
  margin: 0;
  accent-color: var(--cielo);
  cursor: pointer;
}
</style>
