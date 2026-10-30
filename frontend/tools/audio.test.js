// Las pistas de audio ambiental existen, son WAV válidos, suenan, no saturan y repiten sin saltos.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { PISTAS } from '../src/stores/audio.js'
import { FRECUENCIA, cerrarBucle, lluvia, pico, rms, ruidoBlanco } from './sintesis.js'
import { escribirWav, leerWav } from './wav.js'

const raiz = fileURLToPath(new URL('../public', import.meta.url))

function leerPista(pista) {
  return leerWav(fs.readFileSync(`${raiz}${pista.archivo}`))
}

/** Proporción de muestras en que la onda cruza el cero: alta en el ruido, baja en la música. */
function crucesPorCero(muestras) {
  let cruces = 0
  for (let i = 1; i < muestras.length; i++) if (muestras[i - 1] < 0 !== muestras[i] < 0) cruces++
  return cruces / muestras.length
}

test('cada pista del reproductor tiene su WAV mono de 16 bits', () => {
  for (const pista of PISTAS) {
    const ruta = `${raiz}${pista.archivo}`
    assert.ok(fs.existsSync(ruta), `falta ${pista.archivo} (generarlo con npm run audio)`)
    const wav = leerPista(pista)
    assert.equal(wav.canales, 1)
    assert.equal(wav.bits, 16)
    assert.equal(wav.frecuencia, FRECUENCIA)
    assert.ok(wav.muestras.length / wav.frecuencia >= 8, `${pista.codigo} es muy corta para un bucle`)
  }
})

test('las pistas suenan con un volumen parecido y sin saturar', () => {
  for (const pista of PISTAS) {
    const { muestras } = leerPista(pista)
    const volumen = rms(muestras)
    assert.ok(volumen > 0.07 && volumen < 0.2, `${pista.codigo}: volumen ${volumen.toFixed(3)}`)
    assert.ok(pico(muestras) < 0.99, `${pista.codigo} satura`)
  }
})

test('al repetir, el final empalma con el inicio sin un salto mayor que los de la propia pista', () => {
  for (const pista of PISTAS) {
    const { muestras } = leerPista(pista)
    let mayorSalto = 0
    for (let i = 1; i < muestras.length; i++) {
      mayorSalto = Math.max(mayorSalto, Math.abs(muestras[i] - muestras[i - 1]))
    }
    const empalme = Math.abs(muestras[0] - muestras[muestras.length - 1])
    assert.ok(empalme <= mayorSalto, `${pista.codigo}: salto de ${empalme.toFixed(3)} al repetir`)
  }
})

test('cada pista suena distinta: ruido blanco > lluvia > Lo-Fi en cruces por cero', () => {
  const cruces = Object.fromEntries(PISTAS.map((p) => [p.codigo, crucesPorCero(leerPista(p).muestras)]))
  assert.ok(cruces['ruido-blanco'] > cruces.lluvia, JSON.stringify(cruces))
  assert.ok(cruces.lluvia > cruces.lofi * 3, JSON.stringify(cruces))
})

// ---------- Herramientas de síntesis ----------

test('cerrarBucle funde el final con el inicio', () => {
  // Un seno de frecuencia "rara": cortado a secas daría un salto grande al repetir
  const largo = 1000
  const senal = Float32Array.from({ length: largo + 200 }, (_, i) => Math.sin(i * 0.0737))
  assert.ok(Math.abs(senal[largo - 1] - senal[0]) > 0.5)
  const bucle = cerrarBucle(senal, largo, 200)
  assert.equal(bucle.length, largo)
  assert.ok(Math.abs(bucle[largo - 1] - bucle[0]) < 0.1)
})

test('la síntesis es reproducible: la misma semilla da el mismo audio', () => {
  assert.deepEqual(lluvia({ segundos: 1 }), lluvia({ segundos: 1 }))
  assert.notDeepEqual(ruidoBlanco({ segundos: 1, semilla: 1 }), ruidoBlanco({ segundos: 1, semilla: 2 }))
})

test('escribir y leer un WAV conserva las muestras', () => {
  const muestras = Float32Array.from([0, 0.5, -0.5, 1, -1])
  const wav = leerWav(escribirWav(muestras, FRECUENCIA))
  assert.equal(wav.frecuencia, FRECUENCIA)
  wav.muestras.forEach((v, i) => assert.ok(Math.abs(v - muestras[i]) < 1e-4))
})
