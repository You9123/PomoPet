// Dibuja los sprites base (variante `clasico`) de las mascotas: una tira horizontal de
// 4 cuadros de 32 x 32 por estado.
//
//   npm run sprites:base       # escribe public/mascotas/<especie>/clasico/<etapa>/<estado>.png
//   npm run sprites:variantes  # después, genera las demás variantes de color
//
// Cada mascota tiene una versión por etapa de evolución (RF-04, ver docs/gamificacion.md).
// Para cambiar un dibujo o agregar una especie, un estado o una etapa, se edita este archivo y se
// vuelven a correr los dos comandos.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { escribirPng } from './png.js'

const T = 32 // lado del cuadro
const N = 4 // cuadros por animación

const raiz = process.argv[2]
  ? path.resolve(process.argv[2])
  : fileURLToPath(new URL('../public/mascotas', import.meta.url))

// ---------- Lienzo de píxeles ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

class Lienzo {
  constructor() {
    this.p = Array.from({ length: T }, () => Array(T).fill(null))
  }

  px(x, y, c) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < T && y < T && c) this.p[y][x] = c
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
  }

  elipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35)
        const dy = (y - cy) / (ry + 0.35)
        if (dx * dx + dy * dy <= 1) this.px(x, y, c)
      }
    }
  }

  tri(x1, y1, x2, y2, x3, y3, c) {
    const area = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    for (let y = Math.min(y1, y2, y3); y <= Math.max(y1, y2, y3); y++) {
      for (let x = Math.min(x1, x2, x3); x <= Math.max(x1, x2, x3); x++) {
        const a = area(x1, y1, x2, y2, x, y)
        const b = area(x2, y2, x3, y3, x, y)
        const d = area(x3, y3, x1, y1, x, y)
        if ((a >= 0 && b >= 0 && d >= 0) || (a <= 0 && b <= 0 && d <= 0)) this.px(x, y, c)
      }
    }
  }

  /** Contorno oscuro de 1 px alrededor de todo lo dibujado. */
  contorno(c) {
    const copia = this.p.map((fila) => [...fila])
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        if (copia[y][x]) continue
        const hayVecino = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => copia[y + dy]?.[x + dx])
        if (hayVecino) this.p[y][x] = c
      }
    }
  }
}

// ---------- Especies ----------
const TINTA = '#1d1230'
const BLANCO = '#fff8ee'

const ESPECIES = {
  gato: { base: '#ff9a3c', sombra: '#d96a1c', luz: '#ffc27a', vientre: '#ffe6c4', detalle: '#b34a12', nariz: '#ff6f91' },
  perro: { base: '#c98f5a', sombra: '#9a6638', luz: '#e2b88a', vientre: '#f3dcc0', detalle: '#6b4226', nariz: '#2a1a14' },
  dragon: { base: '#3ecf6e', sombra: '#1f9a4c', luz: '#8cf0a8', vientre: '#ffe9a8', detalle: '#ffd23f', nariz: '#1f9a4c' },
}

// Etapas de evolución, de la más pequeña a la más grande (mismos códigos que `backend/app/gamificacion.py`).
//   cria       cascarón en la cabeza, cuerpo corto y cabeza más pequeña
//   joven      el dibujo base
//   adulta     cuerpo más ancho y bufanda roja
//   legendaria bufanda real, corona dorada y destellos alrededor
// Los colores de los accesorios quedan fuera del rango de matiz que recolorea `recolor.js`,
// así que las variantes de color solo cambian el pelaje o las escamas.
const ETAPAS = ['cria', 'joven', 'adulta', 'legendaria']
const CASCARON = { claro: '#fff8ee', sombra: '#cfd3e8' }
const BUFANDA = { roja: ['#ff5a3c', '#b8321c'], real: ['#7c5cff', '#4b2fd0'] }
const ORO = { claro: '#ffd23f', oscuro: '#c99a00' }

