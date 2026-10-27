import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { PISTAS, VOLUMEN_POR_DEFECTO, fabrica, useAudioStore } from './audio.js'

// ---------- <audio> falso: registra lo que se le pide ----------

let creados

class AudioFalso {
  constructor(src) {
    this.src = src
    this.loop = false
    this.volume = 1
    this.paused = true
    this.oyentes = {}
    this.falla = null // error con el que rechaza play(), como hace el navegador
    creados.push(this)
  }
  addEventListener(evento, funcion) {
    this.oyentes[evento] = funcion
  }
  emitir(evento) {
    this.oyentes[evento]?.()
  }
  async play() {
    if (this.falla) throw this.falla
    this.paused = false
  }
  pause() {
    this.paused = true
  }
}

fabrica.crear = (src) => new AudioFalso(src)

// localStorage en memoria (en Node no existe)
const almacen = new Map()
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
}

beforeEach(() => {
  creados = []
  almacen.clear()
  setActivePinia(createPinia())
})

// ---------- Pistas ----------

test('hay pistas de lluvia, Lo-Fi y ruido blanco', () => {
  assert.deepEqual(
    PISTAS.map((p) => p.nombre),
    ['Lluvia', 'Lo-Fi', 'Ruido blanco'],
  )
  for (const p of PISTAS) assert.equal(p.archivo, `/audio/${p.codigo}.wav`)
})

test('empieza en la primera pista, en pausa y a volumen medio, sin crear el audio todavía', () => {
  const audio = useAudioStore()
  assert.equal(audio.pistaCodigo, 'lluvia')
  assert.equal(audio.reproduciendo, false)
  assert.equal(audio.volumen, VOLUMEN_POR_DEFECTO)
  assert.equal(creados.length, 0) // no se descarga nada hasta que se pulsa reproducir
})

// ---------- Reproducir y pausar ----------

test('reproducir crea la pista en bucle con el volumen elegido', async () => {
  const audio = useAudioStore()
  audio.cambiarVolumen(0.3)
  await audio.reproducir()
  assert.equal(audio.reproduciendo, true)
  assert.equal(creados.length, 1)
  assert.equal(creados[0].src, '/audio/lluvia.wav')
  assert.equal(creados[0].loop, true)
  assert.equal(creados[0].volume, 0.3)
  assert.equal(creados[0].paused, false)
})

test('pausar y volver a reproducir usa el mismo audio (sigue donde iba)', async () => {
  const audio = useAudioStore()
  await audio.reproducir()
  audio.pausar()
  assert.equal(audio.reproduciendo, false)
  assert.equal(creados[0].paused, true)
  await audio.reproducir()
  assert.equal(audio.reproduciendo, true)
  assert.equal(creados.length, 1)
})

test('alternar cambia entre reproducir y pausar', async () => {
  const audio = useAudioStore()
  await audio.alternar()
  assert.equal(audio.reproduciendo, true)
  await audio.alternar()
  assert.equal(audio.reproduciendo, false)
})

test('si el navegador no deja reproducir, se avisa y el botón queda en pausa', async () => {
  const audio = useAudioStore()
  fabrica.crear = (src) => Object.assign(new AudioFalso(src), { falla: new Error('NotAllowedError') })
  try {
    await audio.reproducir()
  } finally {
    fabrica.crear = (src) => new AudioFalso(src)
  }
  assert.equal(audio.reproduciendo, false)
  assert.match(audio.error, /No se pudo reproducir/)
})

test('si el navegador pausa el audio por su cuenta, el botón se actualiza', async () => {
  const audio = useAudioStore()
  await audio.reproducir()
  creados[0].emitir('pause') // p. ej. con las teclas multimedia
  assert.equal(audio.reproduciendo, false)
  creados[0].emitir('play')
  assert.equal(audio.reproduciendo, true)
})

// ---------- Cambiar de pista ----------

test('cambiar de pista mientras suena: para la anterior y empieza la nueva', async () => {
  const audio = useAudioStore()
  await audio.reproducir()
  await audio.elegir('lofi')
  assert.equal(audio.pistaCodigo, 'lofi')
  assert.equal(creados.length, 2)
  assert.equal(creados[0].paused, true)
  assert.equal(creados[1].src, '/audio/lofi.wav')
  assert.equal(creados[1].paused, false)
  assert.equal(audio.reproduciendo, true)

  creados[0].emitir('pause') // el evento tardío de la pista vieja no apaga el botón
  assert.equal(audio.reproduciendo, true)
})

test('cambiar de pista en pausa no empieza a sonar', async () => {
  const audio = useAudioStore()
  await audio.elegir('ruido-blanco')
  assert.equal(audio.pistaCodigo, 'ruido-blanco')
  assert.equal(audio.reproduciendo, false)
  assert.equal(creados.length, 0)
})

test('una pista que no existe se ignora', async () => {
  const audio = useAudioStore()
  await audio.elegir('reggaeton')
  assert.equal(audio.pistaCodigo, 'lluvia')
})

// ---------- Volumen ----------

test('el volumen cambia al instante y se limita entre 0 y 1', async () => {
  const audio = useAudioStore()
  await audio.reproducir()
  audio.cambiarVolumen(0.8)
  assert.equal(creados[0].volume, 0.8)
  audio.cambiarVolumen(7)
  assert.equal(audio.volumen, 1)
  audio.cambiarVolumen(-1)
  assert.equal(audio.volumen, 0)
  audio.cambiarVolumen('no es número')
  assert.equal(audio.volumen, 0)
})

// ---------- Preferencias y cierre de sesión ----------

test('la pista y el volumen se recuerdan al recargar', async () => {
  const audio = useAudioStore()
  await audio.elegir('lofi')
  audio.cambiarVolumen(0.25)

  setActivePinia(createPinia()) // como si se recargara la página
  const otra = useAudioStore()
  assert.equal(otra.pistaCodigo, 'lofi')
  assert.equal(otra.volumen, 0.25)
  assert.equal(otra.reproduciendo, false) // nunca suena solo al cargar
})

test('preferencias guardadas inválidas se ignoran', () => {
  almacen.set('pomopet.audio', JSON.stringify({ pista: 'nada', volumen: 'alto' }))
  const audio = useAudioStore()
  assert.equal(audio.pistaCodigo, 'lluvia')
  assert.equal(audio.volumen, VOLUMEN_POR_DEFECTO)
})

test('detener (al cerrar sesión) apaga el sonido', async () => {
  const audio = useAudioStore()
  await audio.reproducir()
  audio.detener()
  assert.equal(audio.reproduciendo, false)
  assert.equal(creados[0].paused, true)
})
