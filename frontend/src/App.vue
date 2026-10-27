<script setup>
import { onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'

import { useAudioStore } from './stores/audio.js'
import { useAuthStore } from './stores/auth.js'
import { usePomodoroStore } from './stores/pomodoro.js'

const audio = useAudioStore()
const auth = useAuthStore()
const pomodoro = usePomodoroStore()
const router = useRouter()

// Con un token guardado se recupera el perfil; si venció, el cliente cierra la sesión solo.
onMounted(async () => {
  if (auth.autenticado) {
    try {
      await auth.cargarPerfil()
    } catch {
      // 401: el cliente ya cerró la sesión; sin conexión: se muestra "Cargando"
    }
  }
})

// Al cerrar sesión (con el botón o porque venció el token) se apaga el sonido ambiental
watch(
  () => auth.autenticado,
  (autenticado) => {
    if (!autenticado) audio.detener()
  },
)

function salir() {
  pomodoro.reiniciarTodo()
  auth.cerrarSesion()
  router.push({ name: 'home' })
}
</script>

<template>
  <header class="barra">
    <h1 class="logo" aria-label="PomoPet">
      <span class="logo__pomo">Pomo</span><span class="logo__pet">Pet</span>
    </h1>
    <button v-if="auth.autenticado" class="btn btn--apagado salir" @click="salir">Salir</button>
  </header>

  <nav v-if="auth.autenticado" class="menu" aria-label="Secciones">
    <RouterLink :to="{ name: 'home' }" class="menu__enlace">Pomodoro</RouterLink>
    <RouterLink :to="{ name: 'materias' }" class="menu__enlace">Materias</RouterLink>
  </nav>

  <RouterView />
</template>

<style scoped>
.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 0 4px;
}

.logo {
  margin: 0;
  font-size: clamp(1.1rem, 6vw, 1.6rem);
  letter-spacing: 0.04em;
  text-shadow:
    3px 3px 0 var(--tinta),
    0 0 18px rgb(124 92 255 / 0.6);
}

.logo__pomo {
  color: var(--tomate);
}

.logo__pet {
  color: var(--menta);
}

.menu {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0 4px 1.5rem;
}

.menu__enlace {
  padding: 0.7rem 0.5rem;
  margin: 3px;
  text-align: center;
  font-family: var(--fuente-pixel);
  font-size: 0.6rem;
  color: var(--texto-suave);
  text-decoration: none;
  background: var(--tinta);
  box-shadow:
    0 -3px 0 0 var(--superficie-alta),
    0 3px 0 0 var(--superficie-alta),
    -3px 0 0 0 var(--superficie-alta),
    3px 0 0 0 var(--superficie-alta);
}

.menu__enlace[aria-current='page'] {
  color: var(--tinta);
  background: var(--oro);
  box-shadow:
    0 -3px 0 0 var(--tinta),
    0 3px 0 0 var(--tinta),
    -3px 0 0 0 var(--tinta),
    3px 0 0 0 var(--tinta);
}

.menu__enlace:focus-visible {
  outline: 3px solid var(--foco);
  outline-offset: 4px;
}

.salir {
  font-size: 0.6rem;
  min-height: 2.25rem;
  padding: 0.5rem 0.8rem;
}
</style>
