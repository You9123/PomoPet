// Todas las mascotas tienen un sprite para cada color, etapa de evolución y estado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { leerPng } from './png.js'
import { POR_ESPECIE } from './recolor.js'

const raiz = fileURLToPath(new URL('../public/mascotas', import.meta.url))
// Mismos códigos que backend/app/gamificacion.py (ETAPAS)
const ETAPAS = ['cria', 'joven', 'adulta', 'legendaria']
const ESTADOS = ['inactivo', 'estudiando', 'exito', 'cancelado', 'descanso']

test('cada especie, color, etapa y estado tiene su sprite de 4 cuadros cuadrados', () => {
  for (const [especie, variantes] of Object.entries(POR_ESPECIE)) {
    for (const variante of variantes) {
      for (const etapa of ETAPAS) {
        for (const estado of ESTADOS) {
          const ruta = `${raiz}/${especie}/${variante}/${etapa}/${estado}.png`
          assert.ok(fs.existsSync(ruta), `falta ${especie}/${variante}/${etapa}/${estado}.png`)
          const { ancho, alto } = leerPng(fs.readFileSync(ruta))
          assert.equal(ancho, alto * 4, `${ruta} debería tener 4 cuadros`)
        }
      }
    }
  }
})

test('las etapas se ven distintas entre sí', () => {
  for (const especie of Object.keys(POR_ESPECIE)) {
    const imagenes = ETAPAS.map((etapa) =>
      Buffer.from(leerPng(fs.readFileSync(`${raiz}/${especie}/clasico/${etapa}/inactivo.png`)).rgba).toString('base64'),
    )
    assert.equal(new Set(imagenes).size, ETAPAS.length, `${especie}: dos etapas tienen el mismo dibujo`)
  }
})
