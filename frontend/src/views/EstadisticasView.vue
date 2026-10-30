<script setup>
import { useAuthStore } from '../stores/auth.js'
import PanelAcceso from '../components/PanelAcceso.vue'
import PanelEstadisticas from '../components/PanelEstadisticas.vue'

const auth = useAuthStore()
</script>

<template>
  <main>
    <PanelEstadisticas v-if="auth.autenticado && auth.perfil" />
    <PanelAcceso v-else-if="!auth.autenticado" />
    <p v-else class="cargando" role="status">Cargando tus estadísticas…</p>
  </main>
</template>

<style scoped>
.cargando {
  text-align: center;
  color: var(--texto-suave);
}
</style>