// ---------- Dibujo de una mascota ----------
// o = { dy (rebote), ojos, boca, cuadro (0..3), etapa }
function dibujar(especie, o) {
  const e = ESPECIES[especie]
  const L = new Lienzo()
  const cx = 16
  const dy = o.dy ?? 0
  const etapa = o.etapa ?? 'joven'
  const cria = etapa === 'cria'
  const grande = etapa === 'adulta' || etapa === 'legendaria'
  const cabY = (cria ? 19 : 17) + dy
  const rxCab = cria ? 8 : 9 // radios de la cabeza
  const ryCab = cria ? 7 : 8
  const bajar = cria ? 3 : 0 // orejas y cuernos bajan con la cabeza
  const par = o.cuadro % 2

  // cola
  const tx = cria ? -1 : 0 // el cuerpo de la cría es más angosto: la cola se acerca
  if (especie === 'gato') {
    L.rect(24 + tx, 22 + dy - par, 2, 6, e.base)
    L.rect(25 + tx, 19 + dy - par, 3, 3, e.base)
    L.px(27 + tx, 19 + dy - par, e.detalle)
  } else if (especie === 'perro') {
    const mueve = par ? 0 : -1
    L.rect(24 + tx, 24 + dy + mueve, 3, 2, e.sombra)
    L.px(26 + tx, 23 + dy + mueve, e.sombra)
  } else {
    L.rect(23 + tx, 26 + dy, 4, 2, e.base)
    L.rect(26 + tx, 25 + dy, 3, 2, e.base)
    L.tri(28 + tx, 23 + dy, 31 + tx, 26 + dy, 28 + tx, 27 + dy, e.detalle)
  }

  // alas del dragón (detrás del cuerpo)
  if (especie === 'dragon') {
    const aleo = par ? -2 : 0
    if (cria) {
      // alitas pequeñas
      L.tri(9, 23 + dy, 4, 19 + dy + aleo, 11, 19 + dy, e.sombra)
      L.tri(23, 23 + dy, 28, 19 + dy + aleo, 21, 19 + dy, e.sombra)
    } else {
      L.tri(7, 20 + dy, 1, 14 + dy + aleo, 10, 15 + dy, e.sombra)
      L.tri(25, 20 + dy, 31, 14 + dy + aleo, 22, 15 + dy, e.sombra)
      L.px(2, 15 + dy + aleo, e.luz)
      L.px(29, 15 + dy + aleo, e.luz)
    }
  }

  // cuerpo y patas
  if (cria) {
    L.elipse(cx, 26 + dy, 6, 4, e.base)
    L.elipse(cx, 27 + dy, 3, 2, e.vientre)
  } else {
    L.elipse(cx, 25 + dy, grande ? 8 : 7, 5, e.base)
    L.elipse(cx, 26 + dy, grande ? 5 : 4, 3, e.vientre)
  }
  L.rect(10, 28, 4, 3, e.sombra)
  L.rect(18, 28, 4, 3, e.sombra)
  L.rect(10, 28, 4, 1, e.base)
  L.rect(18, 28, 4, 1, e.base)

  // orejas / cuernos
  const b = bajar + dy
  if (especie === 'gato') {
    L.tri(8, 12 + b, 9, 4 + b, 15, 10 + b, e.base)
    L.tri(24, 12 + b, 23, 4 + b, 17, 10 + b, e.base)
    L.tri(10, 11 + b, 10, 7 + b, 13, 10 + b, e.nariz)
    L.tri(22, 11 + b, 22, 7 + b, 19, 10 + b, e.nariz)
  } else if (especie === 'perro') {
    L.elipse(8, 15 + b + par, 3, 6, e.detalle)
    L.elipse(24, 15 + b + par, 3, 6, e.detalle)
  } else {
    L.tri(9, 11 + b, 7, 3 + b, 13, 9 + b, e.detalle)
    L.tri(23, 11 + b, 25, 3 + b, 19, 9 + b, e.detalle)
    if (!cria && etapa !== 'legendaria') L.tri(14, 9 + b, 16, 4 + b, 18, 9 + b, e.sombra) // cresta (la corona la tapa)
  }

  // cabeza
  L.elipse(cx, cabY, rxCab, ryCab, e.base)
  L.elipse(cx, cabY - 3, cria ? 5 : 6, 3, e.luz) // brillo
  if (especie === 'perro') L.elipse(cx, cabY + 3, 5, 4, e.vientre) // hocico
  if (especie === 'gato') {
    L.rect(15, cabY - ryCab, 2, 3, e.detalle)
    L.rect(11, cabY - ryCab + 1, 1, 2, e.detalle)
    L.rect(20, cabY - ryCab + 1, 1, 2, e.detalle)
  }
  if (especie === 'dragon') {
    L.elipse(cx, cabY + 3, 5, 3, e.vientre) // hocico
    L.px(14, cabY + 3, e.sombra)
    L.px(18, cabY + 3, e.sombra)
  }

  L.rect(15, cabY + 2, 2, 1, e.nariz) // nariz

  // ojos
  const ey = cabY - 1
  const ojo = (x) => {
    switch (o.ojos) {
      case 'felices':
        L.px(x, ey, TINTA)
        L.px(x + 1, ey - 1, TINTA)
        L.px(x + 2, ey, TINTA)
        break
      case 'cerrados':
      case 'parpadeo':
        L.rect(x, ey + 1, 3, 1, TINTA)
        break
      case 'tristes':
        L.rect(x, ey, 2, 3, TINTA)
        L.px(x + 1, ey, BLANCO)
        break
      case 'concentrados':
        L.rect(x, ey, 2, 2, TINTA)
        break
      default:
        L.rect(x, ey, 2, 3, TINTA)
        L.px(x, ey, BLANCO)
    }
  }
  ojo(11)
  ojo(19)
  if (o.ojos === 'concentrados') {
    // lentes
    for (const x of [10, 18]) {
      L.rect(x, ey - 1, 5, 1, TINTA)
      L.rect(x, ey + 3, 5, 1, TINTA)
      L.rect(x, ey - 1, 1, 5, TINTA)
      L.rect(x + 4, ey - 1, 1, 5, TINTA)
    }
    L.rect(15, ey + 1, 2, 1, TINTA)
  }
  if (o.ojos === 'tristes') {
    L.rect(10, ey - 2, 4, 1, TINTA)
    L.rect(18, ey - 2, 4, 1, TINTA)
  }

  // boca
  const by = cabY + 5
  switch (o.boca) {
    case 'abierta':
      L.rect(14, by, 4, 2, TINTA)
      L.rect(15, by + 1, 2, 1, '#ff6f91')
      break
    case 'plana':
      L.rect(14, by, 4, 1, TINTA)
      break
    case 'triste':
      L.rect(14, by + 1, 4, 1, TINTA)
      L.px(13, by + 2, TINTA)
      L.px(18, by + 2, TINTA)
      break
    case 'dormida':
      L.rect(15, by, 2, 1, TINTA)
      break
    default:
      L.px(13, by, TINTA)
      L.rect(14, by + 1, 4, 1, TINTA)
      L.px(18, by, TINTA)
  }

  // mejillas
  if (o.boca === 'sonrisa' || o.boca === 'abierta') {
    for (const x of [9, 10, 21, 22]) L.px(x, cabY + 3, '#ff8fa3')
  }

  if (cria) cascaron(L, cabY - ryCab)
  if (grande) bufanda(L, cabY, etapa === 'legendaria' ? BUFANDA.real : BUFANDA.roja)
  if (etapa === 'legendaria') corona(L, cabY)

  L.contorno(TINTA)
  return L
}

