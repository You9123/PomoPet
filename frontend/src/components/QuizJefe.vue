<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { usePomodoroStore } from '../stores/pomodoro.js'
import { MAX_APUNTES, MIN_APUNTES, useQuizStore } from '../stores/quiz.js'
import JefeBarraVida from './JefeBarraVida.vue'

// Golpe extra contra el Jefe Final (RF-15, RF-16): la IA crea un quiz con los apuntes del estudiante.
const pomodoro = usePomodoroStore()
const quiz = useQuizStore()

const apuntes = ref('') // solo viven aquí: no se guardan en ningún lado
const largo = computed(() => apuntes.value.trim().length)
const apuntesValidos = computed(() => largo.value >= MIN_APUNTES && largo.value <= MAX_APUNTES)

const sesionUsada = ref(null) // ya se abrió el quiz de esta sesión: el servidor solo admite uno

// Se ofrece tras completar un pomodoro contra un jefe que sigue vivo; omitirlo no afecta al descanso
const puedeOfrecer = computed(
  () =>
    !quiz.paso &&
    (pomodoro.fase === 'exito' || pomodoro.fase === 'descanso') &&
    pomodoro.sesion?.estado === 'completada' &&
    pomodoro.sesion?.jefe_id &&
    pomodoro.jefe &&
    !pomodoro.jefe.derrotado &&
    pomodoro.sesion.id !== sesionUsada.value,
)

const jefeAntes = ref(null)
const jefeMostrado = ref(null)
let temporizador = null

function abrir() {
  jefeAntes.value = pomodoro.jefe
  sesionUsada.value = pomodoro.sesion.id
  apuntes.value = ''
  quiz.abrir(pomodoro.sesion.id)
}

async function generar() {
  if (apuntesValidos.value) await quiz.generar(apuntes.value.trim())
}

function cerrar() {
  // «Ahora no» todavía no creó el quiz: se puede volver a ofrecer durante el descanso
  if (quiz.paso === 'apuntes') sesionUsada.value = null
  apuntes.value = ''
  quiz.cerrar()
}

// La barra arranca con el HP de antes para que el golpe se vea bajar
watch(
  () => quiz.resultado,
  (resultado) => {
    if (!resultado) return
    jefeMostrado.value = jefeAntes.value ?? resultado.jefe
    temporizador = setTimeout(() => {
      jefeMostrado.value = resultado.jefe
    }, 400)
    pomodoro.cargarJefes()
  },
)

