// Webhook de Mercado Pago: cuando se autoriza, paga, pausa o cancela una suscripción,
// actualiza el plan del usuario en Firestore (con permisos de administrador, sin pasar
// por las reglas de seguridad — por eso el usuario nunca puede activarse el plan él mismo).
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { firmaWebhookValida } from './_mercadopago.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    res.status(500).json({ error: 'Mercado Pago no está configurado en el servidor.' })
    return
  }

  // La firma se exige sólo si hay secreto cargado, a propósito: sin MERCADOPAGO_WEBHOOK_SECRET en
  // el entorno, exigirla dejaría de procesar todas las suscripciones de golpe. Y este endpoint
  // nunca le creyó al cuerpo igual —más abajo vuelve a consultarle el estado real a Mercado Pago—,
  // así que la firma suma contra el abuso, no contra el fraude. Para activarla, cargá el secreto
  // que da el panel de Mercado Pago.
  const secretoWebhook = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (secretoWebhook) {
    const firmada = firmaWebhookValida(secretoWebhook, {
      xSignature: req.headers?.['x-signature'],
      requestId: req.headers?.['x-request-id'],
      dataId: req.query?.['data.id'] ?? req.query?.id ?? req.body?.data?.id,
    })
    if (!firmada) {
      res.status(401).json({ error: 'Firma inválida.' })
      return
    }
  }

  const tipo = req.body?.type || req.query?.topic
  const preapprovalId = req.body?.data?.id || req.query?.id

  if (tipo !== 'subscription_preapproval' && tipo !== 'preapproval') {
    // Otro tipo de notificación (pagos individuales, etc.) — la reconocemos sin procesarla.
    res.status(200).json({ recibido: true })
    return
  }

  if (!preapprovalId) {
    res.status(200).json({ recibido: true })
    return
  }

  try {
    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!mpResponse.ok) {
      res.status(502).json({ error: 'No se pudo confirmar la suscripción con Mercado Pago.' })
      return
    }

    const preapproval = await mpResponse.json()
    const [uid, plan] = String(preapproval.external_reference || '').split(':')

    if (!uid || !plan) {
      res.status(200).json({ recibido: true, ignorado: true })
      return
    }

    const estado =
      preapproval.status === 'authorized'
        ? 'activo'
        : preapproval.status === 'paused'
          ? 'pausado'
          : preapproval.status === 'cancelled'
            ? 'cancelado'
            : 'pendiente'

    const db = obtenerFirestoreAdmin()
    const ref = db.collection('users').doc(uid).collection('meta').doc('plan')

    // pausadoDesde marca desde cuándo empezó a fallar el cobro, para el período de gracia (ver
    // enPeriodoDeGracia en src/lib/plan.ts). Si ya venía pausado/cancelado, no lo reiniciamos con
    // cada notificación repetida de Mercado Pago para el mismo problema — si no, la gracia nunca
    // se agotaría.
    let pausadoDesde = null
    if (estado === 'pausado' || estado === 'cancelado') {
      const actual = (await ref.get()).data()
      pausadoDesde = actual?.pausadoDesde && actual?.estado !== 'activo' ? actual.pausadoDesde : new Date().toISOString()
    }

    await ref.set(
      {
        plan,
        estado,
        esPrueba: false,
        mpPreapprovalId: preapprovalId,
        pausadoDesde,
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true },
    )

    res.status(200).json({ recibido: true })
  } catch {
    res.status(500).json({ error: 'Error procesando la notificación de Mercado Pago.' })
  }
}
