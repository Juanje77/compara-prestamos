// Inicializa Firebase Admin una sola vez por instancia de función serverless.
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function credencialesDesdeEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_KEY en el servidor.')
  return JSON.parse(raw)
}

export function obtenerFirestoreAdmin() {
  if (getApps().length === 0) {
    initializeApp({ credential: cert(credencialesDesdeEnv()) })
  }
  return getFirestore()
}
