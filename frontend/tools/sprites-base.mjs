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
// Cada una cambia la silueta, no solo un detalle:
//   cria       diminuta: solo una cabeza grande asomando de media cáscara de huevo
//   joven      el dibujo base
//   adulta     cuerpo más ancho, capa roja que se abre detrás y broche dorado
//   legendaria alas, capa real con armiño, corona grande con gemas, doble contorno dorado y estrellas
// Los colores de los accesorios quedan fuera del rango de matiz que recolorea `recolor.js`,
// así que las variantes de color solo cambian el pelaje o las escamas.
const ETAPAS = ['cria', 'joven', 'adulta', 'legendaria']
const CASCARON = { claro: '#fff8ee', sombra: '#cfd3e8' }
const CAPA = { roja: ['#ff5a3c', '#b8321c'], real: ['#7c5cff', '#4b2fd0'] }
const ORO = { claro: '#ffd23f', oscuro: '#c99a00', brillo: '#fff3a8' }
const PLUMA = { claro: '#fff8ee', sombra: '#cfd3e8' }

// ---------- Dibujo de una mascota ----------
// o = { dy (rebote), ojos, boca, cuadro (0..3), etapa }
function dibujar(especie, o) {
  const e = ESPECIES[especie]
  const L = new Lienzo()
  const cx = 16
  const dy = o.dy ?? 0
  const etapa = o.etapa ?? 'joven'
  const cria = etapa === 'cria'
  const adulta = etapa === 'adulta'
  const legendaria = etapa === 'legendaria'
  const grande = adulta || legendaria
  const cabY = (cria ? 19 : 17) + dy
  const rxCab = cria ? 7 : 9 // radios de la cabeza
  const ryCab = cria ? 6 : 8
  const bajar = cria ? 4 : 0 // orejas y cuernos bajan con la cabeza
  const par = o.cuadro % 2
  const aleo = par ? -2 : 0

  // alas de la legendaria: capa aparte (con su propio contorno oscuro) que se pega detrás al final
  let fondo = null
  if (legendaria) {
    fondo = new Lienzo()
    alas(fondo, especie, dy, aleo)
    fondo.contorno(TINTA)
  }

  // la capa va detrás del cuerpo
  if (grande) capa(L, dy, legendaria ? CAPA.real : CAPA.roja, legendaria)

  // cola
  if (!cria) {
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
  }

  // alas del dragón (detrás del cuerpo); la legendaria las lleva doradas, ver `alas`
  if (especie === 'dragon' && !legendaria) {
    if (cria) {
      // alitas pequeñas a los lados de la cabeza
      L.tri(9, 22 + dy, 3, 16 + dy + aleo, 10, 17 + dy, e.sombra)
      L.tri(23, 22 + dy, 29, 16 + dy + aleo, 22, 17 + dy, e.sombra)
    } else {
      L.tri(7, 20 + dy, 1, 14 + dy + aleo, 10, 15 + dy, e.sombra)
      L.tri(25, 20 + dy, 31, 14 + dy + aleo, 22, 15 + dy, e.sombra)
      L.px(2, 15 + dy + aleo, e.luz)
      L.px(29, 15 + dy + aleo, e.luz)
    }
  }

  // cuerpo y patas (la cría solo asoma la cabeza del cascarón)
  if (!cria) {
    L.elipse(cx, 25 + dy, grande ? 8 : 7, 5, e.base)
    L.elipse(cx, 26 + dy, grande ? 5 : 4, 3, e.vientre)
    L.rect(10, 28, 4, 3, e.sombra)
    L.rect(18, 28, 4, 3, e.sombra)
    L.rect(10, 28, 4, 1, e.base)
    L.rect(18, 28, 4, 1, e.base)
  }

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
    if (!cria && !legendaria) L.tri(14, 9 + b, 16, 4 + b, 18, 9 + b, e.sombra) // cresta (la corona la tapa)
  }

  // cabeza
  L.elipse(cx, cabY, rxCab, ryCab, e.base)
  L.elipse(cx, cabY - 3, cria ? 4 : 6, 3, e.luz) // brillo
  if (especie === 'perro') L.elipse(cx, cabY + 3, cria ? 4 : 5, cria ? 3 : 4, e.vientre) // hocico
  if (especie === 'gato') {
    L.rect(15, cabY - ryCab, 2, 3, e.detalle)
    L.rect(11, cabY - ryCab + 1, 1, 2, e.detalle)
    L.rect(20, cabY - ryCab + 1, 1, 2, e.detalle)
  }
  if (especie === 'dragon') {
    L.elipse(cx, cabY + 3, cria ? 4 : 5, cria ? 2 : 3, e.vientre) // hocico
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
    for (const x of cria ? [10, 21] : [9, 10, 21, 22]) L.px(x, cabY + 3, '#ff8fa3')
  }

  if (cria) cascaron(L)
  if (adulta) bufanda(L, cabY, par)
  if (legendaria) broche(L, cabY)
  if (legendaria) corona(L, cabY)

  L.contorno(TINTA)
  if (legendaria) L.contorno(ORO.claro) // segundo contorno, dorado: resplandor
  if (fondo) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (!L.p[y][x]) L.p[y][x] = fondo.p[y][x]
  }
  return L
}

