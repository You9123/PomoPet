// Síntesis de las pistas de audio ambiental (RF-07). Todo se genera por código con una semilla fija,
// así que los WAV de public/audio/ son obra propia del proyecto (licencia en docs/audio.md).
// Cada pista es un bucle: el final empalma con el inicio sin saltos.

export const FRECUENCIA = 22050 // Hz: suficiente para ambiente y la mitad de pesado que 44,1 kHz

/** Generador pseudoaleatorio con semilla (mulberry32): mismo resultado en cada ejecución. */
export function aleatorio(semilla) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const midiAHz = (nota) => 440 * 2 ** ((nota - 69) / 12)

// ---------- Utilidades de señal ----------

/** Ruido gaussiano (Box-Muller): al fundir dos tramos para cerrar el bucle no cambia su volumen. */
export function ruido(largo, azar) {
  const s = new Float32Array(largo)
  for (let i = 0; i < largo; i++) {
    s[i] = 0.3 * Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar())
  }
  return s
}

/** Filtro biquad (RBJ): 'pasa-bajos', 'pasa-altos' o 'pasa-banda'. Devuelve una señal nueva. */
export function filtrar(senal, tipo, frecuenciaCorte, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * frecuenciaCorte) / FRECUENCIA
  const alfa = Math.sin(w) / (2 * q)
  const cos = Math.cos(w)
  let b0, b1, b2
  if (tipo === 'pasa-bajos') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
  else if (tipo === 'pasa-altos') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
  else if (tipo === 'pasa-banda') [b0, b1, b2] = [alfa, 0, -alfa]
  else throw new Error(`Filtro desconocido: ${tipo}`)
  const a0 = 1 + alfa
  const a1 = -2 * cos
  const a2 = 1 - alfa
  const salida = new Float32Array(senal.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < senal.length; i++) {
    const x = senal[i]
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    salida[i] = y
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
  }
  return salida
}

/**
 * Convierte una señal de `largo + cruce` muestras en un bucle de `largo` muestras: el inicio se
 * funde (potencia constante) con lo que venía después del final, así al repetir no hay salto.
 */
export function cerrarBucle(senal, largo, cruce) {
  if (senal.length < largo + cruce) throw new Error('La señal es muy corta para cerrar el bucle')
  const salida = senal.slice(0, largo)
  for (let i = 0; i < cruce; i++) {
    const t = (i / cruce) * (Math.PI / 2)
    salida[i] = senal[i] * Math.sin(t) + senal[largo + i] * Math.cos(t)
  }
  return salida
}

export function rms(senal) {
  let suma = 0
  for (const v of senal) suma += v * v
  return Math.sqrt(suma / senal.length)
}

export function pico(senal) {
  let max = 0
  for (const v of senal) max = Math.max(max, Math.abs(v))
  return max
}

/** Escala la señal a un volumen percibido parecido entre pistas, sin pasarse del pico. */
export function normalizar(senal, rmsObjetivo, picoMaximo = 0.95) {
  const factor = Math.min(rmsObjetivo / rms(senal), picoMaximo / pico(senal))
  return senal.map((v) => v * factor)
}

// ---------- Pistas ----------

/** Ruido blanco: todas las frecuencias por igual. */
export function ruidoBlanco({ segundos = 10, semilla = 3 } = {}) {
  const largo = Math.round(segundos * FRECUENCIA)
  const cruce = FRECUENCIA // 1 s
  return normalizar(cerrarBucle(ruido(largo + cruce, aleatorio(semilla)), largo, cruce), 0.1)
}

/** Lluvia: un "shhh" de banda ancha que sube y baja, más gotas sueltas que golpean. */
export function lluvia({ segundos = 20, semilla = 1 } = {}) {
  const azar = aleatorio(semilla)
  const largo = Math.round(segundos * FRECUENCIA)
  const cruce = FRECUENCIA
  const total = largo + cruce

  const blanco = ruido(total, azar)
  const siseo = filtrar(blanco, 'pasa-banda', 3200, 1.1)
  const cuerpo = filtrar(filtrar(blanco, 'pasa-bajos', 900), 'pasa-altos', 150)

  const senal = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    // Ráfagas: ondas lentas con un número entero de ciclos por bucle, para que empalmen
    const fase = (2 * Math.PI * i) / largo
    const rafaga = 1 + 0.25 * Math.sin(2 * fase) + 0.12 * Math.sin(5 * fase + 1.3)
    senal[i] = siseo[i] * 0.8 * rafaga + cuerpo[i] * 0.6
  }

  // Gotas: senos cortos que se apagan rápido; muchas suaves y pocas fuertes
  const gotas = Math.round(70 * segundos)
  for (let g = 0; g < gotas; g++) {
    const inicio = Math.floor(azar() * total)
    const grande = azar() < 0.12
    const frecuencia = grande ? 700 + azar() * 900 : 1800 + azar() * 3500
    const caida = (grande ? 0.012 : 0.004) + azar() * 0.008
    const amplitud = (grande ? 0.6 : 0.25) * azar() ** 2
    const duracion = Math.min(Math.round(caida * 6 * FRECUENCIA), total - inicio)
    for (let k = 0; k < duracion; k++) {
      const t = k / FRECUENCIA
      senal[inicio + k] += amplitud * Math.sin(2 * Math.PI * frecuencia * t) * Math.exp(-t / caida)
    }
  }

  const suave = filtrar(filtrar(senal, 'pasa-bajos', 6000), 'pasa-bajos', 6000)
  return normalizar(cerrarBucle(suave, largo, cruce), 0.13)
}

