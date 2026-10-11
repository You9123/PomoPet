<script setup>
import { computed, onMounted, ref, watch } from 'vue'

import { ApiError } from '../api/cliente.js'
import { useAuthStore } from '../stores/auth.js'
import MascotaSprite from './MascotaSprite.vue'

const auth = useAuthStore()

const modo = ref('ingresar') // 'ingresar' | 'registro'
const correo = ref('')
const password = ref('')
const especieId = ref(null)
const variante = ref('clasico')
const nombreMascota = ref('')
const error = ref('')
const enviando = ref(false)

const esRegistro = computed(() => modo.value === 'registro')

// Colores de la especie elegida; al cambiar de especie se vuelve al clásico
const variantes = computed(() => auth.especies.find((e) => e.id === especieId.value)?.variantes ?? [])
watch(especieId, () => {
  variante.value = 'clasico'
})

onMounted(async () => {
  try {
    await auth.cargarEspecies()
    especieId.value = auth.especies[0]?.id ?? null
  } catch {
    error.value = 'No se pudo cargar la lista de mascotas. ¿Está encendido el backend?'
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
        variante: variante.value,
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
  <section class="acceso tarjeta marco" aria-labelledby="titulo-acceso">
    <h2 id="titulo-acceso" class="acceso__titulo">
      {{ esRegistro ? 'Elige a tu compañero' : 'Bienvenido de vuelta' }}
    </h2>

    <form class="acceso__form" @submit.prevent="enviar">
      <fieldset v-if="esRegistro" class="especies">
        <legend class="sr-only">Elige tu mascota</legend>
        <label v-for="e in auth.especies" :key="e.id" class="especie" :class="{ 'especie--activa': especieId === e.id }">
          <input v-model="especieId" type="radio" name="especie" :value="e.id" />
          <MascotaSprite
            :especie="e.codigo"
            :variante="especieId === e.id ? variante : 'clasico'"
            estado="inactivo"
            :nombre="e.nombre"
            :tamano="64"
            :animada="especieId === e.id"
          />
          <span class="especie__nombre">{{ e.nombre }}</span>
        </label>
      </fieldset>

      <fieldset v-if="esRegistro && variantes.length > 1" class="colores">
        <legend class="colores__titulo">Elige su color</legend>
        <div class="colores__lista">
          <label
            v-for="v in variantes"
            :key="v.codigo"
            class="color"
            :class="{ 'color--activo': variante === v.codigo }"
          >
            <input v-model="variante" type="radio" name="color" :value="v.codigo" />
            <span class="color__muestra" :style="{ background: v.muestra }" aria-hidden="true" />
            <span class="color__nombre">{{ v.nombre }}</span>
          </label>
        </div>
      </fieldset>

      <label v-if="esRegistro" class="campo">
        Nombre de tu mascota
        <input v-model="nombreMascota" type="text" maxlength="50" required />
      </label>

      <label class="campo">
        Correo
        <input v-model="correo" type="email" autocomplete="email" required />
      </label>

      <label class="campo">
        Contraseña
        <input
          v-model="password"
          type="password"
          :autocomplete="esRegistro ? 'new-password' : 'current-password'"
          required
        />
        <small v-if="esRegistro">Mínimo 8 caracteres, con al menos una letra y un número.</small>
      </label>

      <p v-if="error" class="aviso-error" role="alert">{{ error }}</p>

      <button type="submit" class="btn btn--tomate" :disabled="enviando">
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
  gap: 1.25rem;
  justify-items: stretch;
}

.acceso__titulo {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: var(--oro);
  text-shadow: 2px 2px 0 var(--tinta);
}

.acceso__form {
  display: grid;
  gap: 1.1rem;
}

.acceso > .enlace {
  justify-self: center;
}

.especies {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
  border: 0;
  padding: 0;
  margin: 0;
}

.especie {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 0.7rem 0.25rem 0.55rem;
  cursor: pointer;
  background: var(--tinta);
  box-shadow:
    0 -3px 0 0 var(--superficie-alta),
    0 3px 0 0 var(--superficie-alta),
    -3px 0 0 0 var(--superficie-alta),
    3px 0 0 0 var(--superficie-alta);
  margin: 3px;
}

.especie--activa {
  background: var(--superficie-alta);
  box-shadow:
    0 -3px 0 0 var(--oro),
    0 3px 0 0 var(--oro),
    -3px 0 0 0 var(--oro),
    3px 0 0 0 var(--oro);
}

.especie input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}

.especie:has(input:focus-visible) {
  outline: 3px solid var(--foco);
  outline-offset: 5px;
}

.especie__nombre {
  font-family: var(--fuente-pixel);
  font-size: 0.6rem;
  color: var(--texto);
}

.colores {
  border: 0;
  padding: 0;
  margin: 0;
}

.colores__titulo {
  padding: 0;
  margin-bottom: 0.6rem;
  font-family: var(--fuente-pixel);
  font-size: 0.7rem;
  color: var(--texto-suave);
}

.colores__lista {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.color {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  margin: 3px;
  cursor: pointer;
  background: var(--tinta);
  box-shadow:
    0 -3px 0 0 var(--superficie-alta),
    0 3px 0 0 var(--superficie-alta),
    -3px 0 0 0 var(--superficie-alta),
    3px 0 0 0 var(--superficie-alta);
}

.color--activo {
  background: var(--superficie-alta);
  box-shadow:
    0 -3px 0 0 var(--oro),
    0 3px 0 0 var(--oro),
    -3px 0 0 0 var(--oro),
    3px 0 0 0 var(--oro);
}

.color input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}

.color:has(input:focus-visible) {
  outline: 3px solid var(--foco);
  outline-offset: 5px;
}

.color__muestra {
  flex: none;
  width: 1.1rem;
  height: 1.1rem;
  box-shadow: 0 0 0 2px var(--tinta);
}

.color__nombre {
  font-family: var(--fuente-pixel);
  font-size: 0.55rem;
  color: var(--texto);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
