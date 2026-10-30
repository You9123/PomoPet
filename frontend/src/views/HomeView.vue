<script setup>
import { useAuthStore } from '../stores/auth.js'
import PanelAcceso from '../components/PanelAcceso.vue'
import ReproductorAmbiental from '../components/ReproductorAmbiental.vue'
import TemporizadorPomodoro from '../components/TemporizadorPomodoro.vue'

const auth = useAuthStore()
</script>

<template>
  <main>
    <template v-if="auth.autenticado && auth.perfil">
      <TemporizadorPomodoro />
      <ReproductorAmbiental />
    </template>
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
