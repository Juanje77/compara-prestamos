// Consultas a la API fiscal que no emiten nada: el padrón de ARCA y el estado de un comprobante
// que quedó sin confirmar.
//
// Son dos cosas distintas en un solo archivo por una razón de infraestructura, no de diseño: el
// plan Hobby de Vercel admite 12 funciones y cada archivo de esta carpeta es una. Juntarlas es lo
// que deja lugar para `empresa.js`. Comparten autenticación y chequeo de plan, así que el costo
// de tenerlas juntas es bajo; lo que NO se junta acá es la emisión, que vive aparte a propósito
// (ver emitir-comprobante.js): mezclar "consultar" con "emitir" es cómo se duplica una factura.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { planHabilitaEmitir, refPlan, uidAutenticado } from './_auth.js'
import { llamarApiFiscal } from './_sistemas360.js'

/** El padrón de ARCA: razón social y condición de IVA del receptor, para completar la factura sin
 * tipearlos. La API devuelve un `cliente_sugerido` que calza con lo que necesita el comprobante. */
async function consultarCuit(req, res) {
  const cuit = String(req.query?.cuit ?? req.body?.cuit ?? '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(cuit)) {
    res.status(400).json({ error: 'El CUIT tiene que tener 11 dígitos.' })
    return
  }

  const { status, cuerpo } = await llamarApiFiscal(`/api/cuit/${cuit}`)

  if (status !== 200) {
    // 422 y 429 son del padrón, no nuestros: se pasan tal cual para que el mensaje sea el real.
    res.status(status).json({ error: cuerpo?.error?.mensaje ?? 'No se pudo consultar el CUIT.', detalle: cuerpo })
    return
  }

  res.status(200).json({ contribuyente: cuerpo?.data ?? null })
}

/**
 * El resultado de una emisión que quedó en `pendiente_confirmacion`, sin volver a emitirla.
 *
 * Es el camino que prescribe el contrato: ARCA no contestó a tiempo y puede haber autorizado
 * igual. `POST /api/comprobantes/{id}/reintentar` consulta esa autorización original; si ya
 * estaba autorizada, devuelve el resultado existente sin duplicar nada. Volver a emitir sería el
 * error grave acá.
 */
async function consultarComprobante(req, res) {
  const comprobanteId = req.body?.comprobanteId
  if (!/^\d+$/.test(String(comprobanteId ?? ''))) {
    res.status(400).json({ error: 'Falta el comprobante a consultar.' })
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const accion = String(req.query?.accion ?? req.body?.accion ?? '')
  if (accion !== 'cuit' && accion !== 'comprobante') {
    res.status(400).json({ error: 'Acción desconocida.' })
    return
  }
  if (accion === 'comprobante' && req.method !== 'POST') {
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
    const planSnap = await refPlan(db, uid).get()

    if (!planHabilitaEmitir(planSnap.data())) {
      res.status(403).json({ error: 'La facturación electrónica es parte del plan Full.' })
      return
    }
  } catch {
    res.status(500).json({ error: 'No se pudo verificar el plan.' })
    return
  }

  if (accion === 'cuit') await consultarCuit(req, res)
  else await consultarComprobante(req, res)
}
