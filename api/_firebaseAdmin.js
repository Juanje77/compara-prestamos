// Inicializa Firebase Admin una sola vez por instancia de función serverless.
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function credencialesDesdeEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_KEY en el servidor.')
  return JSON.parse(raw)
}

function inicializar() {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(credencialesDesdeEnv()) })
  }
}

export function obtenerFirestoreAdmin() {
  inicializar()
  return getFirestore()
}

// `firebase-admin/auth` importa `jwks-rsa`, que en la versión que arrastra intenta cargar `jose`
// con require() — y la versión de `jose` instalada es ESM puro, así que ese require truena con
// ERR_REQUIRE_ESM. Eso pasaba al CARGAR el módulo, no al llamar a nada: cualquier función que
// importara este archivo se caía, incluidas las que sólo necesitan Firestore y nunca tocan Auth
// (iniciar-prueba, crear-suscripcion, el webhook de Mercado Pago).
//
// Por eso el import de `firebase-admin/auth` va ACÁ ADENTRO, como import() dinámico, y no arriba
// del archivo: así sólo se carga (y sólo puede romper) cuando alguien realmente llama a
// obtenerAuthAdmin() — hoy sólo los endpoints de facturación electrónica que verifican sesión.
export async function obtenerAuthAdmin() {
  inicializar()
  const { getAuth } = await import('firebase-admin/auth')
  return getAuth()
}
