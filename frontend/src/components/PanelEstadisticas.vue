<script setup>
import { computed, onMounted } from 'vue'

import GraficoMinutosDia from './GraficoMinutosDia.vue'
import { useEstadisticasStore } from '../stores/estadisticas.js'
import {
  PERIODOS,
  fechaSesion,
  formatearDuracion,
  formatearMinutos,
  minutosDelPeriodo,
  totalPaginas,
} from '../utils/estadisticas.js'

const est = useEstadisticasStore()

const FILTROS = [
  { valor: null, texto: 'Todas' },
  { valor: 'completada', texto: 'Completadas' },
  { valor: 'cancelada', texto: 'Canceladas' },
]

const resumen = computed(() => est.datos?.resumen ?? null)
const porDia = computed(() => est.datos?.por_dia ?? null)
const hayMinutos = computed(() => minutosDelPeriodo(porDia.value) > 0)
const sumar = (lista) => (lista ?? []).reduce((a, b) => a + b, 0)
const completadosPeriodo = computed(() => sumar(porDia.value?.completados))
const canceladosPeriodo = computed(() => sumar(porDia.value?.cancelados))

const paginas = computed(() => totalPaginas(est.historial.total, est.historial.por_pagina))
const pagina = computed(() => est.historial.pagina)

const mensajeVacio = computed(() => {
  if (est.filtro === 'completada') return 'Todavía no completas ningún pomodoro.'
  if (est.filtro === 'cancelada') return 'No has cancelado ninguna sesión. ¡Bien!'
  return 'Todavía no hay sesiones terminadas. Completa tu primer pomodoro para verlo aquí.'
})

onMounted(() => est.cargarTodo())
</script>

