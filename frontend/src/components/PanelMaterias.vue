<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

import { MAX_MATERIAS, sugerirColor, useMateriasStore } from '../stores/materias.js'
import { usePomodoroStore } from '../stores/pomodoro.js'

const materias = useMateriasStore()
const pomodoro = usePomodoroStore()

const editandoId = ref(null) // null: el formulario crea una materia nueva
const borrandoId = ref(null) // materia que espera la confirmación para borrarse
const nombre = ref('')
const color = ref(sugerirColor([]))
const horas = ref('')
const campoNombre = ref(null)

const editando = computed(() => editandoId.value !== null)
// Con 20 materias solo se muestra el formulario para editar
const mostrarFormulario = computed(() => editando.value || !materias.lleno)

// La materia del pomodoro que está corriendo no se ofrece para borrar (el backend también responde 409)
const materiaEnCurso = computed(() =>
  pomodoro.fase === 'estudiando' || pomodoro.fase === 'pausado' ? (pomodoro.sesion?.materia_id ?? null) : null,
)

function formularioVacio() {
  editandoId.value = null
  nombre.value = ''
  color.value = sugerirColor(materias.lista)
  horas.value = ''
}

onMounted(async () => {
  materias.limpiarError()
  await Promise.all([materias.cargar(), pomodoro.recuperar()])
  formularioVacio()
})

async function guardar() {
  const datos = { nombre: nombre.value, color: color.value, horasSemanales: horas.value }
  const ok = editando.value ? await materias.editar(editandoId.value, datos) : await materias.crear(datos)
  if (ok) formularioVacio()
}

async function empezarEdicion(m) {
  materias.limpiarError()
  borrandoId.value = null
  editandoId.value = m.id
  nombre.value = m.nombre
  color.value = m.color
  horas.value = m.horas_semanales ?? ''
  await nextTick()
  campoNombre.value?.focus()
}

function cancelarEdicion() {
  materias.limpiarError()
  formularioVacio()
}

function pedirConfirmacion(m) {
  materias.limpiarError()
  borrandoId.value = m.id
}

async function borrar(m) {
  const ok = await materias.eliminar(m.id)
  borrandoId.value = null
  if (!ok) return
  if (editandoId.value === m.id) formularioVacio()
  if (pomodoro.materiaId === m.id) pomodoro.materiaId = null
}

/** Lo que se pierde al borrar, para el aviso de confirmación. */
function queSeBorra(m) {
  const sesiones = m.pomodoros_completados + m.pomodoros_cancelados
  if (sesiones === 0) return 'sus Jefes Finales, si tiene'
  if (sesiones === 1) return 'su sesión y sus Jefes Finales'
  return `sus ${sesiones} sesiones y sus Jefes Finales`
}
</script>

