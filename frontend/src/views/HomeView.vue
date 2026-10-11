<script setup>
import { useAuthStore } from '../stores/auth.js'
import PanelAcceso from '../components/PanelAcceso.vue'
import TemporizadorPomodoro from '../components/TemporizadorPomodoro.vue'

const auth = useAuthStore()
</script>

<template>
  <main>
    <TemporizadorPomodoro v-if="auth.autenticado && auth.perfil" />
    <PanelAcceso v-else-if="!auth.autenticado" />
    <p v-else class="cargando" role="status">Cargando tu mascota…</p>
  </main>
</template>

<style scoped>
.cargando {
  text-align: center;
  color: var(--color-text-suave);
}
</style>
