import { app, firebaseHabilitado } from './firebase'
import type { Cheque, ClasificacionesProveedores, CuentaBancaria, Deuda, Factura, IvaManualMes } from './cfo'
import type { Movimiento } from './movimientosSemana'

export interface NegocioDataUsuario {
  ingresos: number
  meses: number
  montos: Record<string, number>
  cuentas: CuentaBancaria[]
  deudas: Deuda[]
  realManualPorMes?: Record<string, Record<string, number>>
  facturas?: Factura[]
  clasificaciones?: ClasificacionesProveedores
  cheques?: Cheque[]
  ivaManualPorMes?: Record<string, IvaManualMes>
  tasaCrecimiento?: number
  nombreNegocio?: string
}

export interface DatosUsuario {
  negocioData?: NegocioDataUsuario
  movimientosSemana?: Movimiento[]
}

type FirestoreApi = {
  db: import('firebase/firestore').Firestore
  doc: typeof import('firebase/firestore').doc
  getDoc: typeof import('firebase/firestore').getDoc
  setDoc: typeof import('firebase/firestore').setDoc
}

let apiPromise: Promise<FirestoreApi | null> | null = null

function obtenerApi(): Promise<FirestoreApi | null> {
  if (!apiPromise) {
    apiPromise = (async () => {
      if (!firebaseHabilitado || !app) return null
      const { getFirestore, doc, getDoc, setDoc } = await import('firebase/firestore')
      return { db: getFirestore(app), doc, getDoc, setDoc }
    })()
  }
  return apiPromise
}

/** Trae los datos guardados del usuario logueado, o null si todavía no tiene nada guardado. */
export async function cargarDatosUsuario(uid: string): Promise<DatosUsuario | null> {
  const api = await obtenerApi()
  if (!api) return null
  const snap = await api.getDoc(api.doc(api.db, 'users', uid))
  return snap.exists() ? (snap.data() as DatosUsuario) : null
}

/** Guarda (mezclando, sin pisar otros campos) los datos del usuario logueado. */
export async function guardarDatosUsuario(uid: string, datos: Partial<DatosUsuario>): Promise<void> {
  const api = await obtenerApi()
  if (!api) return
  await api.setDoc(api.doc(api.db, 'users', uid), datos, { merge: true })
}