<template>
  <div class="estadisticas">
    <p v-if="est.error" class="aviso-error" role="alert">{{ est.error }}</p>

    <!-- ----- Resumen ----- -->
    <section class="tarjeta marco bloque" aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen" class="bloque__titulo">Estadísticas</h2>

      <p v-if="!resumen && est.cargando" class="aviso" role="status">Cargando estadísticas…</p>

      <dl v-if="resumen" class="resumen">
        <div class="dato dato--grande">
          <dt>Tiempo estudiado</dt>
          <dd>{{ formatearMinutos(resumen.minutos_estudiados) }}</dd>
        </div>
        <div class="dato">
          <dt>XP total</dt>
          <dd class="dato__valor--oro">{{ resumen.xp_total }}</dd>
          <dd class="dato__nota">Nivel {{ resumen.nivel }}</dd>
        </div>
        <div class="dato">
          <dt>Éxito</dt>
          <dd>{{ resumen.tasa_exito === null ? '—' : `${resumen.tasa_exito}%` }}</dd>
          <dd class="dato__nota">de las sesiones</dd>
        </div>
        <div class="dato">
          <dt>Completados</dt>
          <dd class="dato__valor--menta">{{ resumen.pomodoros_completados }}</dd>
          <dd class="dato__nota">pomodoros</dd>
        </div>
        <div class="dato">
          <dt>Cancelados</dt>
          <dd class="dato__valor--tomate">{{ resumen.pomodoros_cancelados }}</dd>
          <dd class="dato__nota">{{ formatearMinutos(resumen.minutos_en_canceladas) }} sin XP</dd>
        </div>
      </dl>
    </section>

    <!-- ----- Minutos por día ----- -->
    <section class="tarjeta marco bloque" aria-labelledby="titulo-dias">
      <header class="bloque__cabecera">
        <h3 id="titulo-dias" class="bloque__titulo">Minutos por día</h3>
        <div class="selector" role="group" aria-label="Periodo del gráfico">
          <button
            v-for="dias in PERIODOS"
            :key="dias"
            type="button"
            class="selector__opcion"
            :aria-pressed="est.periodo === dias"
            :disabled="est.cargando"
            @click="est.cambiarPeriodo(dias)"
          >
            {{ dias }} días
          </button>
        </div>
      </header>

      <template v-if="porDia">
        <GraficoMinutosDia v-if="hayMinutos" :por-dia="porDia" />
        <p v-else class="aviso aviso--vacio">
          No completaste pomodoros en los últimos {{ porDia.dias.length }} días.
        </p>
        <p class="bloque__pie">
          {{ formatearMinutos(minutosDelPeriodo(porDia)) }} · {{ completadosPeriodo }} completados ·
          {{ canceladosPeriodo }} cancelados
        </p>
      </template>
    </section>

    <!-- ----- Historial ----- -->
    <section class="tarjeta marco bloque" aria-labelledby="titulo-historial">
      <header class="bloque__cabecera">
        <h3 id="titulo-historial" class="bloque__titulo">Historial</h3>
        <span class="bloque__contador">{{ est.historial.total }} sesiones</span>
      </header>

      <div class="selector" role="group" aria-label="Filtrar historial">
        <button
          v-for="f in FILTROS"
          :key="f.texto"
          type="button"
          class="selector__opcion"
          :aria-pressed="est.filtro === f.valor"
          :disabled="est.cargandoHistorial"
          @click="est.cambiarFiltro(f.valor)"
        >
          {{ f.texto }}
        </button>
      </div>

      <p v-if="est.cargandoHistorial && !est.historial.sesiones.length" class="aviso" role="status">
        Cargando historial…
      </p>
      <p v-else-if="!est.historial.sesiones.length" class="aviso aviso--vacio">{{ mensajeVacio }}</p>

      <ol v-else class="historial" :aria-busy="est.cargandoHistorial">
        <li
          v-for="s in est.historial.sesiones"
          :key="s.id"
          class="sesion"
          :class="`sesion--${s.estado}`"
          :style="{ '--color-materia': s.materia_color }"
        >
          <div class="sesion__fila">
            <p class="sesion__materia">{{ s.materia_nombre }}</p>
            <span class="insignia" :class="`insignia--${s.estado}`">
              {{ s.estado === 'completada' ? 'Completada' : 'Cancelada' }}
            </span>
          </div>
          <p class="sesion__datos">
            <time :datetime="s.inicio">{{ fechaSesion(s.inicio) }}</time>
            · {{ formatearDuracion(s.segundos_efectivos) }} efectivos
            <template v-if="s.segundos_pausados > 0"> · {{ formatearDuracion(s.segundos_pausados) }} en pausa</template>
          </p>
          <p class="sesion__datos">
            <strong v-if="s.xp > 0" class="sesion__xp">+{{ s.xp }} XP</strong>
            <span v-else>Sin XP</span>
            <template v-if="s.jefe_nombre"> · Jefe: {{ s.jefe_nombre }}</template>
          </p>
        </li>
      </ol>

      <nav v-if="paginas > 1" class="paginas" aria-label="Páginas del historial">
        <button
          type="button"
          class="btn btn--apagado btn--chico"
          :disabled="pagina <= 1 || est.cargandoHistorial"
          @click="est.cargarHistorial(pagina - 1)"
        >
          ‹ Anterior
        </button>
        <span class="paginas__texto">{{ pagina }} / {{ paginas }}</span>
        <button
          type="button"
          class="btn btn--apagado btn--chico"
          :disabled="pagina >= paginas || est.cargandoHistorial"
          @click="est.cargarHistorial(pagina + 1)"
        >
          Siguiente ›
        </button>
      </nav>
    </section>
  </div>
</template>

<style scoped>
.estadisticas {
  display: grid;
  gap: 1.75rem;
}

.bloque {
  display: grid;
  gap: 1rem;
}

.bloque__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.bloque__titulo {
  margin: 0;
  font-size: 0.8rem;
  color: var(--oro);
  text-shadow: 2px 2px 0 var(--tinta);
}

