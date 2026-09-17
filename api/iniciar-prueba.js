// Activa la prueba gratis de 15 días (con acceso Full completo, el plan más alto) para un
// usuario que todavía no tiene ningún registro de plan — igual que la activación por Mercado
// Pago, esto corre con permisos de administrador para que el usuario no pueda reiniciarse la
// prueba a sí mismo escribiendo directamente en Firestore.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { datosDePrueba, puedeOtorgarsePrueba } from './_prueba.js'

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

    if (!puedeOtorgarsePrueba(snap.data())) {
      // Ya tuvo su prueba, o tiene una suscripción real: no se reinicia.
      res.status(200).json(snap.data() ?? {})
      return
    }

    const datos = datosDePrueba(DURACION_PRUEBA_DIAS)
    // Con merge, para no borrar un checkout a medias (el id de preapproval sigue sirviendo si el
    // pago se confirma más tarde: ahí el webhook pisa el plan y la prueba deja de aplicar).
    await ref.set(datos, { merge: true })
    res.status(200).json(datos)
  } catch {
    res.status(500).json({ error: 'No se pudo iniciar la prueba gratis.' })
  }
}
