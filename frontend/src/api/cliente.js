// Cliente mínimo de la API. Cada llamada agrega el token y convierte los errores en ApiError.

const BASE = import.meta.env?.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(status, mensaje) {
    super(mensaje)
    this.status = status // 0 = no hubo respuesta (servidor apagado o sin red)
  }
}

let obtenerToken = () => null
let alNoAutorizado = () => {}

/** Lo llama el store de autenticación: le dice al cliente de dónde sacar el token. */
export function configurarCliente({ token, noAutorizado }) {
  obtenerToken = token
  alNoAutorizado = noAutorizado
}

function mensajeDeError(cuerpo, status) {
  const detalle = cuerpo?.detail
  if (typeof detalle === 'string') return detalle
  if (Array.isArray(detalle) && detalle.length) {
    // 422 de Pydantic: [{ msg: "Value error, La contraseña debe..." }]
    return detalle
      .map((e) => String(e.msg ?? '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join('. ')
  }
  return `Error ${status}`
}

export async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const headers = {}
  const opciones = { method: metodo, headers }
  if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json'
    opciones.body = JSON.stringify(cuerpo)
  }
  const token = obtenerToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let respuesta
  try {
    respuesta = await fetch(BASE + ruta, opciones)
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }

  let datos = null
  try {
    datos = await respuesta.json()
  } catch {
    // respuesta sin cuerpo JSON
  }

  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) alNoAutorizado() // token vencido o falso
    throw new ApiError(respuesta.status, mensajeDeError(datos, respuesta.status))
  }
  return datos
}
