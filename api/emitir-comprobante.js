// Emite un comprobante ante ARCA a través de la API fiscal.
//
// El cuerpo que llega es el payload ya armado y validado por src/lib/facturacionElectronica.ts.
// Esta función no lo rearma: comprueba la clave de idempotencia, le pone el token de FinCorp y el
// emisor que corresponde, y reenvía. Así el mapeo vive en un solo lugar, con sus tests.
//
// El `emisor_id` se resuelve acá y pisa cualquier valor que viniera del navegador: si el cliente
// pudiera elegirlo, estaría facturando con el CUIT de otro contribuyente de la misma cuenta.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { emisorDe, planHabilitaEmitir, refPlan, uidAutenticado } from './_auth.js'
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

  const recibido = req.body?.payload
  const referenciaExterna = recibido?.referencia_externa

  if (!recibido || typeof recibido !== 'object') {
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
  let emisor
  try {
    db = obtenerFirestoreAdmin()
    const [planSnap, encontrado] = await Promise.all([refPlan(db, uid).get(), emisorDe(db, uid)])

    if (!planHabilitaEmitir(planSnap.data())) {
      res.status(403).json({ error: 'La facturación electrónica es parte del plan Full.' })
      return
    }
    emisor = encontrado
  } catch {
    res.status(500).json({ error: 'No se pudo leer la configuración fiscal.' })
    return
  }

  // Emisor registrado cuando todavía se guardaba del lado del navegador: no es confiable. Antes
  // que emitir con el emisor por defecto de la cuenta —o sea, con el CUIT de otro— se corta acá.
  if (emisor.legado) {
    res.status(409).json({
      error: 'Volvé a registrar tu CUIT en Facturación electrónica antes de emitir. Es por única vez, por un cambio de seguridad.',
    })
    return
  }

  const payload = { ...recibido }
  delete payload.emisor_id
  if (emisor.emisorId) payload.emisor_id = emisor.emisorId

  let respuesta
  try {
    respuesta = await llamarApiFiscal('/api/comprobantes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch (error) {
    // No sabemos si ARCA llegó a autorizar. Repetir el mismo pedido es seguro porque el payload
    // lleva `referencia_externa`: la API devuelve el comprobante ya registrado en vez de duplicarlo.
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

  const { status, cuerpo } = respuesta

  if (status !== 200 && status !== 201) {
    // 503 y 504 no son rechazos: son "no sabemos". El contrato dice que ahí el comprobante puede
    // quedar en pendiente_confirmacion y que se resuelve consultando, nunca emitiendo de nuevo.
    const incierto = status === 503 || status === 504
    res.status(status).json({
      error: incierto
        ? 'El servicio fiscal no confirmó la emisión. El comprobante puede haber quedado autorizado.'
        : 'El servicio de facturación rechazó el comprobante.',
      referenciaExterna,
      comprobanteId: cuerpo?.data?.id ?? null,
      consultable: incierto,
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
