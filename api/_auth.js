// Identidad del usuario en los endpoints que manejan credenciales fiscales.
//
// Las funciones más viejas de esta carpeta reciben el `uid` en el cuerpo y le creen. Para
// facturación eso no alcanza: quien pudiera mandar un uid ajeno estaría guardando o usando el
// token de emisión de otro contribuyente, o sea facturando con el CUIT de otro. Acá el uid sale
// del ID token de Firebase, verificado contra el Admin SDK, y nunca del cuerpo del pedido.
import { obtenerAuthAdmin } from './_firebaseAdmin.js'

/**
 * uid y email del usuario autenticado, o null si falta el header, está mal formado o el token no
 * valida. El email sale del token y no del cuerpo del pedido, porque es el que termina viajando a
 * Mercado Pago como pagador de la suscripción.
 */
export async function sesionAutenticada(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null

  const idToken = header.slice('Bearer '.length).trim()
  if (!idToken) return null

  try {
    const auth = await obtenerAuthAdmin()
    const { uid, email } = await auth.verifyIdToken(idToken)
    return { uid, email: typeof email === 'string' ? email : null }
  } catch {
    // Token vencido, de otro proyecto o directamente inventado: no distinguimos, todos son 401.
    return null
  }
}

/** uid del usuario autenticado, o null. */
export async function uidAutenticado(req) {
  return (await sesionAutenticada(req))?.uid ?? null
}

/**
 * Decide si un documento de plan habilita a emitir. Emitir es una función del plan Full, y la
 * solapa está detrás de un candado en el navegador — pero un endpoint no puede confiar en eso.
 * Espeja la lógica de `pruebaVencida` en src/lib/plan.ts: durante la prueba gratis el plan es
 * "full" y "activo", y vence por fecha.
 */
export function planHabilitaEmitir(datosPlan, ahora = new Date()) {
  if (!datosPlan) return false
  if (datosPlan.plan !== 'full' || datosPlan.estado !== 'activo') return false
  if (datosPlan.esPrueba && datosPlan.pruebaFin && new Date(datosPlan.pruebaFin) < ahora) return false
  return true
}

/**
 * El emisor registrado del usuario: con qué CUIT factura.
 *
 * Vive en `meta/fiscal`, que las reglas de Firestore dejan leer al dueño pero escribir sólo al
 * servidor. Antes vivía dentro de `negocioData`, y eso no alcanzaba: el navegador escribe ese
 * documento libremente, así que cualquiera podía ponerse el emisor de otro contribuyente de la
 * misma cuenta —son enteros correlativos, adivinarlos es trivial— y facturar con un CUIT ajeno.
 * Validar el tipo del número no alcanzaba: un emisor ajeno también es un entero válido.
 *
 * `legado` marca a quien registró su CUIT cuando todavía se guardaba del lado del navegador. Para
 * esos no hay emisor confiable y hay que pedirles que lo registren de nuevo: emitir sin
 * `emisor_id` usaría el emisor por defecto de la cuenta, o sea facturar con el CUIT equivocado.
 */
export async function emisorDe(db, uid) {
  const [fiscal, usuario] = await Promise.all([
    refFiscal(db, uid).get(),
    db.collection('users').doc(uid).get(),
  ])

  const id = fiscal.data()?.emisorId
  if (Number.isInteger(id) && id > 0) return { emisorId: id, legado: false }

  const viejo = usuario.data()?.negocioData?.datosEmisorFiscal?.emisorId
  return { emisorId: null, legado: Number.isInteger(viejo) && viejo > 0 }
}

export function refPlan(db, uid) {
  return db.collection('users').doc(uid).collection('meta').doc('plan')
}

export function refFiscal(db, uid) {
  return db.collection('users').doc(uid).collection('meta').doc('fiscal')
}