h3.bloque__titulo {
  font-size: 0.7rem;
  color: var(--menta);
}

.bloque__contador,
.bloque__pie {
  margin: 0;
  font-size: 0.85rem;
  color: var(--texto-suave);
}

.aviso {
  margin: 0;
  color: var(--texto-suave);
}

.aviso--vacio {
  padding: 1.25rem 0.75rem;
  text-align: center;
  background: var(--tinta);
}

/* ----- Resumen ----- */
.resumen {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0;
}

.dato {
  display: grid;
  align-content: start;
  gap: 0.3rem;
  margin: 3px;
  padding: 0.75rem;
  background: var(--tinta);
}

.dato--grande {
  grid-column: 1 / -1;
  text-align: center;
}

.dato dt {
  font-family: var(--fuente-pixel);
  font-size: 0.55rem;
  line-height: 1.5;
  color: var(--texto-suave);
}

.dato dd {
  margin: 0;
  font-family: var(--fuente-pixel);
  font-size: 1rem;
  color: var(--texto);
}

.dato--grande dd {
  font-size: 1.25rem;
  color: var(--oro);
  text-shadow: 3px 3px 0 var(--noche);
}

.dato .dato__nota {
  font-family: var(--fuente-texto);
  font-size: 0.8rem;
  color: var(--texto-suave);
}

.dato .dato__valor--oro {
  color: var(--oro);
}

.dato .dato__valor--menta {
  color: var(--menta);
}

.dato .dato__valor--tomate {
  color: var(--tomate);
}

/* ----- Selector (periodo y filtro) ----- */
.selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.selector__opcion {
  margin: 3px;
  padding: 0.5rem 0.65rem;
  border: 0;
  cursor: pointer;
  font-family: var(--fuente-pixel);
  font-size: 0.55rem;
  color: var(--texto-suave);
  background: var(--tinta);
  box-shadow:
    0 -3px 0 0 var(--superficie-alta),
    0 3px 0 0 var(--superficie-alta),
    -3px 0 0 0 var(--superficie-alta),
    3px 0 0 0 var(--superficie-alta);
}

.selector__opcion[aria-pressed='true'] {
  color: var(--tinta);
  background: var(--oro);
  box-shadow:
    0 -3px 0 0 var(--tinta),
    0 3px 0 0 var(--tinta),
    -3px 0 0 0 var(--tinta),
    3px 0 0 0 var(--tinta);
}

.selector__opcion:disabled {
  cursor: wait;
}

.selector__opcion:focus-visible {
  outline: 3px solid var(--foco);
  outline-offset: 4px;
}

/* ----- Historial ----- */
.historial {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.historial[aria-busy='true'] {
  opacity: 0.6;
}

.sesion {
  display: grid;
  gap: 0.25rem;
  margin: 3px;
  padding: 0.65rem 0.75rem 0.65rem 1rem;
  background: var(--tinta);
  border-left: 6px solid var(--color-materia);
}

.sesion--cancelada {
  border-left-style: dashed;
}

.sesion__fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sesion__materia {
  margin: 0;
  min-width: 0;
  font-family: var(--fuente-pixel);
  font-size: 0.6rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.sesion__datos {
  margin: 0;
  font-size: 0.85rem;
  color: var(--texto-suave);
}

.sesion__xp {
  color: var(--oro);
}

.insignia {
  flex-shrink: 0;
  padding: 0.2rem 0.4rem;
  font-family: var(--fuente-pixel);
  font-size: 0.5rem;
  color: var(--tinta);
}

.insignia--completada {
  background: var(--menta);
}

.insignia--cancelada {
  background: var(--tomate);
  color: #fff;
}

.paginas {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.paginas__texto {
  font-family: var(--fuente-pixel);
  font-size: 0.6rem;
  color: var(--texto-suave);
}

.btn--chico {
  min-height: 2.25rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.6rem;
}
</style>