<template>
  <section class="materias tarjeta marco" aria-labelledby="titulo-materias">
    <header class="materias__cabecera">
      <h2 id="titulo-materias" class="materias__titulo">Mis materias</h2>
      <span class="materias__contador" :aria-label="`${materias.lista.length} de ${MAX_MATERIAS} materias`">
        {{ materias.lista.length }}/{{ MAX_MATERIAS }}
      </span>
    </header>

    <form v-if="mostrarFormulario" class="formulario" @submit.prevent="guardar">
      <h3 class="formulario__titulo">{{ editando ? 'Editar materia' : 'Nueva materia' }}</h3>

      <label class="campo">
        Nombre
        <input ref="campoNombre" v-model="nombre" type="text" maxlength="100" required placeholder="Cálculo" />
      </label>

      <div class="formulario__fila">
        <label class="campo campo--color">
          Color
          <input v-model="color" type="color" />
        </label>
        <label class="campo">
          Horas por semana
          <input v-model="horas" type="number" min="0" max="168" inputmode="numeric" placeholder="Opcional" />
        </label>
      </div>

      <div class="formulario__acciones">
        <button type="submit" class="btn btn--menta" :disabled="materias.ocupado">
          {{ editando ? 'Guardar cambios' : '+ Agregar' }}
        </button>
        <button v-if="editando" type="button" class="btn btn--apagado" @click="cancelarEdicion">Cancelar</button>
      </div>
    </form>
    <p v-else class="materias__aviso">
      Llegaste al máximo de {{ MAX_MATERIAS }} materias. Borra una para poder agregar otra.
    </p>

    <p v-if="materias.error" class="aviso-error" role="alert">{{ materias.error }}</p>

    <p v-if="!materias.cargada && materias.ocupado" class="materias__aviso" role="status">Cargando materias…</p>
    <p v-else-if="materias.cargada && materias.lista.length === 0" class="materias__aviso">
      Todavía no tienes materias. Agrega la primera para empezar a estudiar.
    </p>

    <ul v-if="materias.lista.length" class="lista">
      <li
        v-for="m in materias.lista"
        :key="m.id"
        class="materia"
        :class="{ 'materia--editando': editandoId === m.id }"
        :style="{ '--color-materia': m.color }"
      >
        <template v-if="borrandoId === m.id">
          <p class="materia__confirmar">
            ¿Borrar <strong>{{ m.nombre }}</strong>? También se borran {{ queSeBorra(m) }}. No se puede deshacer.
          </p>
          <div class="materia__acciones">
            <button type="button" class="btn btn--tomate btn--chico" :disabled="materias.ocupado" @click="borrar(m)">
              Sí, borrar
            </button>
            <button type="button" class="btn btn--apagado btn--chico" @click="borrandoId = null">No</button>
          </div>
        </template>

        <template v-else>
          <div class="materia__info">
            <p class="materia__nombre">{{ m.nombre }}</p>
            <p class="materia__rango" :class="`materia__rango--${m.rango.codigo}`">{{ m.rango.nombre }}</p>
            <p class="materia__datos">
              {{ m.pomodoros_completados }} pomodoros · {{ m.minutos_estudiados }} min · {{ m.xp }} XP · Nv {{ m.nivel }}
              <template v-if="m.horas_semanales !== null"> · {{ m.horas_semanales }} h/semana</template>
            </p>
            <p v-if="materiaEnCurso === m.id" class="materia__en-curso">Pomodoro en curso</p>
          </div>
          <div class="materia__acciones">
            <button
              type="button"
              class="btn btn--apagado btn--chico"
              :aria-label="`Editar ${m.nombre}`"
              @click="empezarEdicion(m)"
            >
              Editar
            </button>
            <button
              type="button"
              class="btn btn--apagado btn--chico"
              :aria-label="`Borrar ${m.nombre}`"
              :disabled="materiaEnCurso === m.id"
              :title="materiaEnCurso === m.id ? 'Termina o cancela el pomodoro antes de borrarla' : null"
              @click="pedirConfirmacion(m)"
            >
              Borrar
            </button>
          </div>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.materias {
  display: grid;
  gap: 1.25rem;
}

.materias__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.materias__titulo {
  margin: 0;
  font-size: 0.8rem;
  color: var(--oro);
  text-shadow: 2px 2px 0 var(--tinta);
}

.materias__contador {
  font-family: var(--fuente-pixel);
  font-size: 0.6rem;
  color: var(--texto-suave);
}

.materias__aviso {
  margin: 0;
  color: var(--texto-suave);
}

/* ----- Formulario ----- */
.formulario {
  display: grid;
  gap: 1rem;
  padding: 1rem 0.85rem;
  background: var(--noche);
}

.formulario__titulo {
  margin: 0;
  font-size: 0.65rem;
  color: var(--menta);
}

.formulario__fila {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: 0.75rem;
  align-items: end;
}

.campo--color input {
  width: auto;
  height: 2.95rem;
  padding: 0.3rem;
  cursor: pointer;
}

.formulario__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

/* ----- Lista ----- */
.lista {
  display: grid;
  gap: 0.85rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.materia {
  display: grid;
  gap: 0.6rem;
  margin: 3px;
  padding: 0.75rem 0.75rem 0.75rem 1rem;
  background: var(--tinta);
  border-left: 6px solid var(--color-materia);
}

.materia--editando {
  box-shadow: 0 0 0 3px var(--menta);
}

.materia__info {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.materia__nombre {
  margin: 0;
  font-family: var(--fuente-pixel);
  font-size: 0.7rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.materia__rango {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--oro);
}

.materia__rango--novato {
  color: var(--texto-suave);
}

.materia__datos,
.materia__confirmar {
  margin: 0;
  font-size: 0.85rem;
  color: var(--texto-suave);
}

.materia__confirmar strong {
  color: var(--texto);
}

.materia__en-curso {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--tomate);
}

.materia__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.btn--chico {
  min-height: 2.25rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.6rem;
}
</style>
