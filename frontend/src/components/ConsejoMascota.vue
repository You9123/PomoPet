<script setup>
import { computed, onMounted } from 'vue'

import { useAuthStore } from '../stores/auth.js'
import { useCoachStore } from '../stores/coach.js'

// Globo con el consejo de la mascota (RF-14). Si el coach falla, el temporizador sigue igual.
const auth = useAuthStore()
const coach = useCoachStore()

const nombre = computed(() => auth.perfil?.mascota?.nombre ?? 'Tu mascota')
const etiquetaBoton = computed(() => {
  if (coach.cargando) return 'Pensando...'
  return coach.restantes === null ? 'Pedir consejo' : `Pedir consejo (${coach.restantes} hoy)`
})

onMounted(coach.cargar)
</script>

<template>
  <section class="consejo" :aria-label="`Consejo de ${nombre}`">
    <p class="consejo__globo marco" aria-live="polite">
      {{ coach.texto ?? `${nombre} tiene algo que decirte sobre tu estudio.` }}
    </p>
    <button
      type="button"
      class="btn btn--apagado consejo__boton"
      :disabled="coach.cargando || coach.restantes === 0"
      @click="coach.pedir"
    >
      {{ etiquetaBoton }}
    </button>
    <p v-if="coach.error" class="aviso-error" role="alert">{{ coach.error }}</p>
  </section>
</template>

<style scoped>
.consejo {
  display: grid;
  gap: 0.75rem;
  justify-items: center;
  margin: 0 4px;
}

.consejo__globo {
  --marco-color: var(--tinta);
  position: relative;
  justify-self: stretch;
  margin: 4px 4px 0.75rem;
  padding: 0.75rem 0.9rem;
  color: var(--texto);
  background: var(--tinta);
}

/* el piquito del globo apunta hacia la mascota, que está arriba */
.consejo__globo::before {
  content: '';
  position: absolute;
  top: -1.1rem;
  left: 50%;
  width: 0.8rem;
  height: 0.8rem;
  background: var(--tinta);
  box-shadow: 0.8rem 0.8rem 0 var(--tinta);
  transform: translateX(-50%);
}

.consejo__boton {
  font-size: 0.6rem;
}
</style>
