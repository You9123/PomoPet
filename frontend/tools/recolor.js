// Variantes de color de las mascotas. Recolorea SOLO el color principal de la especie
// (pelaje, escamas, alas) y deja intactos el contorno, los ojos, los accesorios y los efectos,
// así que sirve con cualquier sprite `clasico`, también con el arte final.

export const ESPECIES = {
  // matiz: rango (en grados) del color principal; base: su matiz típico; satMin/lMin/lMax
  // excluyen grises, contornos casi negros y blancos (ojos, páginas del libro).
  gato: { matiz: [15, 42], base: 30, satMin: 0.25, lMin: 0.18, lMax: 0.95 },
  perro: { matiz: [15, 42], base: 29, satMin: 0.2, lMin: 0.18, lMax: 0.95 },
  dragon: { matiz: [95, 175], base: 140, satMin: 0.25, lMin: 0.18, lMax: 0.95 },
}

// matiz: matiz de destino (omitirlo conserva el original)
// sat: multiplicador de saturación
// luz: [multiplicador, suma] aplicado a la luminosidad (conserva el orden sombra < base < luz)
export const VARIANTES = {
  clasico: { nombre: 'Clásico' },
  ceniza: { nombre: 'Ceniza', sat: 0.1 },
  sombra: { nombre: 'Sombra', sat: 0.15, luz: [0.5, 0] },
  nieve: { nombre: 'Nieve', sat: 0.2, luz: [0.45, 0.55] },
  rosa: { nombre: 'Rosa', matiz: 335, sat: 0.95, luz: [1, 0.04] },
  celeste: { nombre: 'Celeste', matiz: 200, sat: 0.9 },
  violeta: { nombre: 'Violeta', matiz: 270, sat: 0.9 },
  dorado: { nombre: 'Dorado', matiz: 46, sat: 1, luz: [1.05, 0] },
  fuego: { nombre: 'Fuego', matiz: 6, sat: 1 },
  hielo: { nombre: 'Hielo', matiz: 192, sat: 0.85, luz: [1, 0.04] },
}

// Qué variantes tiene cada especie (la primera siempre es `clasico`, el arte original).
export const POR_ESPECIE = {
  gato: ['clasico', 'ceniza', 'sombra', 'nieve', 'rosa', 'celeste'],
  perro: ['clasico', 'ceniza', 'sombra', 'nieve', 'dorado', 'celeste'],
  dragon: ['clasico', 'fuego', 'hielo', 'violeta', 'sombra', 'nieve'],
}

const limitar = (v) => Math.min(1, Math.max(0, v))

export function rgbAHsl(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

export function hslARgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** ¿Es este color parte del "color principal" de la especie? */
export function esColorPrincipal(r, g, b, especie) {
  const cfg = ESPECIES[especie]
  const [h, s, l] = rgbAHsl(r, g, b)
  return h >= cfg.matiz[0] && h <= cfg.matiz[1] && s >= cfg.satMin && l >= cfg.lMin && l <= cfg.lMax
}

/** Devuelve [r, g, b] recoloreado; los píxeles que no son del color principal no cambian. */
export function recolorear(r, g, b, especie, variante) {
  const v = VARIANTES[variante]
  if (!v) throw new Error(`Variante desconocida: ${variante}`)
  if (variante === 'clasico' || !esColorPrincipal(r, g, b, especie)) return [r, g, b]

  const cfg = ESPECIES[especie]
  const [h, s, l] = rgbAHsl(r, g, b)
  const h2 = v.matiz === undefined ? h : (h + v.matiz - cfg.base + 360) % 360
  const s2 = limitar(s * (v.sat ?? 1))
  const [mult, suma] = v.luz ?? [1, 0]
  return hslARgb(h2, s2, limitar(l * mult + suma))
}

/** Aplica la variante a todo un lienzo RGBA y devuelve uno nuevo (la transparencia no cambia). */
export function recolorearImagen(rgba, especie, variante) {
  const salida = new Uint8Array(rgba)
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue
    const [r, g, b] = recolorear(rgba[i], rgba[i + 1], rgba[i + 2], especie, variante)
    salida[i] = r
    salida[i + 1] = g
    salida[i + 2] = b
  }
  return salida
}
