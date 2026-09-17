// Emite un comprobante ante ARCA a través de la API fiscal, poniendo el token del usuario que
// nunca pasa por el navegador.
//
// El cuerpo que llega es el payload ya armado y validado por src/lib/facturacionElectronica.ts.
// Esta función no lo rearma: sólo comprueba que traiga la clave de idempotencia, le agrega el
// token y reenvía. Así el mapeo vive en un solo lugar, con sus tests.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { planHabilitaEmitir, refPlan, refTokenFiscal, uidAutenticado } from './_auth.js'

const BASE_URL = (process.env.SISTEMAS360_BASE_URL ?? 'https://api.sistemas360.ar').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.SISTEMAS360_TIMEOUT_MS ?? 15000)

async function emitir(token, payload) {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE_URL}/api/comprobantes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: control.signal,
    })
  } finally {
    clearTimeout(reloj)
  }
}

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

  const payload = req.body?.payload
  const referenciaExterna = payload?.referencia_externa

  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'Falta el comprobante a emitir.' })
    return
  }
  // Sin la referencia externa no hay idempotencia, y sin idempotencia un reintento duplica una
  // factura ante ARCA. Preferimos no emitir.
  if (typeof referenciaExterna !== 'string' || !referenciaExterna) {
    res.status(400).json({ error: 'El comprobante no trae referencia externa.' })
    return
  }

  let db
  let token
  try {
    db = obtenerFirestoreAdmin()

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

  let respuesta
  try {
    respuesta = await emitir(token, payload)
  } catch (error) {
    // No sabemos si ARCA llegó a autorizar. Como el payload lleva `referencia_externa`, repetir
    // el mismo pedido devuelve el comprobante ya registrado en vez de duplicarlo: por eso el
    // reintento es seguro y se lo decimos al cliente en vez de adivinar acá.
    const fueTimeout = error?.name === 'AbortError'
    res.status(504).json({
      error: fueTimeout
        ? 'La emisión tardó demasiado y no sabemos si quedó autorizada.'
        : 'No se pudo contactar al servicio de facturación.',
      referenciaExterna,
      reintentable: true,
    })
    return
  }

  let cuerpo = null
  try {
    cuerpo = await respuesta.json()
  } catch {
    cuerpo = null
  }

  if (!respuesta.ok) {
    res.status(respuesta.status).json({
      error: 'El servicio de facturación rechazó el comprobante.',
      referenciaExterna,
      detalle: cuerpo,
    })
    return
  }

  // Copia del resultado del lado del servidor. Si el navegador se cierra entre la respuesta y el
  // guardado, el CAE no se pierde: queda acá, buscable por la misma referencia.
  try {
    await db
      .collection('users')
      .doc(uid)
      .collection('emisiones')
      .doc(referenciaExterna)
      .set({ referenciaExterna, respuesta: cuerpo, emitidoEl: new Date().toISOString() })
  } catch {
    // El comprobante ya está autorizado: no hacemos fallar la emisión por no poder loguearla.
  }

  res.status(200).json({ referenciaExterna, respuesta: cuerpo })
}
