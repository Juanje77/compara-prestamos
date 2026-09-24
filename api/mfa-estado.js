// Dice si este dispositivo ya pasó el segundo factor, y si lo pasó, le renueva la marca al token
// sin pedir un código nuevo. Es lo que hace que solo se pida en un dispositivo nuevo.
import { sesionAutenticada } from './_auth.js'
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { dispositivoConfiado, hashDispositivo, registroConDispositivo } from './_mfa.js'
import { guardarRegistro, leerRegistro, marcarVerificado, pepper } from './_mfaComun.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }
  if (!pepper()) {
    // Sin configurar, el segundo factor no existe: se contesta que no hace falta, para no dejar a
    // nadie afuera por una variable que todavía no se cargó.
    res.status(200).json({ configurado: false, haceFaltaCodigo: false })
    return
  }

  const sesion = await sesionAutenticada(req)
  if (!sesion?.uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  const { dispositivoId } = req.body ?? {}
  if (typeof dispositivoId !== 'string' || dispositivoId.length < 16) {
    res.status(400).json({ error: 'Falta identificar el dispositivo.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const ahora = Date.now()
    const registro = await leerRegistro(db, sesion.uid)
    const hashDisp = hashDispositivo(dispositivoId, sesion.uid, pepper())

    if (!dispositivoConfiado(registro, hashDisp, ahora)) {
      res.status(200).json({ configurado: true, haceFaltaCodigo: true })
      return
    }

    // Conocido: se le renueva la confianza y la marca del token, sin molestar al usuario.
    await guardarRegistro(db, sesion.uid, registroConDispositivo(registro, hashDisp, ahora))
    const hasta = await marcarVerificado(sesion.uid, ahora)
    res.status(200).json({ configurado: true, haceFaltaCodigo: false, hasta })
  } catch {
    res.status(500).json({ error: 'No se pudo verificar el estado del dispositivo.' })
  }
}
