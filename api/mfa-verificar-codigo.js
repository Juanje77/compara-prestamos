// Verifica el código del segundo factor y, si está bien, marca el token y recuerda el dispositivo.
import { sesionAutenticada } from './_auth.js'
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import {
  formatoDeCodigoValido,
  hashCodigo,
  hashDispositivo,
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
  // El bloqueo por cuenta ya lo maneja la política; este límite es contra el que prueba códigos
  // en muchas cuentas distintas desde la misma conexión.
  if (!dentroDelLimite(`mfa-verif-ip:${ipDe(req)}`, { maximo: 60, ventanaMs: 60 * 60 * 1000 })) {
    res.status(429).json({ error: 'Demasiados intentos desde esta conexión. Probá más tarde.' })
    return
  }

  const { codigo, dispositivoId, recordar } = req.body ?? {}
  if (!formatoDeCodigoValido(codigo)) {
    res.status(400).json({ error: 'El código son 6 dígitos.' })
    return
  }
  if (typeof dispositivoId !== 'string' || dispositivoId.length < 16) {
    res.status(400).json({ error: 'Falta identificar el dispositivo.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const ahora = Date.now()
    const registro = await leerRegistro(db, sesion.uid)
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
    const hasta = await marcarVerificado(sesion.uid, ahora)

    res.status(200).json({ verificado: true, hasta })
  } catch {
    res.status(500).json({ error: 'No se pudo verificar el código.' })
  }
}
