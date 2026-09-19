// Endpoint de uso interno para asignar manualmente un plan a una cuenta (por ejemplo, la propia
// cuenta de prueba/admin), sin pasar por Mercado Pago. Protegido por ADMIN_SECRET — una variable
// de entorno que hay que configurar en Vercel; solo quien conoce ese secreto puede usarlo. Sin
// esa variable configurada, el endpoint queda inutilizable (no hay un valor por defecto).
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'

const PLANES_VALIDOS = ['basico', 'premium', 'full']

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    res.status(500).json({ error: 'ADMIN_SECRET no está configurado en el servidor.' })
    return
  }

  const { secret, uid, plan } = req.body || {}

  if (secret !== adminSecret) {
    res.status(401).json({ error: 'Secreto inválido.' })
    return
  }
  if (!uid || typeof uid !== 'string') {
    res.status(400).json({ error: 'Falta el usuario.' })
    return
  }
  if (!PLANES_VALIDOS.includes(plan)) {
    res.status(400).json({ error: 'Plan inválido.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    await db.collection('users').doc(uid).collection('meta').doc('plan').set(
      {
        plan,
        estado: 'activo',
        esPrueba: false,
        pruebaFin: null,
        pausadoDesde: null,
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true },
    )
    res.status(200).json({ ok: true, plan })
  } catch {
    res.status(500).json({ error: 'No se pudo actualizar el plan.' })
  }
}
