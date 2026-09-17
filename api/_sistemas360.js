// Cliente de la API fiscal. El token es de FinCorp, no del cliente: vive en una variable de
// entorno del servidor y nunca sale de acá.
//
// Con un token de cuenta, un mismo token factura para muchos CUIT, y cada llamada dice cuál con
// `emisor_id`. Ese id NO se toma de lo que manda el navegador —sería emitir con el CUIT de otro—
// sino del registro del propio usuario en Firestore. Ver `emisorIdDe`.

const BASE_URL = (process.env.SISTEMAS360_BASE_URL ?? 'https://api.sistemas360.ar').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.SISTEMAS360_TIMEOUT_MS ?? 15000)

export function tokenFiscal() {
  const token = process.env.SISTEMAS360_TOKEN
  if (!token) throw new Error('Falta SISTEMAS360_TOKEN en el servidor.')
  return token
}

/**
 * Llama a la API fiscal y devuelve `{ status, cuerpo }`. No lanza por un status de error: los
 * distintos códigos significan cosas distintas —422 es "está mal", 504 es "no sabemos"— y cada
 * endpoint decide qué hacer con eso.
 */
export async function llamarApiFiscal(ruta, opciones = {}) {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS)
  try {
    const respuesta = await fetch(`${BASE_URL}${ruta}`, {
      ...opciones,
      headers: {
        Authorization: `Bearer ${tokenFiscal()}`,
        Accept: 'application/json',
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
        ...opciones.headers,
      },
      signal: control.signal,
    })

    let cuerpo = null
    try {
      cuerpo = await respuesta.json()
    } catch {
      cuerpo = null
    }

    return { status: respuesta.status, cuerpo }
  } finally {
    clearTimeout(reloj)
  }
}
