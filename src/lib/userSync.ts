import { app, firebaseHabilitado } from './firebase'
import type { Anticipo, Bien, Cheque, ClasificacionesProveedores, CuentaBancaria, DatosEmisorFiscal, DatosEmpleador, Deuda, Empleado, Factura, IngresosBrutosManualMes, IvaManualMes, Liquidacion, MovimientoBancario, MovimientoDiario, MovimientoStock, MovimientoTesoreria, Pago, Producto, RemitoPresupuesto, Sector } from './cfo'
import type { Movimiento } from './movimientosSemana'

export interface NegocioDataUsuario {
  ingresos: number
  meses: number
  montos: Record<string, number>
  cuentas: CuentaBancaria[]
  deudas: Deuda[]
  bienes?: Bien[]
  realManualPorMes?: Record<string, Record<string, number>>
  ventasManualPorMes?: Record<string, number>
  facturas?: Factura[]
  clasificaciones?: ClasificacionesProveedores
  clientesManual?: string[]
  cheques?: Cheque[]
  pagos?: Pago[]
  remitos?: RemitoPresupuesto[]
  sectores?: Sector[]
  empleados?: Empleado[]
  datosEmpleador?: DatosEmpleador
  datosEmisorFiscal?: DatosEmisorFiscal
  liquidaciones?: Liquidacion[]
  anticipos?: Anticipo[]
  productos?: Producto[]
  movimientosStock?: MovimientoStock[]
  movimientosTesoreria?: MovimientoTesoreria[]
  movimientosBancarios?: MovimientoBancario[]
  ivaManualPorMes?: Record<string, IvaManualMes>
  ingresosBrutosManualPorMes?: Record<string, IngresosBrutosManualMes>
  movimientosDiarios?: MovimientoDiario[]
  tasaCrecimiento?: number
  nombreNegocio?: string
  /** Ver NegocioData.actualizadoEn en negocioData.ts — mismo propósito, del lado de la nube. */
  actualizadoEn?: number
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
  onSnapshot: typeof import('firebase/firestore').onSnapshot
}

let apiPromise: Promise<FirestoreApi | null> | null = null

function obtenerApi(): Promise<FirestoreApi | null> {
  if (!apiPromise) {
    apiPromise = (async () => {
      if (!firebaseHabilitado || !app) return null
      const { getFirestore, doc, getDoc, setDoc, onSnapshot } = await import('firebase/firestore')
      return { db: getFirestore(app), doc, getDoc, setDoc, onSnapshot }
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

/**
 * Como cargarDatosUsuario, pero se queda escuchando: si estos datos cambian en Firestore
 * (porque la misma empresa los está editando desde otra pestaña o dispositivo a la vez), llama
 * a `onDatos` de nuevo con la versión nueva, sin esperar a que se recargue la página. También
 * llama a `onDatos` con el primer valor apenas se conecta. Devuelve una función para dejar de
 * escuchar (llamarla al desmontar).
 */
export function suscribirseADatosUsuario(uid: string, onDatos: (datos: DatosUsuario | null) => void): () => void {
  let cancelado = false
  let dejarDeEscuchar: (() => void) | null = null
  obtenerApi().then((api) => {
    if (!api || cancelado) return
    dejarDeEscuchar = api.onSnapshot(
      api.doc(api.db, 'users', uid),
      (snap) => onDatos(snap.exists() ? (snap.data() as DatosUsuario) : null),
      () => {
        // Firestore puede no estar disponible todavía (sin conexión, etc.) — seguimos con lo local.
      },
    )
  })
  return () => {
    cancelado = true
    dejarDeEscuchar?.()
  }
}
