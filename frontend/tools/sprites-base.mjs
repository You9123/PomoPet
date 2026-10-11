// Dibuja los sprites base (variante `clasico`) de las mascotas: una tira horizontal de
// 4 cuadros de 32 x 32 por estado.
//
//   npm run sprites:base       # escribe public/mascotas/<especie>/clasico/<estado>.png
//   npm run sprites:variantes  # después, genera las demás variantes de color
//
// Para cambiar un dibujo o agregar una especie o un estado, se edita este archivo y se
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

// ---------- Dibujo de una mascota ----------
// o = { dy (rebote), ojos, boca, cuadro (0..3) }
function dibujar(especie, o) {
  const e = ESPECIES[especie]
  const L = new Lienzo()
  const cx = 16
  const dy = o.dy ?? 0
  const cabY = 17 + dy
  const par = o.cuadro % 2

  // cola
  if (especie === 'gato') {
    L.rect(24, 22 + dy - par, 2, 6, e.base)
    L.rect(25, 19 + dy - par, 3, 3, e.base)
    L.px(27, 19 + dy - par, e.detalle)
  } else if (especie === 'perro') {
    const mueve = par ? 0 : -1
    L.rect(24, 24 + dy + mueve, 3, 2, e.sombra)
    L.px(26, 23 + dy + mueve, e.sombra)
  } else {
    L.rect(23, 26 + dy, 4, 2, e.base)
    L.rect(26, 25 + dy, 3, 2, e.base)
    L.tri(28, 23 + dy, 31, 26 + dy, 28, 27 + dy, e.detalle)
  }

  // alas del dragón (detrás del cuerpo)
  if (especie === 'dragon') {
    const aleo = par ? -2 : 0
    L.tri(7, 20 + dy, 1, 14 + dy + aleo, 10, 15 + dy, e.sombra)
    L.tri(25, 20 + dy, 31, 14 + dy + aleo, 22, 15 + dy, e.sombra)
    L.px(2, 15 + dy + aleo, e.luz)
    L.px(29, 15 + dy + aleo, e.luz)
  }

  // cuerpo y patas
  L.elipse(cx, 25 + dy, 7, 5, e.base)
  L.elipse(cx, 26 + dy, 4, 3, e.vientre)
  L.rect(10, 28, 4, 3, e.sombra)
  L.rect(18, 28, 4, 3, e.sombra)
  L.rect(10, 28, 4, 1, e.base)
  L.rect(18, 28, 4, 1, e.base)

  // orejas / cuernos
  if (especie === 'gato') {
    L.tri(8, 12 + dy, 9, 4 + dy, 15, 10 + dy, e.base)
    L.tri(24, 12 + dy, 23, 4 + dy, 17, 10 + dy, e.base)
    L.tri(10, 11 + dy, 10, 7 + dy, 13, 10 + dy, e.nariz)
    L.tri(22, 11 + dy, 22, 7 + dy, 19, 10 + dy, e.nariz)
  } else if (especie === 'perro') {
    L.elipse(8, 15 + dy + par, 3, 6, e.detalle)
    L.elipse(24, 15 + dy + par, 3, 6, e.detalle)
  } else {
    L.tri(9, 11 + dy, 7, 3 + dy, 13, 9 + dy, e.detalle)
    L.tri(23, 11 + dy, 25, 3 + dy, 19, 9 + dy, e.detalle)
    L.tri(14, 9 + dy, 16, 4 + dy, 18, 9 + dy, e.sombra) // cresta
  }

  // cabeza
  L.elipse(cx, cabY, 9, 8, e.base)
  L.elipse(cx, cabY - 3, 6, 3, e.luz) // brillo
  if (especie === 'perro') L.elipse(cx, cabY + 3, 5, 4, e.vientre) // hocico
  if (especie === 'gato') {
    L.rect(15, cabY - 8, 2, 3, e.detalle)
    L.rect(11, cabY - 7, 1, 2, e.detalle)
    L.rect(20, cabY - 7, 1, 2, e.detalle)
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

  L.contorno(TINTA)
  return L
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

function cuadros(especie, estado) {
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
    const L = dibujar(especie, o)
    if (estado === 'estudiando') libro(L, c)
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
  const carpeta = path.join(raiz, especie, 'clasico')
  fs.mkdirSync(carpeta, { recursive: true })
  for (const estado of ESTADOS) {
    const { ancho, rgba } = aTira(cuadros(especie, estado))
    fs.writeFileSync(path.join(carpeta, `${estado}.png`), escribirPng(ancho, T, rgba))
  }
}
process.stdout.write(`Sprites base escritos en ${raiz}\n`)
