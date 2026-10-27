// Lectura y escritura mínima de WAV (PCM de 16 bits, mono). Sin dependencias.
import { Buffer } from 'node:buffer'

/** Convierte muestras en [-1, 1] a un archivo WAV PCM de 16 bits mono. */
export function escribirWav(muestras, frecuencia) {
  const bytesDatos = muestras.length * 2
  const buf = Buffer.alloc(44 + bytesDatos)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + bytesDatos, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16) // tamaño del bloque fmt
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(frecuencia, 24)
  buf.writeUInt32LE(frecuencia * 2, 28) // bytes por segundo
  buf.writeUInt16LE(2, 32) // bytes por muestra
  buf.writeUInt16LE(16, 34) // bits por muestra
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(bytesDatos, 40)
  for (let i = 0; i < muestras.length; i++) {
    const v = Math.max(-1, Math.min(1, muestras[i]))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return buf
}

/** Devuelve { frecuencia, canales, bits, muestras } con muestras en un Float32Array en [-1, 1]. */
export function leerWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('No es un archivo WAV')
  }
  let fmt = null
  for (let pos = 12; pos + 8 <= buf.length; ) {
    const tipo = buf.toString('ascii', pos, pos + 4)
    const largo = buf.readUInt32LE(pos + 4)
    const datos = buf.subarray(pos + 8, pos + 8 + largo)
    if (tipo === 'fmt ') {
      fmt = {
        formato: datos.readUInt16LE(0),
        canales: datos.readUInt16LE(2),
        frecuencia: datos.readUInt32LE(4),
        bits: datos.readUInt16LE(14),
      }
    } else if (tipo === 'data') {
      if (!fmt || fmt.formato !== 1 || fmt.bits !== 16) throw new Error('Solo se lee PCM de 16 bits')
      const muestras = new Float32Array(datos.length / 2)
      for (let i = 0; i < muestras.length; i++) muestras[i] = datos.readInt16LE(i * 2) / 32767
      return { frecuencia: fmt.frecuencia, canales: fmt.canales, bits: fmt.bits, muestras }
    }
    pos += 8 + largo + (largo % 2)
  }
  throw new Error('El WAV no tiene datos')
}
