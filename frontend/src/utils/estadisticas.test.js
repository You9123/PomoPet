import test from 'node:test'
import assert from 'node:assert/strict'

import {
  datosGrafico,
  descripcionGrafico,
  etiquetaDia,
  fechaDeDia,
  formatearDuracion,
  formatearMinutos,
  minutosDelPeriodo,
  totalPaginas,
  zonaDelNavegador,
} from './estadisticas.js'

const porDia = {
  zona: 'America/Costa_Rica',
  dias: ['2026-10-26', '2026-10-27', '2026-10-28'],
  series: [
    { materia_id: 1, nombre: 'Cálculo', color: '#ff5a3c', minutos: [0, 50, 25] },
    { materia_id: 2, nombre: 'Física', color: '#3ee6b0', minutos: [26, 0, 0] },
  ],
  completados: [1, 2, 1],
  cancelados: [0, 1, 0],
}

test('formatearMinutos muestra horas solo cuando hacen falta', () => {
  assert.equal(formatearMinutos(0), '0 min')
  assert.equal(formatearMinutos(45), '45 min')
  assert.equal(formatearMinutos(120), '2 h')
  assert.equal(formatearMinutos(125), '2 h 05 min')
  assert.equal(formatearMinutos(null), '0 min')
  assert.equal(formatearMinutos(-3), '0 min')
})

test('formatearDuracion usa mm:ss y agrega las horas si pasa de una', () => {
  assert.equal(formatearDuracion(1500), '25:00')
  assert.equal(formatearDuracion(59), '00:59')
  assert.equal(formatearDuracion(3725), '1:02:05')
})

test('un día del calendario no se corre al día anterior por la zona horaria', () => {
  const fecha = fechaDeDia('2026-10-28')
  assert.equal(fecha.getDate(), 28)
  assert.equal(fecha.getMonth(), 9)
})

test('con 7 días la etiqueta lleva el día de la semana; con 30, solo la fecha', () => {
  assert.match(etiquetaDia('2026-10-28', 7), /28$/)
  assert.match(etiquetaDia('2026-10-28', 7), /^\S+ 28$/)
  assert.equal(etiquetaDia('2026-10-28', 30), '28/10')
})

test('datosGrafico arma una barra apilada por materia con su color', () => {
  const datos = datosGrafico(porDia)
  assert.equal(datos.labels.length, 3)
  assert.deepEqual(
    datos.datasets.map((d) => [d.label, d.backgroundColor, d.data]),
    [
      ['Cálculo', '#ff5a3c', [0, 50, 25]],
      ['Física', '#3ee6b0', [26, 0, 0]],
    ],
  )
  assert.ok(datos.datasets.every((d) => d.stack === 'minutos'))
})

test('datosGrafico sin datos devuelve un gráfico vacío', () => {
  assert.deepEqual(datosGrafico(null), { labels: [], datasets: [] })
})

test('minutos del periodo y descripción para lectores de pantalla', () => {
  assert.equal(minutosDelPeriodo(porDia), 101)
  assert.equal(
    descripcionGrafico(porDia),
    'Minutos estudiados en los últimos 3 días: 1 h 41 min. Cálculo: 1 h 15 min, Física: 26 min.',
  )
  assert.equal(descripcionGrafico({ dias: ['2026-10-28'], series: [] }), 'Sin minutos estudiados en los últimos 1 días')
})

test('el historial siempre tiene al menos una página', () => {
  assert.equal(totalPaginas(0, 10), 1)
  assert.equal(totalPaginas(10, 10), 1)
  assert.equal(totalPaginas(11, 10), 2)
})

test('la zona del navegador es un nombre IANA', () => {
  assert.match(zonaDelNavegador(), /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/)
})
