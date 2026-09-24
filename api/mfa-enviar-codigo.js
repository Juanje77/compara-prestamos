// Manda por mail el código del segundo factor a la casilla de la propia cuenta.
//
// El destino NO viene del cuerpo del pedido: sale del token verificado. Si el navegador pudiera
// elegir a dónde mandarlo, el segundo factor no protegería nada — bastaría con pedir el código de
// otro a la casilla propia.
import { sesionAutenticada } from './_auth.js'
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { enviarMail, plantillaCodigo } from './_mail.js'
import { VENCIMIENTO_MS, generarCodigo, hashCodigo, puedeEnviarCodigo, registroConCodigoNuevo } from './_mfa.js'
import { guardarRegistro, leerRegistro, pepper } from './_mfaComun.js'
import { dentroDelLimite, ipDe } from './_rateLimit.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }
  if (!pepper()) {
    res.status(503).json({ error: 'El segundo factor no está configurado en el servidor.' })
    return
  }

  const sesion = await sesionAutenticada(req)
  if (!sesion?.uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }
  if (!sesion.email) {
    res.status(400).json({ error: 'Tu cuenta no tiene un mail asociado al que mandar el código.' })
    return
  }
  if (!dentroDelLimite(`mfa-envio-ip:${ipDe(req)}`, { maximo: 20, ventanaMs: 60 * 60 * 1000 })) {
    res.status(429).json({ error: 'Demasiados pedidos desde esta conexión. Probá más tarde.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const registro = await leerRegistro(db, sesion.uid)
    const ahora = Date.now()

    if (!puedeEnviarCodigo(registro, ahora)) {
      res.status(429).json({ error: 'Pediste demasiados códigos. Esperá un rato antes de volver a intentar.' })
      return
    }

    const codigo = generarCodigo()
    const { asunto, texto, html } = plantillaCodigo(codigo, Math.round(VENCIMIENTO_MS / 60000))
    const enviado = await enviarMail({ para: sesion.email, asunto, texto, html })
    if (!enviado) {
      res.status(502).json({ error: 'No se pudo enviar el mail con el código. Probá de nuevo en un minuto.' })
      return
    }

    // Se guarda recién después de que el mail salió: si el envío falla, no queda un código vivo
    // que nadie recibió pisando al anterior.
    await guardarRegistro(
      db,
      sesion.uid,
      registroConCodigoNuevo(registro, hashCodigo(codigo, sesion.uid, pepper()), ahora),
    )

    res.status(200).json({ enviado: true, mail: sesion.email })
  } catch {
    res.status(500).json({ error: 'No se pudo generar el código.' })
  }
}
