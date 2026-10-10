<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import { useAuthStore } from './stores/auth.js'
import { usePomodoroStore } from './stores/pomodoro.js'

const auth = useAuthStore()
const pomodoro = usePomodoroStore()

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

function salir() {
  pomodoro.reiniciarTodo()
  auth.cerrarSesion()
}
</script>

<template>
  <header class="barra">
    <h1 class="logo" aria-label="PomoPet">
      <span class="logo__pomo">Pomo</span><span class="logo__pet">Pet</span>
    </h1>
    <button v-if="auth.autenticado" class="btn btn--apagado salir" @click="salir">Salir</button>
  </header>

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

.salir {
  font-size: 0.6rem;
  min-height: 2.25rem;
  padding: 0.5rem 0.8rem;
}
</style>
