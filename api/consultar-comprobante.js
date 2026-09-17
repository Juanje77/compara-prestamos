// Consulta el resultado de una emisión que quedó sin confirmar, sin volver a emitirla.
//
// Es el camino que prescribe el contrato para el estado `pendiente_confirmacion`: ARCA no contestó
// a tiempo y puede haber autorizado igual. `POST /api/comprobantes/{id}/reintentar` consulta esa
// autorización original y verifica sus datos fiscales; si ya estaba autorizada, devuelve el
// resultado existente sin duplicar nada.
//
// Volver a emitir sería el error grave acá, y por eso este endpoint existe aparte del de emisión.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { planHabilitaEmitir, refPlan, uidAutenticado } from './_auth.js'
import { llamarApiFiscal } from './_sistemas360.js'

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

  try {
    const db = obtenerFirestoreAdmin()
    const planSnap = await refPlan(db, uid).get()

    if (!planHabilitaEmitir(planSnap.data())) {
      res.status(403).json({ error: 'La facturación electrónica es parte del plan Full.' })
      return
    }
  } catch {
    res.status(500).json({ error: 'No se pudo leer la configuración fiscal.' })
    return
  }

  try {
    // Sin body ni cabecera de escenario, según el contrato.
    const { status, cuerpo } = await llamarApiFiscal(`/api/comprobantes/${comprobanteId}/reintentar`, {
      method: 'POST',
    })

    // 409 significa que sigue sin confirmarse: no es un error del integrador, es "seguí esperando".
    if (status !== 200 && status !== 409) {
      res.status(status).json({
        error: 'No se pudo confirmar el estado del comprobante.',
        comprobanteId,
        consultable: true,
        detalle: cuerpo,
      })
      return
    }

    res.status(200).json({ comprobanteId, sinConfirmar: status === 409, respuesta: cuerpo })
  } catch {
    res.status(504).json({
      error: 'La consulta tardó demasiado. El comprobante sigue sin confirmarse.',
      comprobanteId,
      consultable: true,
    })
  }
}