// ---------- Accesorios por etapa ----------
/** Cría: media cáscara de huevo alrededor, con el borde en picos y la base redondeada. */
function cascaron(L) {
  for (let x = 8; x <= 24; x += 2) L.rect(x, 24, 1, 2, CASCARON.claro) // picos
  L.rect(8, 26, 17, 3, CASCARON.claro)
  L.rect(9, 29, 15, 1, CASCARON.claro)
  L.rect(10, 30, 13, 1, CASCARON.sombra)
  L.rect(12, 31, 9, 1, CASCARON.sombra)
  L.rect(21, 27, 3, 2, CASCARON.sombra) // sombra del lado derecho
  L.px(11, 27, '#ffb3c7') // manchitas
  L.px(14, 28, '#ffb3c7')
  L.px(18, 27, '#b9e6ff')
}

/** Adulta y legendaria: capa abierta detrás del cuerpo; la real lleva armiño en el borde. */
function capa(L, dy, [claro, oscuro], real) {
  L.tri(16, 20 + dy, 2, 31, 30, 31, claro)
  L.tri(16, 20 + dy, 2, 31, 11, 31, oscuro)
  if (real) {
    L.rect(2, 30, 29, 2, CASCARON.claro)
    for (let x = 4; x <= 28; x += 4) L.px(x, 31, TINTA)
  }
}

/** Adulta: bufanda roja con una punta larga que ondea al aire. */
function bufanda(L, cabY, par) {
  const [claro, oscuro] = CAPA.roja
  L.rect(9, cabY + 7, 14, 2, claro)
  L.rect(9, cabY + 8, 14, 1, oscuro)
  L.rect(22, cabY + 6 - par, 4, 2, claro)
  L.rect(25, cabY + 5 - par, 4, 2, claro)
  L.rect(28, cabY + 4 - par * 2, 3, 2, oscuro)
}

/** Legendaria: broche dorado con una gema que sujeta la capa. */
function broche(L, cabY) {
  L.rect(15, cabY + 8, 2, 2, ORO.claro)
  L.px(15, cabY + 8, '#ff5a3c')
}

/** Legendaria: corona dorada grande con gemas. */
function corona(L, cabY) {
  L.rect(11, cabY - 8, 11, 2, ORO.claro)
  L.rect(11, cabY - 7, 11, 1, ORO.oscuro)
  for (const x of [11, 13, 19, 21]) L.px(x, cabY - 9, ORO.claro)
  L.rect(15, cabY - 9, 3, 1, ORO.claro)
  L.rect(16, cabY - 10, 1, 2, ORO.claro)
  L.px(16, cabY - 11, ORO.brillo)
  L.px(13, cabY - 8, '#4cc9f0')
  L.px(16, cabY - 8, '#ff5a3c')
  L.px(19, cabY - 8, '#4cc9f0')
}

/** Legendaria: alas grandes. Plumas blancas en el gato y el perro, doradas en el dragón. */
function alas(L, especie, dy, aleo) {
  const [claro, sombra] = especie === 'dragon' ? [ORO.claro, ORO.oscuro] : [PLUMA.claro, PLUMA.sombra]
  const a = aleo // el ala aletea: la punta sube y baja
  // ala izquierda: una mancha grande de sombra y, encima, tres plumas claras que se abren hacia arriba
  L.tri(10, 28 + dy, 0, 1 + dy + a, 10, 8 + dy, sombra)
  L.tri(10, 24 + dy, 1, 4 + dy + a, 10, 11 + dy, claro)
  L.tri(10, 26 + dy, 0, 14 + dy + a, 10, 17 + dy, claro)
  L.tri(10, 28 + dy, 2, 22 + dy + a, 10, 23 + dy, claro)
  // ala derecha, en espejo
  L.tri(21, 28 + dy, 31, 1 + dy + a, 21, 8 + dy, sombra)
  L.tri(21, 24 + dy, 30, 4 + dy + a, 21, 11 + dy, claro)
  L.tri(21, 26 + dy, 31, 14 + dy + a, 21, 17 + dy, claro)
  L.tri(21, 28 + dy, 29, 22 + dy + a, 21, 23 + dy, claro)
  for (const [x, y] of [[0, 1], [31, 1], [1, 4], [30, 4]]) L.px(x, y + dy + a, ORO.oscuro)
}

/** Legendaria: estrellas que titilan en las esquinas (solo si el lugar está libre). */
function aura(L, cuadro) {
  const lugares = [[3, 28], [28, 27], [3, 3], [28, 4]]
  lugares.forEach(([x, y], i) => {
    if ((cuadro + i) % 2 === 0 && !L.p[y][x]) estrella(L, x, y, i % 2 ? ORO.brillo : ORO.claro)
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
    if (etapa === 'legendaria') aura(L, c)
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