// ---------- Accesorios por etapa ----------
/** Cría: la cáscara del huevo del que nació, como un gorrito con el borde en picos. */
function cascaron(L, techo) {
  L.rect(12, techo - 1, 9, 1, CASCARON.claro)
  L.rect(11, techo, 11, 1, CASCARON.claro)
  L.rect(11, techo + 1, 11, 1, CASCARON.sombra)
  for (let x = 11; x <= 21; x += 2) L.px(x, techo + 2, CASCARON.sombra)
}

/** Adulta y legendaria: bufanda en el cuello con una punta colgando. */
function bufanda(L, cabY, [claro, oscuro]) {
  L.rect(9, cabY + 7, 14, 2, claro)
  L.rect(9, cabY + 8, 14, 1, oscuro)
  L.rect(19, cabY + 9, 3, 4, claro)
  L.rect(19, cabY + 12, 3, 1, oscuro)
}

/** Legendaria: corona dorada con una gema roja. */
function corona(L, cabY) {
  L.rect(12, cabY - 8, 9, 2, ORO.claro)
  L.rect(12, cabY - 7, 9, 1, ORO.oscuro)
  for (const x of [12, 14, 16, 18, 20]) L.px(x, cabY - 9, ORO.claro)
  L.px(16, cabY - 10, ORO.claro)
  L.px(16, cabY - 8, '#ff5a3c')
}

/** Legendaria: destellos que titilan alrededor (solo sobre píxeles libres, después del contorno). */
function destellos(L, cuadro) {
  const lugares = [[3, 24], [29, 22], [2, 9], [30, 11], [6, 29], [26, 29]]
  lugares.forEach(([x, y], i) => {
    if (L.p[y][x]) return
    L.px(x, y, (cuadro + i) % 2 === 0 ? '#fff3a8' : '#ffd23f')
  })
}

