<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'

import { POMODOROS_PARA_DESCANSO_LARGO, formatear } from '../utils/temporizador.js'
import { useAuthStore } from '../stores/auth.js'
import { usePomodoroStore } from '../stores/pomodoro.js'
import MascotaAvatar from './MascotaAvatar.vue'

const auth = useAuthStore()
const pomodoro = usePomodoroStore()

const TITULOS = {
  inactivo: 'Listo para estudiar',
  estudiando: 'Estudiando',
  pausado: 'En pausa',
  exito: '¡Pomodoro completado! +100 XP',
  cancelado: 'Sesión cancelada',
  descanso: 'Descanso',
}

const titulo = computed(() => {
  if (pomodoro.fase === 'descanso') {
    return pomodoro.descansoTipo === 'largo' ? 'Descanso largo' : 'Descanso corto'
  }
  return TITULOS[pomodoro.fase]
})

const tiempo = computed(() => formatear(pomodoro.restanteMs))
const rondas = computed(() => Array.from({ length: POMODOROS_PARA_DESCANSO_LARGO }, (_, i) => i))
const enSesion = computed(() => pomodoro.fase === 'estudiando' || pomodoro.fase === 'pausado')

// El número de materia se escribe a mano hasta que exista la API de materias (issue #4).
const materia = computed({
  get: () => pomodoro.materiaId ?? '',
  set: (valor) => {
    const n = Number.parseInt(valor, 10)
    pomodoro.materiaId = Number.isInteger(n) && n > 0 ? n : null
  },
})

onMounted(async () => {
  pomodoro.arrancarReloj()
  await pomodoro.recuperar()
})

onUnmounted(() => pomodoro.detenerReloj())

// La hora también va en el título de la pestaña: se ve sin cambiar de pestaña.
watch(
  () => [pomodoro.fase, tiempo.value],
  ([fase, t]) => {
    document.title = fase === 'inactivo' || fase === 'cancelado' ? 'PomoPet' : `${t} · ${titulo.value} · PomoPet`
  },
  { immediate: true },
)
onUnmounted(() => {
  document.title = 'PomoPet'
})
</script>

<template>
  <section class="temporizador" :class="`fase--${pomodoro.fase}`" aria-labelledby="titulo-fase">
    <MascotaAvatar
      :especie="auth.especieCodigo ?? 'gato'"
      :estado="pomodoro.fase"
      :nombre="auth.perfil?.mascota?.nombre ?? 'Tu mascota'"
    />

    <h2 id="titulo-fase" class="titulo">{{ titulo }}</h2>

    <p class="tiempo" role="timer" :aria-label="`Tiempo restante ${tiempo}`">{{ tiempo }}</p>

    <ol class="rondas" :aria-label="`${pomodoro.completados} de ${POMODOROS_PARA_DESCANSO_LARGO} pomodoros para el descanso largo`">
      <li v-for="n in rondas" :key="n" :class="{ hecha: n < pomodoro.completados }" />
    </ol>

    <div v-if="pomodoro.fase === 'inactivo'" class="campo">
      <label for="materia">Número de materia</label>
      <input id="materia" v-model="materia" type="number" min="1" inputmode="numeric" placeholder="1" />
      <small>Provisional: el selector de materias llega con el issue #4.</small>
    </div>

    <div class="acciones">
      <button
        v-if="pomodoro.fase === 'inactivo'"
        class="principal"
        :disabled="!pomodoro.puedeIniciar || pomodoro.ocupado"
        @click="pomodoro.iniciar"
      >
        Iniciar pomodoro
      </button>

      <button
        v-if="pomodoro.fase === 'estudiando'"
        class="principal"
        :disabled="pomodoro.ocupado"
        @click="pomodoro.pausar"
      >
        Pausar
      </button>
      <button
        v-if="pomodoro.fase === 'pausado'"
        class="principal"
        :disabled="pomodoro.ocupado"
        @click="pomodoro.reanudar"
      >
        Reanudar
      </button>
      <button v-if="enSesion" class="secundario" :disabled="pomodoro.ocupado" @click="pomodoro.cancelar">
        Cancelar
      </button>

      <button v-if="pomodoro.fase === 'cancelado'" class="principal" @click="pomodoro.volverAlInicio">
        Volver a empezar
      </button>
      <button v-if="pomodoro.fase === 'descanso'" class="secundario" @click="pomodoro.saltarDescanso">
        Saltar descanso
      </button>
    </div>

    <p v-if="pomodoro.error" class="error" role="alert">{{ pomodoro.error }}</p>
  </section>
</template>

<style scoped>
.temporizador {
  --acento: var(--color-tomate);
  display: grid;
  gap: 1rem;
  justify-items: center;
  text-align: center;
  padding: 2rem 1.25rem;
  border-radius: 1.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
}

.fase--descanso {
  --acento: var(--color-descanso);
}
.fase--exito {
  --acento: var(--color-exito);
}
.fase--cancelado,
.fase--pausado {
  --acento: var(--color-apagado);
}

.titulo {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-heading);
}

.tiempo {
  margin: 0;
  font-size: clamp(3.5rem, 18vw, 5.5rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: var(--acento);
  line-height: 1;
}

.rondas {
  display: flex;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rondas li {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--color-tomate);
}

.rondas li.hecha {
  background: var(--color-tomate);
}

.campo {
  display: grid;
  gap: 0.35rem;
  width: min(100%, 16rem);
  text-align: left;
}

.campo input {
  font: inherit;
  padding: 0.6rem 0.75rem;
  border-radius: 0.6rem;
  border: 1px solid var(--color-border-hover);
  background: var(--color-background);
  color: var(--color-text);
}

.campo small {
  color: var(--color-text-suave);
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

button {
  font: inherit;
  font-weight: 600;
  min-height: 2.75rem;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  border: 2px solid var(--color-tomate);
  cursor: pointer;
}

button.principal {
  background: var(--color-tomate);
  color: #fff;
}

button.secundario {
  background: transparent;
  color: var(--color-tomate);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:focus-visible,
.campo input:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}

.error {
  margin: 0;
  color: var(--color-error);
  font-weight: 600;
}
</style>
