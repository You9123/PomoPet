// Genera las variantes de color de las mascotas a partir de los sprites `clasico`.
//
//   npm run sprites:variantes
//
// Lee      public/mascotas/<especie>/clasico/<estado>.png
// Escribe  public/mascotas/<especie>/<variante>/<estado>.png
//          database/init/04_variantes.sql  (la lista de colores que usa la API)
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { escribirPng, leerPng } from './png.js'
import { POR_ESPECIE, VARIANTES, esColorPrincipal, recolorear, recolorearImagen } from './recolor.js'

const raiz = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL('../public/mascotas', import.meta.url))

const sqlSalida = process.argv[3]
  ? path.resolve(process.argv[3])
  : fileURLToPath(new URL('../../database/init/04_variantes.sql', import.meta.url))

const hex = ([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`

/** El color principal más frecuente del sprite: sirve de "muestra" para elegir la variante. */
function colorMuestra(imagen, especie) {
  const cuenta = new Map()
  for (let i = 0; i < imagen.rgba.length; i += 4) {
    if (imagen.rgba[i + 3] === 0) continue
    const [r, g, b] = [imagen.rgba[i], imagen.rgba[i + 1], imagen.rgba[i + 2]]
    if (!esColorPrincipal(r, g, b, especie)) continue
    const clave = `${r},${g},${b}`
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
  }
  const [mejor] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  return mejor ? mejor.split(',').map(Number) : [128, 128, 128]
}

const filasSql = []
let archivos = 0

for (const [especie, variantes] of Object.entries(POR_ESPECIE)) {
  const origen = path.join(raiz, especie, 'clasico')
  if (!fs.existsSync(origen)) {
    process.stderr.write(`Falta ${origen}: se omite ${especie}\n`)
    continue
  }
  const estados = fs.readdirSync(origen).filter((f) => f.endsWith('.png'))
  const muestra = colorMuestra(leerPng(fs.readFileSync(path.join(origen, 'inactivo.png'))), especie)

  variantes.forEach((variante, i) => {
    const color = hex(recolorear(...muestra, especie, variante))
    filasSql.push(`    ('${especie}', '${variante}', '${VARIANTES[variante].nombre}', '${color}', ${i + 1})`)
  })

  for (const variante of variantes.filter((v) => v !== 'clasico')) {
    const destino = path.join(raiz, especie, variante)
    fs.mkdirSync(destino, { recursive: true })
    for (const archivo of estados) {
      const imagen = leerPng(fs.readFileSync(path.join(origen, archivo)))
      const rgba = recolorearImagen(imagen.rgba, especie, variante)
      fs.writeFileSync(path.join(destino, archivo), escribirPng(imagen.ancho, imagen.alto, rgba))
      archivos++
    }
  }
}

const sql = [
  '-- GENERADO por `npm run sprites:variantes` (frontend/tools/variantes.mjs). No editar a mano.',
  '-- Colores disponibles de cada especie; `codigo` es la carpeta de imágenes en el frontend.',
  'INSERT INTO variantes_mascota (especie_id, codigo, nombre, muestra, orden)',
  'SELECT e.id, v.codigo, v.nombre, v.muestra, v.orden',
  'FROM (VALUES',
  filasSql.join(',\n'),
  ') AS v(especie, codigo, nombre, muestra, orden)',
  'JOIN especies_mascota e ON e.codigo = v.especie;',
  '',
].join('\n')
fs.writeFileSync(sqlSalida, sql)
process.stdout.write(`Listo: ${archivos} sprites en ${raiz}\nSemilla SQL: ${sqlSalida}\n`)
