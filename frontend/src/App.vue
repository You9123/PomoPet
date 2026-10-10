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
    <h1>PomoPet <span aria-hidden="true">🍅</span></h1>
    <button v-if="auth.autenticado" class="salir" @click="salir">Salir</button>
  </header>

  <RouterView />
</template>

<style scoped>
.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--color-heading);
}

.salir {
  font: inherit;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--color-border-hover);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

.salir:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}
</style>
