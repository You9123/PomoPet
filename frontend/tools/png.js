// Lectura y escritura mínima de PNG (8 bits: RGB, RGBA o paleta indexada). Sin dependencias.
import { Buffer } from 'node:buffer'
import zlib from 'node:zlib'

const FIRMA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function crc32(buf) {
  let crc = ~0
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}

function bloque(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** Devuelve { ancho, alto, rgba } con rgba en un Uint8Array de 4 bytes por píxel. */
export function leerPng(buf) {
  if (!buf.subarray(0, 8).equals(FIRMA)) throw new Error('No es un archivo PNG')

  let ancho = 0
  let alto = 0
  let tipoColor = 0
  let paleta = null
  let transparencia = null
  const datosIdat = []

  for (let pos = 8; pos < buf.length; ) {
    const largo = buf.readUInt32BE(pos)
    const tipo = buf.toString('ascii', pos + 4, pos + 8)
    const datos = buf.subarray(pos + 8, pos + 8 + largo)
    pos += 12 + largo

    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0)
      alto = datos.readUInt32BE(4)
      const profundidad = datos[8]
      tipoColor = datos[9]
      if (profundidad !== 8 || ![2, 3, 6].includes(tipoColor) || datos[12] !== 0) {
        throw new Error('PNG no soportado: use 8 bits por canal, RGB/RGBA/indexado y sin entrelazado')
      }
    } else if (tipo === 'PLTE') {
      paleta = datos
    } else if (tipo === 'tRNS') {
      transparencia = datos
    } else if (tipo === 'IDAT') {
      datosIdat.push(datos)
    } else if (tipo === 'IEND') {
      break
    }
  }

  const canales = { 2: 3, 3: 1, 6: 4 }[tipoColor]
  const fila = ancho * canales
  const crudo = zlib.inflateSync(Buffer.concat(datosIdat))
  const filas = Buffer.alloc(fila * alto)

  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (fila + 1)]
    for (let x = 0; x < fila; x++) {
      const bruto = crudo[y * (fila + 1) + 1 + x]
      const a = x >= canales ? filas[y * fila + x - canales] : 0
      const b = y > 0 ? filas[(y - 1) * fila + x] : 0
      const c = x >= canales && y > 0 ? filas[(y - 1) * fila + x - canales] : 0
      let prediccion = 0
      if (filtro === 1) prediccion = a
      else if (filtro === 2) prediccion = b
      else if (filtro === 3) prediccion = (a + b) >> 1
      else if (filtro === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        prediccion = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      filas[y * fila + x] = (bruto + prediccion) & 0xff
    }
  }

  const rgba = new Uint8Array(ancho * alto * 4)
  for (let i = 0; i < ancho * alto; i++) {
    if (tipoColor === 6) {
      rgba.set(filas.subarray(i * 4, i * 4 + 4), i * 4)
    } else if (tipoColor === 2) {
      rgba.set(filas.subarray(i * 3, i * 3 + 3), i * 4)
      rgba[i * 4 + 3] = 255
    } else {
      const indice = filas[i]
      rgba[i * 4] = paleta[indice * 3]
      rgba[i * 4 + 1] = paleta[indice * 3 + 1]
      rgba[i * 4 + 2] = paleta[indice * 3 + 2]
      rgba[i * 4 + 3] = transparencia && indice < transparencia.length ? transparencia[indice] : 255
    }
  }
  return { ancho, alto, rgba }
}

/** Escribe un PNG RGBA de 8 bits. */
export function escribirPng(ancho, alto, rgba) {
  const fila = ancho * 4
  const crudo = Buffer.alloc((fila + 1) * alto)
  for (let y = 0; y < alto; y++) {
    crudo[y * (fila + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * fila, fila).copy(crudo, y * (fila + 1) + 1)
  }
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(ancho, 0)
  cabecera.writeUInt32BE(alto, 4)
  cabecera[8] = 8
  cabecera[9] = 6
  return Buffer.concat([
    FIRMA,
    bloque('IHDR', cabecera),
    bloque('IDAT', zlib.deflateSync(crudo, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ])
}
