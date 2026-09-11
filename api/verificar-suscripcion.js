// Respaldo del webhook: cuando el usuario vuelve del checkout de Mercado Pago, consultamos
// nosotros mismos el estado real de la preapproval en vez de esperar (a veces en modo de
// prueba el webhook nunca llega) y actualizamos Firestore igual que haría el webhook.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    res.status(500).json({ error: 'Mercado Pago no está configurado en el servidor.' })
    return
  }

  const uid = req.query?.uid
  if (!uid || typeof uid !== 'string') {
    res.status(400).json({ error: 'Falta el usuario.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const ref = db.collection('users').doc(uid).collection('meta').doc('plan')
    const snap = await ref.get()
    const datos = snap.data()
    const preapprovalId = datos?.mpPreapprovalId

    if (!preapprovalId) {
      res.status(200).json({ plan: datos?.plan ?? null, estado: datos?.estado ?? null })
      return
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!mpResponse.ok) {
      res.status(200).json({ plan: datos?.plan ?? null, estado: datos?.estado ?? null })
      return
    }

    const preapproval = await mpResponse.json()
    const estado =
      preapproval.status === 'authorized'
        ? 'activo'
        : preapproval.status === 'paused'
          ? 'pausado'
          : preapproval.status === 'cancelled'
            ? 'cancelado'
            : 'pendiente'

    await ref.set({ estado, actualizadoEn: new Date().toISOString() }, { merge: true })

    res.status(200).json({ plan: datos?.plan ?? null, estado })
  } catch {
    res.status(500).json({ error: 'No se pudo verificar la suscripción en este momento.' })
  }
}
