<script setup>
import { useAuthStore } from '../stores/auth.js'
import PanelAcceso from '../components/PanelAcceso.vue'
import PanelMaterias from '../components/PanelMaterias.vue'

const auth = useAuthStore()
</script>

<template>
  <main>
    <PanelMaterias v-if="auth.autenticado && auth.perfil" />
    <PanelAcceso v-else-if="!auth.autenticado" />
    <p v-else class="cargando" role="status">Cargando tus materias…</p>
  </main>
</template>

<style scoped>
.cargando {
  text-align: center;
  color: var(--texto-suave);
}
</style>
