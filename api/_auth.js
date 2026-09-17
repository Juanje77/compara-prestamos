// Identidad del usuario en los endpoints que manejan credenciales fiscales.
//
// Las funciones más viejas de esta carpeta reciben el `uid` en el cuerpo y le creen. Para
// facturación eso no alcanza: quien pudiera mandar un uid ajeno estaría guardando o usando el
// token de emisión de otro contribuyente, o sea facturando con el CUIT de otro. Acá el uid sale
// del ID token de Firebase, verificado contra el Admin SDK, y nunca del cuerpo del pedido.
import { obtenerAuthAdmin } from './_firebaseAdmin.js'

/** uid del usuario autenticado, o null si falta el header, está mal formado o el token no valida. */
export async function uidAutenticado(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null

  const idToken = header.slice('Bearer '.length).trim()
  if (!idToken) return null

  try {
    const decodificado = await obtenerAuthAdmin().verifyIdToken(idToken)
    return decodificado.uid
  } catch {
    // Token vencido, de otro proyecto o directamente inventado: no distinguimos, todos son 401.
    return null
  }
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

/** Documento donde vive el token de emisión de un usuario. El SDK del navegador no puede leerlo:
 * las reglas de Firestore cierran la colección entera y sólo entra el Admin SDK. */
export function refTokenFiscal(db, uid) {
  return db.collection('users').doc(uid).collection('secretos').doc('fiscal')
}

export function refPlan(db, uid) {
  return db.collection('users').doc(uid).collection('meta').doc('plan')
}