onMounted(quiz.retomar)
onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<template>
  <div v-if="puedeOfrecer" class="oferta">
    <button type="button" class="btn btn--tomate" @click="abrir">⚔ Golpe extra: quiz</button>
  </div>

  <section v-else-if="quiz.paso" class="quiz marco" aria-labelledby="quiz-titulo">
    <h3 id="quiz-titulo" class="quiz__titulo">Golpe extra</h3>

    <!-- Paso 1: apuntes -->
    <form v-if="quiz.paso === 'apuntes'" class="quiz__cuerpo" @submit.prevent="generar">
      <label for="quiz-apuntes">Pega tus apuntes</label>
      <textarea id="quiz-apuntes" v-model="apuntes" rows="7" :maxlength="MAX_APUNTES" :disabled="quiz.cargando" />
      <small class="quiz__contador" :class="{ 'quiz__contador--falta': !apuntesValidos }">
        {{ largo }} / {{ MAX_APUNTES }} caracteres (mínimo {{ MIN_APUNTES }})
      </small>
      <p class="quiz__aviso">
        Tu texto se envía a un servicio de IA externo para crear las preguntas y PomoPet no lo guarda. No pegues datos
        personales.
      </p>
      <p v-if="quiz.cargando" class="quiz__carga" role="status">La IA está preparando tus preguntas...</p>
      <div class="acciones">
        <button type="submit" class="btn btn--tomate" :disabled="!apuntesValidos || quiz.cargando">Crear quiz</button>
        <button type="button" class="btn btn--apagado" :disabled="quiz.cargando" @click="cerrar">Ahora no</button>
      </div>
    </form>

    <!-- Paso 2: una pregunta a la vez -->
    <div v-else-if="quiz.paso === 'preguntas' && quiz.pregunta" class="quiz__cuerpo">
      <p class="quiz__progreso">Pregunta {{ quiz.actual + 1 }} de {{ quiz.preguntas.length }}</p>
      <p class="quiz__enunciado">{{ quiz.pregunta.enunciado }}</p>
      <div class="quiz__opciones" role="group" :aria-label="`Opciones de la pregunta ${quiz.actual + 1}`">
        <button
          v-for="(opcion, i) in quiz.pregunta.opciones"
          :key="`${quiz.actual}-${i}`"
          type="button"
          class="btn btn--apagado quiz__opcion"
          :disabled="quiz.cargando"
          @click="quiz.responder(i)"
        >
          {{ opcion }}
        </button>
      </div>
    </div>

    <!-- Paso 3: resultado -->
    <div v-else-if="quiz.paso === 'resultado' && quiz.resultado" class="quiz__cuerpo">
      <p class="quiz__nota" role="status">{{ quiz.resultado.aciertos }} de {{ quiz.preguntas.length }} aciertos</p>
      <p class="quiz__mensaje" :class="{ 'quiz__mensaje--golpe': quiz.resultado.dano_extra }">
        {{
          quiz.resultado.dano_extra
            ? '¡Golpe crítico! El jefe pierde 1 HP extra.'
            : 'Te faltó poco: se necesitan 4 aciertos para el golpe extra.'
        }}
      </p>
      <div v-if="jefeMostrado" :class="{ 'quiz__golpe': quiz.resultado.dano_extra }">
        <JefeBarraVida :jefe="jefeMostrado" />
      </div>
      <ol class="quiz__repaso">
        <li v-for="(p, i) in quiz.preguntas" :key="i">
          <span>{{ p.enunciado }}</span>
          <strong>{{ p.opciones[quiz.resultado.correctas[i]] }}</strong>
        </li>
      </ol>
      <div class="acciones">
        <button type="button" class="btn btn--menta" @click="cerrar">Listo</button>
      </div>
    </div>

    <p v-if="quiz.error" class="aviso-error" role="alert">{{ quiz.error }}</p>
  </section>
</template>

<style scoped>
.oferta {
  display: flex;
  justify-content: center;
}

.quiz {
  --marco-color: var(--rosa);
  display: grid;
  gap: 0.75rem;
  margin: 4px;
  padding: 0.9rem;
  background: var(--tinta);
}

.quiz__titulo {
  margin: 0;
  font-family: var(--fuente-pixel);
  font-size: 0.7rem;
  color: var(--rosa);
}

.quiz__cuerpo {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}

.quiz textarea {
  width: 100%;
  padding: 0.5rem;
  font: inherit;
  color: var(--texto);
  background: rgb(255 255 255 / 0.08);
  resize: vertical;
}

.quiz__contador,
.quiz__aviso,
.quiz__progreso {
  margin: 0;
  color: var(--texto-suave);
}

.quiz__contador--falta {
  color: var(--oro);
}

.quiz__carga {
  margin: 0;
  color: var(--menta);
}

.quiz__enunciado {
  margin: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.quiz__opciones {
  display: grid;
  gap: 0.75rem;
}

.quiz__opcion {
  width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.quiz__nota {
  margin: 0;
  font-family: var(--fuente-pixel);
  font-size: 0.8rem;
  color: var(--oro);
}

.quiz__mensaje {
  margin: 0;
}

.quiz__mensaje--golpe {
  color: var(--menta);
  font-weight: 700;
}

.quiz__golpe {
  animation: sacudida 0.4s steps(4) 0.4s;
}

@keyframes sacudida {
  25% {
    transform: translateX(-6px);
  }
  75% {
    transform: translateX(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .quiz__golpe {
    animation: none;
  }
}

.quiz__repaso {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding-left: 1.25rem;
  overflow-wrap: anywhere;
}

.quiz__repaso span {
  display: block;
  color: var(--texto-suave);
}

.quiz__repaso strong {
  color: var(--menta);
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  justify-content: center;
}
</style>