// ---------- Accesorios por estado ----------
function estrella(L, x, y, c) {
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) L.px(x + dx, y + dy, c)
}

function libro(L, cuadro) {
  const y = 26
  L.rect(8, y, 16, 5, '#ff5a3c')
  L.rect(9, y + 1, 7, 3, BLANCO)
  L.rect(16, y + 1, 7, 3, BLANCO)
  L.rect(16, y, 1, 5, '#b8321c')
  L.rect(10, y + 2, 5, 1, '#9aa0c8')
  if (cuadro % 2 === 0) L.rect(17, y + 2, 5, 1, '#9aa0c8')
  else L.rect(20, y + 1, 3, 3, '#e6e0ff') // página que se voltea
  for (let x = 7; x <= 24; x++) {
    L.px(x, y - 1, TINTA)
    L.px(x, y + 5, TINTA)
  }
  for (let j = y; j < y + 5; j++) {
    L.px(7, j, TINTA)
    L.px(24, j, TINTA)
  }
}

function zeta(L, x, y, c) {
  L.rect(x, y, 3, 1, c)
  L.px(x + 2, y + 1, c)
  L.px(x + 1, y + 2, c)
  L.rect(x, y + 3, 3, 1, c)
}

function nube(L, cuadro) {
  L.elipse(16, 4, 7, 2, '#8e9bc9')
  L.elipse(11, 5, 3, 2, '#8e9bc9')
  L.elipse(21, 5, 3, 2, '#8e9bc9')
  const gotas = [[11, 8], [16, 9], [21, 8]]
  gotas.forEach(([gx, gy], i) => L.px(gx, gy + ((cuadro + i) % 4), '#4cc9f0'))
}

// ---------- Animaciones ----------
const ESTADOS = ['inactivo', 'estudiando', 'exito', 'cancelado', 'descanso']

function cuadros(especie, estado, etapa) {
  const salida = []
  for (let c = 0; c < N; c++) {
    let o
    switch (estado) {
      case 'estudiando':
        o = { dy: [0, 0, 1, 0][c], ojos: 'concentrados', boca: 'plana', cuadro: c }
        break
      case 'exito':
        o = { dy: [0, -3, -4, -2][c], ojos: 'felices', boca: 'abierta', cuadro: c }
        break
      case 'cancelado':
        o = { dy: 1, ojos: 'tristes', boca: 'triste', cuadro: c }
        break
      case 'descanso':
        o = { dy: [0, 1, 1, 0][c], ojos: 'cerrados', boca: 'dormida', cuadro: c }
        break
      default:
        o = { dy: [0, 0, 1, 1][c], ojos: c === 3 ? 'parpadeo' : 'abiertos', boca: 'sonrisa', cuadro: c }
    }
    const L = dibujar(especie, { ...o, etapa })
    if (estado === 'estudiando') libro(L, c)
    if (etapa === 'legendaria') destellos(L, c)
    if (estado === 'exito') {
      const pos = [[4, 6], [27, 8], [5, 14], [26, 4]]
      estrella(L, pos[c][0], pos[c][1], '#ffd23f')
      estrella(L, pos[(c + 2) % 4][0], pos[(c + 2) % 4][1], '#fff3a8')
    }
    if (estado === 'cancelado') nube(L, c)
    if (estado === 'descanso') {
      zeta(L, 24, 8 - Math.floor(c / 2), '#4cc9f0')
      if (c >= 2) zeta(L, 27, 3, '#9fe6ff')
    }
    salida.push(L)
  }
  return salida
}

function aTira(frames) {
  const ancho = T * frames.length
  const rgba = new Uint8Array(ancho * T * 4)
  frames.forEach((L, f) => {
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const color = L.p[y][x]
        if (!color) continue
        const [r, g, b] = hex(color)
        rgba.set([r, g, b, 255], (y * ancho + f * T + x) * 4)
      }
    }
  })
  return { ancho, rgba }
}

for (const especie of Object.keys(ESPECIES)) {
  for (const etapa of ETAPAS) {
    const carpeta = path.join(raiz, especie, 'clasico', etapa)
    fs.mkdirSync(carpeta, { recursive: true })
    for (const estado of ESTADOS) {
      const { ancho, rgba } = aTira(cuadros(especie, estado, etapa))
      fs.writeFileSync(path.join(carpeta, `${estado}.png`), escribirPng(ancho, T, rgba))
    }
  }
}
process.stdout.write(`Sprites base escritos en ${raiz}\n`)
