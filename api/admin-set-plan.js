// Endpoint de uso interno para asignar manualmente un plan a una cuenta (por ejemplo, la propia
// cuenta de prueba/admin), sin pasar por Mercado Pago. Protegido por ADMIN_SECRET — una variable
// de entorno que hay que configurar en Vercel; solo quien conoce ese secreto puede usarlo. Sin
// esa variable configurada, el endpoint queda inutilizable (no hay un valor por defecto).
import { createHash, timingSafeEqual } from 'node:crypto'
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { dentroDelLimite, ipDe } from './_rateLimit.js'

const PLANES_VALIDOS = ['basico', 'premium', 'full']

// Tope bajo a propósito: acá no hay un usuario legítimo equivocándose de contraseña, es una
// herramienta interna que se usa de a una vez. Con cinco intentos por minuto, probar el secreto a
// fuerza bruta deja de ser viable.
const LIMITE = { maximo: 5, ventanaMs: 60_000 }

/**
 * Compara dos secretos sin que el tiempo de respuesta delate cuántos caracteres se acertaron. Se
 * comparan los digests y no los textos porque timingSafeEqual exige el mismo largo, y usar el
 * largo real filtraría de cuántos caracteres es el secreto.
 */
function secretosIguales(recibido, esperado) {
  const a = createHash('sha256').update(String(recibido)).digest()
  const b = createHash('sha256').update(String(esperado)).digest()
  return timingSafeEqual(a, b)
}

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

  if (!dentroDelLimite(`admin:${ipDe(req)}`, LIMITE).permitido) {
    res.status(429).json({ error: 'Demasiados intentos. Esperá un minuto.' })
    return
  }

  const { secret, uid, plan } = req.body || {}

  if (!secretosIguales(secret, adminSecret)) {
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
