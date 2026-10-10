<script setup>
import { computed, onMounted, ref } from 'vue'

import { ApiError } from '../api/cliente.js'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()

const modo = ref('ingresar') // 'ingresar' | 'registro'
const correo = ref('')
const password = ref('')
const especieId = ref(null)
const nombreMascota = ref('')
const error = ref('')
const enviando = ref(false)

const esRegistro = computed(() => modo.value === 'registro')

onMounted(async () => {
  try {
    await auth.cargarEspecies()
    especieId.value = auth.especies[0]?.id ?? null
  } catch {
    // se reintenta al abrir la pestaña de registro
  }
})

async function enviar() {
  error.value = ''
  enviando.value = true
  try {
    if (esRegistro.value) {
      await auth.registrar({
        correo: correo.value,
        password: password.value,
        especieId: especieId.value,
        nombreMascota: nombreMascota.value,
      })
    } else {
      await auth.iniciarSesion(correo.value, password.value)
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <section class="acceso" aria-labelledby="titulo-acceso">
    <h2 id="titulo-acceso">{{ esRegistro ? 'Crea tu cuenta' : 'Ingresa a PomoPet' }}</h2>

    <form @submit.prevent="enviar">
      <label>
        Correo
        <input v-model="correo" type="email" autocomplete="email" required />
      </label>

      <label>
        Contraseña
        <input
          v-model="password"
          type="password"
          :autocomplete="esRegistro ? 'new-password' : 'current-password'"
          required
        />
        <small v-if="esRegistro">Mínimo 8 caracteres, con al menos una letra y un número.</small>
      </label>

      <template v-if="esRegistro">
        <fieldset>
          <legend>Elige tu mascota</legend>
          <div class="especies">
            <label v-for="e in auth.especies" :key="e.id" class="especie">
              <input v-model="especieId" type="radio" name="especie" :value="e.id" />
              <img :src="`/mascotas/${e.codigo}/inactivo.svg`" :alt="e.nombre" width="72" height="72" />
              <span>{{ e.nombre }}</span>
            </label>
          </div>
        </fieldset>

        <label>
          Nombre de tu mascota
          <input v-model="nombreMascota" type="text" maxlength="50" required />
        </label>
      </template>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="enviando">
        {{ esRegistro ? 'Crear cuenta' : 'Ingresar' }}
      </button>
    </form>

    <button type="button" class="enlace" @click="modo = esRegistro ? 'ingresar' : 'registro'">
      {{ esRegistro ? 'Ya tengo cuenta' : 'Crear una cuenta' }}
    </button>
  </section>
</template>

<style scoped>
.acceso {
  display: grid;
  gap: 1rem;
  padding: 2rem 1.25rem;
  border-radius: 1.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
}

h2 {
  margin: 0;
  text-align: center;
  color: var(--color-heading);
}

form {
  display: grid;
  gap: 1rem;
}

label {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
}

input[type='email'],
input[type='password'],
input[type='text'] {
  font: inherit;
  padding: 0.6rem 0.75rem;
  border-radius: 0.6rem;
  border: 1px solid var(--color-border-hover);
  background: var(--color-background);
  color: var(--color-text);
}

small {
  font-weight: 400;
  color: var(--color-text-suave);
}

fieldset {
  border: 0;
  padding: 0;
  margin: 0;
}

legend {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.especies {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.especie {
  position: relative;
  justify-items: center;
  padding: 0.5rem;
  border: 2px solid var(--color-border-hover);
  border-radius: 0.9rem;
  cursor: pointer;
  font-weight: 500;
}

.especie input {
  position: absolute;
  opacity: 0;
}

.especie:has(input:checked) {
  border-color: var(--color-tomate);
  background: var(--color-background);
}

.especie:has(input:focus-visible) {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}

button {
  font: inherit;
  font-weight: 600;
  min-height: 2.75rem;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  border: 2px solid var(--color-tomate);
  background: var(--color-tomate);
  color: #fff;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.enlace {
  background: none;
  border: 0;
  color: var(--color-tomate);
  text-decoration: underline;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid var(--color-foco);
  outline-offset: 2px;
}

.error {
  margin: 0;
  color: var(--color-error);
  font-weight: 600;
}
</style>