// Lo-Fi: 80 BPM, 8 compases de 4/4 = 24 s. Progresión ii-V-I con acordes de séptima y novena.
const BPM = 80
const PULSO = 60 / BPM
const COMPASES = 8

// Acordes sin fundamental (la toca el bajo), en notas MIDI
const PROGRESION = [
  { bajo: 38, acorde: [53, 57, 60, 64] }, // Dm9
  { bajo: 43, acorde: [53, 59, 64] }, // G13
  { bajo: 36, acorde: [52, 55, 59, 62] }, // Cmaj9
  { bajo: 45, acorde: [55, 59, 60, 64] }, // Am9
  { bajo: 38, acorde: [53, 57, 60, 64] }, // Dm9
  { bajo: 43, acorde: [53, 59, 64, 65] }, // G7sus
  { bajo: 40, acorde: [55, 59, 62, 64] }, // Em7
  { bajo: 45, acorde: [55, 58, 61, 64] }, // A7(b9): vuelve a Dm9 al repetir
]

// Melodía corta: [compás, pulso, duración en pulsos, nota MIDI]
const MELODIA = [
  [2, 0, 1, 76], [2, 1.5, 0.5, 74], [2, 2, 1.5, 72],
  [3, 0.5, 2.5, 69],
  [6, 0, 1, 79], [6, 1, 1, 76], [6, 2.5, 1, 74],
  [7, 0, 1.5, 73], [7, 2, 1.5, 76],
]

/** Envolvente: ataque lineal, caída exponencial y apagado al soltar la nota. */
function envolvente(t, ataque, caida, suelta, apagado) {
  const subida = t < ataque ? t / ataque : 1
  const final = t > suelta ? Math.exp(-(t - suelta) / apagado) : 1
  return subida * Math.exp(-t / caida) * final
}

function pianoElectrico(frecuencia, duracion, fuerza) {
  const largo = Math.round((duracion + 0.8) * FRECUENCIA)
  const s = new Float32Array(largo)
  for (let k = 0; k < largo; k++) {
    const t = k / FRECUENCIA
    const fase = 2 * Math.PI * frecuencia * t
    const tono =
      Math.sin(fase) +
      0.6 * Math.sin(fase * 1.004) + // leve desafinación: efecto chorus
      0.25 * Math.sin(2 * fase) * Math.exp(-t / 0.3) +
      0.08 * Math.sin(3 * fase) * Math.exp(-t / 0.12)
    const tremolo = 1 + 0.12 * Math.sin(2 * Math.PI * 4.5 * t)
    s[k] = fuerza * tono * tremolo * envolvente(t, 0.006, 1.6, duracion, 0.18)
  }
  return s
}

function bajo(frecuencia, duracion, fuerza) {
  const largo = Math.round((duracion + 0.3) * FRECUENCIA)
  const s = new Float32Array(largo)
  for (let k = 0; k < largo; k++) {
    const t = k / FRECUENCIA
    const fase = 2 * Math.PI * frecuencia * t
    const tono = Math.tanh(1.5 * (Math.sin(fase) + 0.25 * Math.sin(2 * fase)))
    s[k] = fuerza * tono * envolvente(t, 0.01, 0.9, duracion, 0.08)
  }
  return s
}

function voz(frecuencia, duracion, fuerza) {
  const largo = Math.round((duracion + 0.6) * FRECUENCIA)
  const s = new Float32Array(largo)
  let fase = 0
  for (let k = 0; k < largo; k++) {
    const t = k / FRECUENCIA
    const vibrato = 1 + (t > 0.25 ? 0.006 * Math.sin(2 * Math.PI * 5 * t) : 0)
    fase += (2 * Math.PI * frecuencia * vibrato) / FRECUENCIA
    const tono = Math.sin(fase) + 0.15 * Math.sin(3 * fase)
    s[k] = fuerza * tono * envolvente(t, 0.04, 2, duracion, 0.15)
  }
  return s
}

function bombo(fuerza) {
  const largo = Math.round(0.45 * FRECUENCIA)
  const s = new Float32Array(largo)
  let fase = 0
  for (let k = 0; k < largo; k++) {
    const t = k / FRECUENCIA
    fase += (2 * Math.PI * (48 + 95 * Math.exp(-t / 0.035))) / FRECUENCIA
    s[k] = fuerza * Math.sin(fase) * Math.exp(-t / 0.16)
  }
  return s
}

