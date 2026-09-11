// Crea una suscripción recurrente en Mercado Pago (Preapproval) para un plan pago de FinCorp.
// El Access Token vive solo acá (variable de entorno del servidor) — nunca llega al navegador.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'

const PLANES = {
  basico: { reason: 'FinCorp para empresas - Plan Básico', monto: 20000 },
  premium: { reason: 'FinCorp para empresas - Plan Premium', monto: 50000 },
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    res.status(500).json({ error: 'Mercado Pago no está configurado en el servidor.' })
    return
  }

  const { uid, email, plan } = req.body || {}

  if (!uid || typeof uid !== 'string') {
    res.status(400).json({ error: 'Falta el usuario.' })
    return
  }
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Falta el email del usuario.' })
    return
  }
  const planConfig = PLANES[plan]
  if (!planConfig) {
    res.status(400).json({ error: 'Plan inválido.' })
    return
  }

  const origin = req.headers.origin || `https://${req.headers.host}`

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: planConfig.reason,
        external_reference: `${uid}:${plan}`,
        payer_email: email,
        back_url: `${origin}/empresas`,
        notification_url: `${origin}/api/mercadopago-webhook`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: planConfig.monto,
          currency_id: 'ARS',
        },
        status: 'pending',
      }),
    })

    const data = await mpResponse.json()

    if (!mpResponse.ok) {
      res.status(502).json({ error: data?.message || 'Mercado Pago rechazó la solicitud.' })
      return
    }

    try {
      const db = obtenerFirestoreAdmin()
      await db.collection('users').doc(uid).collection('meta').doc('plan').set(
        {
          plan,
          estado: 'pendiente',
          mpPreapprovalId: data.id,
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true },
      )
    } catch {
      // Si esto falla no bloqueamos el checkout — el webhook o la verificación al volver
      // igual pueden confirmar la suscripción más adelante.
    }

    res.status(200).json({ initPoint: data.init_point })
  } catch {
    res.status(502).json({ error: 'No se pudo contactar a Mercado Pago en este momento.' })
  }
}
