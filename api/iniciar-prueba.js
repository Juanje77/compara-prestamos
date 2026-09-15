// Activa la prueba gratis de 15 días (con acceso Full completo, el plan más alto) para un
// usuario que todavía no tiene ningún registro de plan — igual que la activación por Mercado
// Pago, esto corre con permisos de administrador para que el usuario no pueda reiniciarse la
// prueba a sí mismo escribiendo directamente en Firestore.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'

const DURACION_PRUEBA_DIAS = 15

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const { uid } = req.body || {}
  if (!uid || typeof uid !== 'string') {
    res.status(400).json({ error: 'Falta el usuario.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const ref = db.collection('users').doc(uid).collection('meta').doc('plan')
    const snap = await ref.get()

    if (snap.exists) {
      // Ya tiene (o tuvo alguna vez) un plan registrado — no se reinicia la prueba.
      res.status(200).json(snap.data())
      return
    }

    const datos = {
      plan: 'full',
      estado: 'activo',
      esPrueba: true,
      pruebaFin: new Date(Date.now() + DURACION_PRUEBA_DIAS * 24 * 60 * 60 * 1000).toISOString(),
      actualizadoEn: new Date().toISOString(),
    }
    await ref.set(datos)
    res.status(200).json(datos)
  } catch {
    res.status(500).json({ error: 'No se pudo iniciar la prueba gratis.' })
  }
}
