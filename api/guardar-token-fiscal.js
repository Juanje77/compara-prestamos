// Guarda, consulta el estado y revoca el token de emisión del contribuyente.
//
// El token habilita a facturar con el CUIT del usuario, así que entra una sola vez y no sale
// nunca: GET devuelve si está configurado y sus últimos cuatro caracteres, jamás el token entero.
// Vive en una colección cerrada a la que el SDK del navegador no llega.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { refTokenFiscal, uidAutenticado } from './_auth.js'

const LARGO_MAXIMO = 4096

function pista(token) {
  return token.length <= 4 ? '••••' : `••••${token.slice(-4)}`
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const uid = await uidAutenticado(req)
  if (!uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const ref = refTokenFiscal(db, uid)

    if (req.method === 'GET') {
      const snap = await ref.get()
      const datos = snap.data()
      res.status(200).json({
        configurado: Boolean(datos?.token),
        pista: datos?.pista ?? null,
        ambiente: datos?.ambiente ?? null,
        actualizadoEn: datos?.actualizadoEn ?? null,
      })
      return
    }

    if (req.method === 'DELETE') {
      await ref.delete()
      res.status(200).json({ configurado: false, pista: null, ambiente: null, actualizadoEn: null })
      return
    }

    const { token, ambiente } = req.body || {}

    if (typeof token !== 'string' || token.trim().length === 0) {
      res.status(400).json({ error: 'Falta el token.' })
      return
    }
    if (token.length > LARGO_MAXIMO) {
      res.status(400).json({ error: 'El token es demasiado largo.' })
      return
    }
    if (ambiente !== 'pruebas' && ambiente !== 'produccion') {
      res.status(400).json({ error: 'El ambiente tiene que ser "pruebas" o "produccion".' })
      return
    }

    const limpio = token.trim()
    const actualizadoEn = new Date().toISOString()

    await ref.set({ token: limpio, pista: pista(limpio), ambiente, actualizadoEn })

    res.status(200).json({ configurado: true, pista: pista(limpio), ambiente, actualizadoEn })
  } catch {
    res.status(500).json({ error: 'No se pudo guardar el token.' })
  }
}
