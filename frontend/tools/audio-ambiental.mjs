// Genera las pistas del reproductor de audio ambiental (RF-07) en public/audio/<pista>.wav.
// Uso: npm run audio
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { FRECUENCIA, generarPistas } from './sintesis.js'
import { escribirWav } from './wav.js'

const carpeta = fileURLToPath(new URL('../public/audio', import.meta.url))
fs.mkdirSync(carpeta, { recursive: true })

for (const [nombre, muestras] of Object.entries(generarPistas())) {
  const archivo = `${carpeta}/${nombre}.wav`
  fs.writeFileSync(archivo, escribirWav(muestras, FRECUENCIA))
  const segundos = (muestras.length / FRECUENCIA).toFixed(1)
  console.log(`${nombre}.wav: ${segundos} s, ${(fs.statSync(archivo).size / 1024).toFixed(0)} KB`)
}
