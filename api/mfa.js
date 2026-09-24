// Segundo factor por mail: los tres pasos en un solo endpoint, elegidos por `accion`.
//
// Van juntos y no en tres archivos por una razón de plataforma, no de diseño: Vercel crea una
// función serverless por archivo en /api y el plan tiene un tope. Tres endpoints de un mismo
// circuito, que además comparten todo el contexto, son el lugar natural donde ahorrar.
//
// Las acciones:
// - "estado":    ¿este dispositivo ya pasó el código? Si ya pasó, le renueva la marca al token.
// - "enviar":    manda un código nuevo al mail de la cuenta.
// - "verificar": valida el código, marca el token y —si se pidió— recuerda el dispositivo.
import { sesionAutenticada } from './_auth.js'
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { enviarMail, plantillaCodigo } from './_mail.js'
import {
  VENCIMIENTO_MS,
  dispositivoConfiado,
  formatoDeCodigoValido,
  generarCodigo,
  hashCodigo,
  hashDispositivo,
  puedeEnviarCodigo,
  registroConCodigoNuevo,
  registroConDispositivo,
  verificarIntento,
} from './_mfa.js'
import { guardarRegistro, leerRegistro, marcarVerificado, pepper } from './_mfaComun.js'
import { dentroDelLimite, ipDe } from './_rateLimit.js'

const MENSAJES = {
  'sin-codigo': 'No hay ningún código pendiente. Pedí uno nuevo.',
  vencido: 'El código venció. Pedí uno nuevo.',
  incorrecto: 'El código no es correcto.',
  bloqueado: 'Demasiados intentos fallidos. Esperá unos minutos antes de volver a intentar.',
}

function dispositivoDelPedido(req) {
  const { dispositivoId } = req.body ?? {}
  return typeof dispositivoId === 'string' && dispositivoId.length >= 16 ? dispositivoId : null
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const accion = req.body?.accion
  if (!['estado', 'enviar', 'verificar'].includes(accion)) {
    res.status(400).json({ error: 'Acción no válida.' })
    return
  }

  if (!pepper()) {
    // Sin configurar, el segundo factor no existe. En "estado" se contesta que no hace falta, para
    // no dejar a nadie afuera por una variable que todavía no se cargó; en el resto, que no está.
    if (accion === 'estado') {
      res.status(200).json({ configurado: false, haceFaltaCodigo: false })
      return
    }
    res.status(503).json({ error: 'El segundo factor no está configurado en el servidor.' })
    return
  }

  const sesion = await sesionAutenticada(req)
  if (!sesion?.uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const ahora = Date.now()
    const registro = await leerRegistro(db, sesion.uid)

    if (accion === 'estado') {
      const dispositivoId = dispositivoDelPedido(req)
      if (!dispositivoId) {
        res.status(400).json({ error: 'Falta identificar el dispositivo.' })
        return
      }
      const hashDisp = hashDispositivo(dispositivoId, sesion.uid, pepper())
      if (!dispositivoConfiado(registro, hashDisp, ahora)) {
        res.status(200).json({ configurado: true, haceFaltaCodigo: true })
        return
      }
      // Conocido: se le renueva la confianza y la marca del token, sin molestar al usuario.
      await guardarRegistro(db, sesion.uid, registroConDispositivo(registro, hashDisp, ahora))
      res.status(200).json({ configurado: true, haceFaltaCodigo: false, hasta: await marcarVerificado(sesion.uid, ahora) })
      return
    }

    if (accion === 'enviar') {
      // El destino sale del token verificado, NUNCA del cuerpo: si el navegador pudiera elegirlo,
      // alcanzaría con pedir el código de otro a la casilla propia.
      if (!sesion.email) {
        res.status(400).json({ error: 'Tu cuenta no tiene un mail asociado al que mandar el código.' })
        return
      }
      if (!dentroDelLimite(`mfa-envio-ip:${ipDe(req)}`, { maximo: 20, ventanaMs: 60 * 60 * 1000 })) {
        res.status(429).json({ error: 'Demasiados pedidos desde esta conexión. Probá más tarde.' })
        return
      }
      if (!puedeEnviarCodigo(registro, ahora)) {
        res.status(429).json({ error: 'Pediste demasiados códigos. Esperá un rato antes de volver a intentar.' })
        return
      }

      const codigo = generarCodigo()
      const { asunto, texto, html } = plantillaCodigo(codigo, Math.round(VENCIMIENTO_MS / 60000))
      if (!(await enviarMail({ para: sesion.email, asunto, texto, html }))) {
        res.status(502).json({ error: 'No se pudo enviar el mail con el código. Probá de nuevo en un minuto.' })
        return
      }
      // Se guarda recién después de que el mail salió: si el envío falla, no queda un código vivo
      // que nadie recibió pisando al anterior.
      await guardarRegistro(db, sesion.uid, registroConCodigoNuevo(registro, hashCodigo(codigo, sesion.uid, pepper()), ahora))
      res.status(200).json({ enviado: true, mail: sesion.email })
      return
    }

    // accion === 'verificar'
    // El bloqueo por cuenta ya lo maneja la política; este límite es contra el que prueba códigos
    // en muchas cuentas distintas desde la misma conexión.
    if (!dentroDelLimite(`mfa-verif-ip:${ipDe(req)}`, { maximo: 60, ventanaMs: 60 * 60 * 1000 })) {
      res.status(429).json({ error: 'Demasiados intentos desde esta conexión. Probá más tarde.' })
      return
    }
    const { codigo, recordar } = req.body ?? {}
    const dispositivoId = dispositivoDelPedido(req)
    if (!formatoDeCodigoValido(codigo)) {
      res.status(400).json({ error: 'El código son 6 dígitos.' })
      return
    }
    if (!dispositivoId) {
      res.status(400).json({ error: 'Falta identificar el dispositivo.' })
      return
    }

    const intento = verificarIntento(registro, hashCodigo(codigo, sesion.uid, pepper()), ahora)
    if (intento.resultado !== 'ok') {
      if (intento.registro) await guardarRegistro(db, sesion.uid, intento.registro)
      res.status(intento.resultado === 'bloqueado' ? 429 : 401).json({
        error: MENSAJES[intento.resultado],
        intentosRestantes: intento.intentosRestantes,
      })
      return
    }

    const final = recordar
      ? registroConDispositivo(intento.registro, hashDispositivo(dispositivoId, sesion.uid, pepper()), ahora)
      : intento.registro
    await guardarRegistro(db, sesion.uid, final)
    res.status(200).json({ verificado: true, hasta: await marcarVerificado(sesion.uid, ahora) })
  } catch {
    res.status(500).json({ error: 'No se pudo completar la operación.' })
  }
}
