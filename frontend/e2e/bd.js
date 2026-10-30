// Acceso directo a PostgreSQL para las pruebas de integración. Solo hace dos cosas que la app no permite:
// adelantar el reloj de una sesión (para no esperar 25 minutos) y borrar los usuarios de prueba.
import fs from 'node:fs'
import process from 'node:process'
import { parseEnv } from 'node:util'

import pg from 'pg'

/** E2E_DATABASE_URL, o la BD de `docker compose` armada con las variables del .env de la raíz. */
function urlDeLaBd() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL
  let env = {}
  try {
    env = parseEnv(fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8'))
  } catch {
    // sin .env: se usan los valores de .env.example
  }
  const usuario = env.POSTGRES_USER ?? 'pomopet'
  const clave = env.POSTGRES_PASSWORD ?? 'cambia_esto'
  const bd = env.POSTGRES_DB ?? 'pomopet'
  return `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@localhost:5432/${bd}`
}

async function consultar(sql, parametros) {
  const cliente = new pg.Client({ connectionString: urlDeLaBd() })
  await cliente.connect()
  try {
    return await cliente.query(sql, parametros)
  } finally {
    await cliente.end()
  }
}

/**
 * "Viaje en el tiempo": hace que la sesión en curso del usuario haya empezado hace `minutos`.
 * Es lo mismo que hace `retrasar_inicio` en backend/tests/test_sesiones.py. Las pausas no se
 * mueven: siguen dentro de la sesión, así que se restan igual del tiempo efectivo.
 */
export async function adelantarReloj(correo, minutos) {
  const { rowCount } = await consultar(
    `UPDATE sesiones s SET inicio = now() - make_interval(mins => $2)
     FROM materias m JOIN usuarios u ON u.id = m.usuario_id
     WHERE s.materia_id = m.id AND u.correo = $1 AND s.estado = 'en_curso'`,
    [correo, minutos],
  )
  if (rowCount !== 1) throw new Error(`${correo} no tiene una sesión en curso`)
}

/** Borra los usuarios de prueba (y en cascada su mascota, materias y sesiones). */
export async function borrarUsuario(correo) {
  await consultar('DELETE FROM usuarios WHERE correo = $1', [correo])
}
