import { app, firebaseHabilitado } from './firebase'
import type { Anticipo, Bien, Cheque, ClasificacionesProveedores, CuentaBancaria, DatosEmisorFiscal, Deuda, Empleado, Factura, IngresosBrutosManualMes, IvaManualMes, MovimientoBancario, MovimientoDiario, MovimientoStock, MovimientoTesoreria, Pago, Producto, RemitoPresupuesto, Sector } from './cfo'
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
  datosEmisorFiscal?: DatosEmisorFiscal
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

export interface BackupAutomaticoEntry {
  /** Fecha ISO (YYYY-MM-DD) del snapshot — también el id del documento en la subcolección
   * `backups`, así nunca hay dos backups automáticos el mismo día. */
  id: string
  creadoEn: number
}

export interface DatosUsuario {
  negocioData?: NegocioDataUsuario
  movimientosSemana?: Movimiento[]
  /** Historial de backups automáticos diarios — ver guardarBackupAutomaticoSiHaceFalta. El cuerpo
   * de cada uno vive aparte, en users/{uid}/backups/{id}, para no traer todo ese peso cada vez que
   * se lee el documento principal del usuario. */
  backupsIndex?: BackupAutomaticoEntry[]
}

type FirestoreApi = {
  db: import('firebase/firestore').Firestore
  doc: typeof import('firebase/firestore').doc
  getDoc: typeof import('firebase/firestore').getDoc
  setDoc: typeof import('firebase/firestore').setDoc
  deleteDoc: typeof import('firebase/firestore').deleteDoc
  onSnapshot: typeof import('firebase/firestore').onSnapshot
}

let apiPromise: Promise<FirestoreApi | null> | null = null

function obtenerApi(): Promise<FirestoreApi | null> {
  if (!apiPromise) {
    apiPromise = (async () => {
      if (!firebaseHabilitado || !app) return null
      const { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot } = await import('firebase/firestore')
      return { db: getFirestore(app), doc, getDoc, setDoc, deleteDoc, onSnapshot }
    })()
  }
  return apiPromise
}

export const MAX_BACKUPS_AUTOMATICOS = 14

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

/**
 * Si hoy todavía no hay un backup automático guardado, guarda uno con el `negocioData` que se
 * acaba de leer de la nube — no hace falta esperar a que el estado local termine de asentarse,
 * porque esto se llama justo al conectar, con datos recién traídos y ya coherentes entre sí.
 * Guarda como mucho uno por día y no deja crecer el historial más allá de
 * MAX_BACKUPS_AUTOMATICOS, borrando los más viejos. Es best-effort: si algo falla acá (sin
 * conexión, permisos) no debe romper la carga normal de la app — el backup manual sigue andando.
 */
export async function guardarBackupAutomaticoSiHaceFalta(
  uid: string,
  negocioData: NegocioDataUsuario,
  indiceActual: BackupAutomaticoEntry[],
): Promise<void> {
  const hoy = new Date().toISOString().slice(0, 10)
  if (indiceActual.some((b) => b.id === hoy)) return
  try {
    const api = await obtenerApi()
    if (!api) return
    await api.setDoc(api.doc(api.db, 'users', uid, 'backups', hoy), negocioData)

    const indiceOrdenado = [...indiceActual.filter((b) => b.id !== hoy), { id: hoy, creadoEn: Date.now() }].sort(
      (a, b) => a.id.localeCompare(b.id),
    )
    const excedente = indiceOrdenado.length - MAX_BACKUPS_AUTOMATICOS
    const aBorrar = excedente > 0 ? indiceOrdenado.slice(0, excedente) : []
    const vigentes = excedente > 0 ? indiceOrdenado.slice(excedente) : indiceOrdenado

    await api.setDoc(api.doc(api.db, 'users', uid), { backupsIndex: vigentes }, { merge: true })
    await Promise.all(aBorrar.map((b) => api.deleteDoc(api.doc(api.db, 'users', uid, 'backups', b.id))))
  } catch {
    // Best-effort — ver comentario de la función.
  }
}

/** Trae el cuerpo completo de un backup automático puntual, para descargarlo o restaurarlo. */
export async function cargarBackupAutomatico(uid: string, id: string): Promise<NegocioDataUsuario | null> {
  const api = await obtenerApi()
  if (!api) return null
  const snap = await api.getDoc(api.doc(api.db, 'users', uid, 'backups', id))
  return snap.exists() ? (snap.data() as NegocioDataUsuario) : null
}
