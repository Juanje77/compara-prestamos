// Consulta un CUIT contra el padrón de ARCA.
//
// Es lo que le faltaba al modelo de factura: hasta ahora la contraparte era texto libre, y para
// emitir hace falta razón social y condición de IVA del receptor. La API devuelve un
// `cliente_sugerido` que calza con lo que necesita el comprobante, así que el usuario escribe el
// CUIT y el resto se completa solo.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { planHabilitaEmitir, refPlan, uidAutenticado } from './_auth.js'
import { llamarApiFiscal } from './_sistemas360.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const uid = await uidAutenticado(req)
  if (!uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  const cuit = String(req.query?.cuit ?? '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(cuit)) {
    res.status(400).json({ error: 'El CUIT tiene que tener 11 dígitos.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const planSnap = await refPlan(db, uid).get()

    if (!planHabilitaEmitir(planSnap.data())) {
      res.status(403).json({ error: 'La consulta de CUIT es parte del plan Full.' })
      return
    }
  } catch {
    res.status(500).json({ error: 'No se pudo verificar el plan.' })
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
