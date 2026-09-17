// Consulta el resultado de una emisión que quedó sin confirmar, sin volver a emitirla.
//
// Es el camino que prescribe el contrato para el estado `pendiente_confirmacion`: ARCA no contestó
// a tiempo y puede haber autorizado igual. `POST /api/comprobantes/{id}/reintentar` consulta esa
// autorización original y verifica sus datos fiscales; si ya estaba autorizada, devuelve el
// resultado existente sin duplicar nada.
//
// Volver a emitir sería el error grave acá, y por eso este endpoint existe aparte del de emisión.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { planHabilitaEmitir, refPlan, refTokenFiscal, uidAutenticado } from './_auth.js'

const BASE_URL = (process.env.SISTEMAS360_BASE_URL ?? 'https://api.sistemas360.ar').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.SISTEMAS360_TIMEOUT_MS ?? 15000)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const uid = await uidAutenticado(req)
  if (!uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  const comprobanteId = req.body?.comprobanteId
  if (!/^\d+$/.test(String(comprobanteId ?? ''))) {
    res.status(400).json({ error: 'Falta el comprobante a consultar.' })
    return
  }

  let token
  try {
    const db = obtenerFirestoreAdmin()
    const [planSnap, tokenSnap] = await Promise.all([refPlan(db, uid).get(), refTokenFiscal(db, uid).get()])

    if (!planHabilitaEmitir(planSnap.data())) {
      res.status(403).json({ error: 'La facturación electrónica es parte del plan Full.' })
      return
    }

    token = tokenSnap.data()?.token
    if (!token) {
      res.status(409).json({ error: 'Todavía no cargaste el token de emisión.' })
      return
    }
  } catch {
    res.status(500).json({ error: 'No se pudo leer la configuración fiscal.' })
    return
  }

  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS)
  try {
    // Sin body ni cabecera de escenario, según el contrato.
    const respuesta = await fetch(`${BASE_URL}/api/comprobantes/${comprobanteId}/reintentar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: control.signal,
    })

    let cuerpo = null
    try {
      cuerpo = await respuesta.json()
    } catch {
      cuerpo = null
    }

    // 409 significa que sigue sin confirmarse: no es un error del integrador, es "seguí esperando".
    if (!respuesta.ok && respuesta.status !== 409) {
      res.status(respuesta.status).json({
        error: 'No se pudo confirmar el estado del comprobante.',
        comprobanteId,
        consultable: true,
        detalle: cuerpo,
      })
      return
    }

    res.status(200).json({ comprobanteId, sinConfirmar: respuesta.status === 409, respuesta: cuerpo })
  } catch {
    res.status(504).json({
      error: 'La consulta tardó demasiado. El comprobante sigue sin confirmarse.',
      comprobanteId,
      consultable: true,
    })
  } finally {
    clearTimeout(reloj)
  }
}
