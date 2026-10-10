import test from 'node:test'
import assert from 'node:assert/strict'

import { escribirPng, leerPng } from './png.js'
import { POR_ESPECIE, VARIANTES, recolorear, recolorearImagen, rgbAHsl } from './recolor.js'

const NARANJA = [0xff, 0x9a, 0x3c] // base del gato
const NARANJA_SOMBRA = [0xd9, 0x6a, 0x1c]
const NARANJA_LUZ = [0xff, 0xc2, 0x7a]

// Colores que NO son el pelaje y no deben cambiar nunca
const AJENOS = {
  contorno: [0x1d, 0x12, 0x30],
  estrella: [0xff, 0xd2, 0x3f],
  libro: [0xff, 0x5a, 0x3c],
  mejilla: [0xff, 0x8f, 0xa3],
  nube: [0x8e, 0x9b, 0xc9],
  blanco: [0xff, 0xf8, 0xee],
  zeta: [0x4c, 0xc9, 0xf0],
}

const luminosidad = ([r, g, b]) => rgbAHsl(r, g, b)[2]

test('clasico devuelve el color sin cambios', () => {
  assert.deepEqual(recolorear(...NARANJA, 'gato', 'clasico'), NARANJA)
})

test('los colores que no son del pelaje no cambian en ninguna variante', () => {
  for (const [especie, variantes] of Object.entries(POR_ESPECIE)) {
    for (const variante of variantes) {
      for (const [nombre, color] of Object.entries(AJENOS)) {
        assert.deepEqual(recolorear(...color, especie, variante), color, `${especie}/${variante}/${nombre}`)
      }
    }
  }
})

test('los cuernos amarillos del dragon se conservan en todas sus variantes', () => {
  const cuerno = [0xff, 0xd2, 0x3f]
  for (const variante of POR_ESPECIE.dragon) {
    assert.deepEqual(recolorear(...cuerno, 'dragon', variante), cuerno)
  }
})

test('ceniza deja el pelaje gris', () => {
  const [, s] = rgbAHsl(...recolorear(...NARANJA, 'gato', 'ceniza'))
  assert.ok(s < 0.15, `saturación ${s}`)
})

test('celeste mueve el matiz hacia el azul', () => {
  const [h] = rgbAHsl(...recolorear(...NARANJA, 'gato', 'celeste'))
  assert.ok(Math.abs(h - 200) < 6, `matiz ${h}`)
})

test('fuego vuelve rojo al dragon verde', () => {
  const [h] = rgbAHsl(...recolorear(0x3e, 0xcf, 0x6e, 'dragon', 'fuego'))
  assert.ok(h < 15 || h > 350, `matiz ${h}`)
})

test('sombra oscurece y nieve aclara', () => {
  assert.ok(luminosidad(recolorear(...NARANJA, 'gato', 'sombra')) < luminosidad(NARANJA))
  assert.ok(luminosidad(recolorear(...NARANJA, 'gato', 'nieve')) > luminosidad(NARANJA))
})

test('toda variante conserva el orden sombra < base < luz (el sprite no pierde volumen)', () => {
  for (const variante of POR_ESPECIE.gato) {
    const s = luminosidad(recolorear(...NARANJA_SOMBRA, 'gato', variante))
    const b = luminosidad(recolorear(...NARANJA, 'gato', variante))
    const l = luminosidad(recolorear(...NARANJA_LUZ, 'gato', variante))
    assert.ok(s < b && b < l, `${variante}: ${s} ${b} ${l}`)
  }
})

test('el contorno siempre queda más oscuro que el pelaje', () => {
  for (const variante of POR_ESPECIE.gato) {
    assert.ok(luminosidad(AJENOS.contorno) < luminosidad(recolorear(...NARANJA_SOMBRA, 'gato', variante)), variante)
  }
})

test('una variante desconocida da error', () => {
  assert.throws(() => recolorear(...NARANJA, 'gato', 'arcoiris'), /desconocida/)
})

test('cada variante listada existe y todas las especies empiezan por clasico', () => {
  for (const variantes of Object.values(POR_ESPECIE)) {
    assert.equal(variantes[0], 'clasico')
    for (const v of variantes) assert.ok(VARIANTES[v], v)
  }
})

test('la imagen conserva la transparencia y el alfa', () => {
  const rgba = new Uint8Array([...NARANJA, 255, 10, 20, 30, 0, ...NARANJA, 128])
  const salida = recolorearImagen(rgba, 'gato', 'celeste')
  assert.deepEqual([...salida.subarray(4, 8)], [10, 20, 30, 0]) // píxel transparente intacto
  assert.equal(salida[3], 255)
  assert.equal(salida[11], 128)
  assert.notDeepEqual([...salida.subarray(0, 3)], NARANJA)
})

test('escribir y leer un PNG devuelve los mismos píxeles', () => {
  const rgba = new Uint8Array(4 * 2 * 4) // 4 x 2 píxeles
  rgba.forEach((_, i) => (rgba[i] = (i * 37) % 256))
  const { ancho, alto, rgba: leido } = leerPng(escribirPng(4, 2, rgba))
  assert.equal(ancho, 4)
  assert.equal(alto, 2)
  assert.deepEqual([...leido], [...rgba])
})