function caja(fuerza, azar) {
  const largo = Math.round(0.3 * FRECUENCIA)
  const golpe = filtrar(ruido(largo, azar), 'pasa-banda', 1900, 0.8)
  const s = new Float32Array(largo)
  for (let k = 0; k < largo; k++) {
    const t = k / FRECUENCIA
    const cuerpo = 0.5 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t / 0.04)
    s[k] = fuerza * (golpe[k] * 2.2 * Math.exp(-t / 0.08) + cuerpo)
  }
  return s
}

function platillo(fuerza, azar) {
  const largo = Math.round(0.09 * FRECUENCIA)
  const brillo = filtrar(ruido(largo, azar), 'pasa-altos', 6500)
  return brillo.map((v, k) => fuerza * v * Math.exp(-k / FRECUENCIA / 0.018))
}

/** Lo-Fi: piano eléctrico, bajo, batería con swing, una melodía suave y crujido de vinilo. */
export function lofi({ semilla = 2 } = {}) {
  const azar = aleatorio(semilla)
  const largo = Math.round(COMPASES * 4 * PULSO * FRECUENCIA)
  const pista = new Float32Array(largo)

  // Suma un sonido en `segundos`; lo que se pasa del final da la vuelta al inicio (bucle perfecto)
  const sumar = (segundos, sonido) => {
    const inicio = Math.round(segundos * FRECUENCIA)
    for (let k = 0; k < sonido.length; k++) pista[(inicio + k) % largo] += sonido[k]
  }
  const humano = (fuerza) => fuerza * (0.85 + 0.3 * azar())
  const SWING = 0.09 // pulsos que se atrasa cada corchea a contratiempo

  PROGRESION.forEach(({ bajo: notaBajo, acorde }, compas) => {
    const t0 = compas * 4 * PULSO
    // Acordes: en el 1 y a contratiempo del 3, rasgueados (cada nota un poco después).
    // Cada golpe suena hasta el siguiente, para que no queden huecos.
    for (const [pulso, duracion] of [[0, 2.5 + SWING], [2.5 + SWING, 1.5 - SWING]]) {
      acorde.forEach((nota, i) => {
        sumar(t0 + pulso * PULSO + i * 0.014, pianoElectrico(midiAHz(nota), duracion * PULSO, humano(0.09)))
      })
    }
    sumar(t0, bajo(midiAHz(notaBajo), 1.8 * PULSO, 0.32))
    sumar(t0 + (2.5 + SWING) * PULSO, bajo(midiAHz(notaBajo), 1.2 * PULSO, 0.26))

    // Batería
    for (const pulso of [0, 1.75, 2.5 + SWING]) sumar(t0 + pulso * PULSO, bombo(humano(0.55)))
    for (const pulso of [1, 3]) sumar(t0 + pulso * PULSO + 0.012, caja(humano(0.2), azar))
    if (compas === COMPASES - 1) sumar(t0 + (3.5 + SWING) * PULSO, caja(humano(0.08), azar))
    for (let corchea = 0; corchea < 8; corchea++) {
      const pulso = corchea / 2 + (corchea % 2 ? SWING : 0)
      sumar(t0 + pulso * PULSO, platillo(humano(corchea % 2 ? 0.1 : 0.16), azar))
    }
  })

  for (const [compas, pulso, duracion, nota] of MELODIA) {
    sumar((compas * 4 + pulso) * PULSO, voz(midiAHz(nota), duracion * PULSO, humano(0.1)))
  }

  // Vinilo: chasquidos sueltos y un siseo muy bajo
  for (let c = 0; c < 6 * COMPASES * 4 * PULSO; c++) {
    const fuerza = 0.03 + 0.12 * azar() ** 3
    sumar(azar() * largo / FRECUENCIA, Float32Array.from([fuerza, -fuerza * 0.6, fuerza * 0.2]))
  }
  const siseo = cerrarBucle(filtrar(ruido(largo + FRECUENCIA, azar), 'pasa-banda', 3000, 0.5), largo, FRECUENCIA)
  for (let i = 0; i < largo; i++) pista[i] += siseo[i] * 0.012

  // Sonido "cálido": filtro pasa-bajos y saturación suave. Se procesa el bucle dos veces seguidas
  // y se queda con la segunda, para que el filtro ya venga "caliente" desde el final del bucle.
  const doble = new Float32Array(largo * 2)
  doble.set(pista)
  doble.set(pista, largo)
  const filtrado = filtrar(filtrar(doble, 'pasa-bajos', 3200, 0.8), 'pasa-bajos', 3200, 0.8)
  const calido = filtrado.subarray(largo).map((v) => Math.tanh(1.3 * v))
  return normalizar(calido, 0.14)
}

/** Las tres pistas, con el nombre de archivo (sin .wav) que usa el frontend. */
export function generarPistas() {
  return { lluvia: lluvia(), lofi: lofi(), 'ruido-blanco': ruidoBlanco() }
}
