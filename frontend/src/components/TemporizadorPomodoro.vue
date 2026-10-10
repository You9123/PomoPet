<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'

import { POMODOROS_PARA_DESCANSO_LARGO, formatear } from '../utils/temporizador.js'
import { useAuthStore } from '../stores/auth.js'
import { usePomodoroStore } from '../stores/pomodoro.js'
import MascotaSprite from './MascotaSprite.vue'
import TomatePixel from './TomatePixel.vue'

const auth = useAuthStore()
const pomodoro = usePomodoroStore()

const TITULOS = {
  inactivo: 'Listo para estudiar',
  estudiando: 'Estudiando',
  pausado: 'En pausa',
  exito: '¡Lo lograste! +100 XP',
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
const porcentaje = computed(() => `${Math.round(Math.min(1, Math.max(0, pomodoro.progreso)) * 100)}%`)

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

onUnmounted(() => {
  pomodoro.detenerReloj()
  document.title = 'PomoPet'
})

// La hora también va en el título de la pestaña: se ve sin cambiar de pestaña.
watch(
  () => [pomodoro.fase, tiempo.value],
  ([fase, t]) => {
    document.title =
      fase === 'inactivo' || fase === 'cancelado' ? 'PomoPet' : `${t} · ${titulo.value} · PomoPet`
  },
  { immediate: true },
)
</script>

<template>
  <section class="juego" :class="`fase--${pomodoro.fase}`" aria-labelledby="titulo-fase">
    <header class="hud marco">
      <h2 id="titulo-fase" class="hud__titulo">{{ titulo }}</h2>
      <ol
        class="hud__tomates"
        :aria-label="`${pomodoro.completados} de ${POMODOROS_PARA_DESCANSO_LARGO} pomodoros para el descanso largo`"
      >
        <li v-for="n in rondas" :key="n">
          <TomatePixel :lleno="n < pomodoro.completados" />
        </li>
      </ol>
    </header>

    <div class="escenario marco">
      <div class="escenario__mascota">
        <MascotaSprite
          :especie="auth.especieCodigo ?? 'gato'"
          :variante="auth.varianteCodigo"
          :estado="pomodoro.fase"
          :nombre="auth.perfil?.mascota?.nombre ?? 'Tu mascota'"
          :tamano="192"
        />
      </div>
      <p v-if="auth.perfil?.mascota?.nombre" class="escenario__nombre">{{ auth.perfil.mascota.nombre }}</p>
      <div class="escenario__suelo" aria-hidden="true" />
    </div>

    <p class="tiempo" role="timer" :aria-label="`Tiempo restante ${tiempo}`">{{ tiempo }}</p>

    <div
      class="barra marco"
      role="progressbar"
      aria-label="Progreso"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Number.parseInt(porcentaje, 10)"
    >
      <div class="barra__relleno" :style="{ width: porcentaje }" />
    </div>

    <div v-if="pomodoro.fase === 'inactivo'" class="campo">
      <label for="materia">Número de materia</label>
      <input id="materia" v-model="materia" type="number" min="1" inputmode="numeric" placeholder="1" />
      <small>Provisional: el selector de materias llega con el issue #4.</small>
    </div>

    <div class="acciones">
      <button
        v-if="pomodoro.fase === 'inactivo'"
        class="btn btn--tomate"
        :disabled="!pomodoro.puedeIniciar || pomodoro.ocupado"
        @click="pomodoro.iniciar"
      >
        ▶ Iniciar
      </button>

      <button
        v-if="pomodoro.fase === 'estudiando'"
        class="btn"
        :disabled="pomodoro.ocupado"
        @click="pomodoro.pausar"
      >
        ❚❚ Pausar
      </button>
      <button
        v-if="pomodoro.fase === 'pausado'"
        class="btn btn--menta"
        :disabled="pomodoro.ocupado"
        @click="pomodoro.reanudar"
      >
        ▶ Reanudar
      </button>
      <button
        v-if="enSesion"
        class="btn btn--apagado"
        :disabled="pomodoro.ocupado"
        @click="pomodoro.cancelar"
      >
        ✕ Cancelar
      </button>

      <button v-if="pomodoro.fase === 'cancelado'" class="btn btn--tomate" @click="pomodoro.volverAlInicio">
        Volver a empezar
      </button>
      <button v-if="pomodoro.fase === 'descanso'" class="btn btn--apagado" @click="pomodoro.saltarDescanso">
        Saltar descanso
      </button>
    </div>

    <p v-if="pomodoro.error" class="aviso-error" role="alert">{{ pomodoro.error }}</p>
  </section>
</template>

<style scoped>
.juego {
  /* cada fase repinta el escenario y el color de acento */
  --cielo-a: #4b2a9a;
  --cielo-b: #8a56e6;
  --suelo: #2f1b6e;
  --acento: var(--oro);
  display: grid;
  gap: 1.25rem;
  margin: 4px;
}

.fase--estudiando {
  --cielo-a: #ff8a4a;
  --cielo-b: #c2185b;
  --suelo: #5a1a3a;
  --acento: var(--tomate);
}
.fase--pausado {
  --cielo-a: #5f78c8;
  --cielo-b: #2f3e84;
  --suelo: #232f63;
  --acento: var(--cielo);
}
.fase--exito {
  --cielo-a: #ffe066;
  --cielo-b: #ff9f1c;
  --suelo: #7a4b00;
  --acento: var(--oro);
}
.fase--descanso {
  --cielo-a: #28d4b4;
  --cielo-b: #0b6e8a;
  --suelo: #064a5c;
  --acento: var(--menta);
}
.fase--cancelado {
  --cielo-a: #7b7fa6;
  --cielo-b: #3b3d5e;
  --suelo: #26273d;
  --acento: var(--rosa);
}

/* ----- HUD ----- */
.hud {
  --marco-color: var(--acento);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 4px;
  padding: 0.75rem 0.9rem;
  background: var(--tinta);
}

.hud__titulo {
  margin: 0;
  font-size: 0.7rem;
  color: var(--acento);
  text-shadow: 2px 2px 0 rgb(0 0 0 / 0.5);
}

.hud__tomates {
  display: flex;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ----- Escenario ----- */
.escenario {
  --marco-color: var(--tinta);
  position: relative;
  display: grid;
  justify-items: center;
  align-content: end;
  min-height: 17rem;
  margin: 4px;
  overflow: hidden;
  background:
    linear-gradient(var(--suelo), var(--suelo)) 0 100% / 100% 3rem no-repeat,
    linear-gradient(180deg, var(--cielo-a), var(--cielo-b));
}

.escenario__mascota {
  position: relative;
  z-index: 1;
  margin-bottom: 0.9rem;
}

.escenario__nombre {
  position: absolute;
  top: 0.6rem;
  left: 0.75rem;
  margin: 0;
  padding: 0.3rem 0.5rem;
  font-family: var(--fuente-pixel);
  font-size: 0.6rem;
  color: #fff;
  background: rgb(21 11 46 / 0.65);
}

.escenario__suelo {
  position: absolute;
  inset: auto 0 0 0;
  height: 3rem;
  /* hierba/tierra a cuadros */
  background:
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.1) 0 8px, transparent 8px 16px) 0 0 / 100% 8px no-repeat,
    repeating-linear-gradient(90deg, rgb(0 0 0 / 0.18) 0 16px, transparent 16px 32px) 0 16px / 100% 16px no-repeat;
}

/* ----- Reloj ----- */
.tiempo {
  margin: 0;
  text-align: center;
  font-family: var(--fuente-pixel);
  font-size: clamp(2.4rem, 13vw, 3.6rem);
  line-height: 1.1;
  color: var(--acento);
  text-shadow:
    4px 4px 0 var(--tinta),
    0 0 24px color-mix(in srgb, var(--acento) 50%, transparent);
  font-variant-numeric: tabular-nums;
}

/* ----- Barra de progreso ----- */
.barra {
  --marco-color: var(--tinta);
  height: 1.1rem;
  margin: 4px;
  background: var(--tinta);
  overflow: hidden;
}

.barra__relleno {
  height: 100%;
  background:
    repeating-linear-gradient(90deg, transparent 0 10px, rgb(0 0 0 / 0.35) 10px 12px),
    var(--acento);
}

/* ----- Controles ----- */
.campo {
  margin: 0 4px;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  justify-content: center;
}
</style>
