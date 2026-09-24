// Lo que comparten los endpoints del segundo factor: dónde vive el registro y cómo se marca el
// token del usuario una vez verificado.
//
// La marca es un custom claim, no un dato en la base ni una bandera del navegador: viaja adentro
// del token de Firebase y las reglas de Firestore la exigen. Por eso alguien que solo toca el
// código del navegador no pasa — las reglas no le creen a la pantalla, le creen al token.
import { obtenerAuthAdmin } from './_firebaseAdmin.js'

/** Cuánto vale la marca del token antes de tener que renovarla. Corta a propósito: mientras está
 * viva, cualquier sesión de ese usuario la aprovecha (los claims son del usuario, no del
 * dispositivo), así que cuanto más chica sea la ventana, menos sirve para colarse. */
export const VIGENCIA_MARCA_MS = 12 * 60 * 60 * 1000

export function refMfa(db, uid) {
  return db.collection('users').doc(uid).collection('seguridad').doc('mfa')
}

export async function leerRegistro(db, uid) {
  const snap = await refMfa(db, uid).get()
  return snap.exists ? snap.data() : null
}

export async function guardarRegistro(db, uid, registro) {
  await refMfa(db, uid).set(registro, { merge: true })
}

/** Marca el token como verificado hasta dentro de VIGENCIA_MARCA_MS. El navegador tiene que pedir
 * un token nuevo (getIdToken(true)) para que el claim aparezca. */
export async function marcarVerificado(uid, ahora = Date.now()) {
  const auth = await obtenerAuthAdmin()
  const hasta = ahora + VIGENCIA_MARCA_MS
  await auth.setCustomUserClaims(uid, { mfaHasta: hasta })
  return hasta
}

/** El pepper con el que se hashean códigos y dispositivos. Sin él, los hashes guardados se pueden
 * recalcular desde afuera, así que el endpoint no debe seguir. */
export function pepper() {
  return process.env.MFA_PEPPER
}
