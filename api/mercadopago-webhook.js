// Webhook de Mercado Pago: cuando se autoriza, paga, pausa o cancela una suscripción,
// actualiza el plan del usuario en Firestore (con permisos de administrador, sin pasar
// por las reglas de seguridad — por eso el usuario nunca puede activarse el plan él mismo).
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    res.status(500).json({ error: 'Mercado Pago no está configurado en el servidor.' })
    return
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
    await db
      .collection('users')
      .doc(uid)
      .collection('meta')
      .doc('plan')
      .set(
        {
          plan,
          estado,
          mpPreapprovalId: preapprovalId,
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true },
      )

    res.status(200).json({ recibido: true })
  } catch {
    res.status(500).json({ error: 'Error procesando la notificación de Mercado Pago.' })
  }
}
