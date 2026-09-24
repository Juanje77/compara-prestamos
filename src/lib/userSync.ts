import { app, firebaseHabilitado } from './firebase'
import type { Anticipo, Bien, Cheque, ClasificacionesProveedores, CuentaBancaria, DatosEmisorFiscal, Deuda, Empleado, Factura, IngresosBrutosManualMes, IvaManualMes, MovimientoBancario, MovimientoDiario, MovimientoStock, MovimientoTesoreria, Pago, Producto, RemitoPresupuesto, Sector } from './cfo'
import type { Movimiento } from './movimientosSemana'
import type { DatosMonotributo } from './monotributo'

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
  monotributo?: DatosMonotributo
  tasaCrecimiento?: number
  nombreNegocio?: string
  /** Ver NegocioData.actualizadoEn en negocioData.ts — mismo propósito, del lado de la nube. */
  actualizadoEn?: number
}

export interface BackupAutomaticoEntry {
  /** Id del documento en la subcolección `backups`. Los automáticos usan la fecha (YYYY-MM-DD),
   * así nunca hay dos el mismo día; los que se piden a mano llevan además la hora, para que se
   * puedan guardar varios en el mismo día sin pisarse. Los dos empiezan con la fecha, así que
   * ordenar por id sigue siendo ordenar cronológicamente. */
  id: string
  creadoEn: number
  /** true si lo pidió el usuario con el botón, en vez de salir de la copia diaria. */
  manual?: boolean
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
      (snap) => {
        // Un snapshot "fromCache" es la respuesta que da el SDK cuando todavía no hubo ida y
        // vuelta al servidor (por ejemplo, sin red en el instante de conectar) — no es un "no
        // existe" confirmado. En un dispositivo sin nada guardado en caché local, eso llega vacío,
        // y si lo tratáramos como definitivo, EmpresasPage lo toma como "no hay nada" y —peor—
        // habilita el guardado hacia la nube con ese vacío, pudiendo pisar datos reales que sí
        // están en el servidor. Por eso se espera al primer snapshot confirmado por el servidor:
        // si no hay red, no se llama a onDatos, y este mismo listener se vuelve a disparar solo
        // en cuanto la conexión se restablezca.
        if (snap.metadata.fromCache) return
        onDatos(snap.exists() ? (snap.data() as DatosUsuario) : null)
      },
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

/** El id del backup que se guarda ahora a pedido: fecha y hora, para que dos del mismo día no se
 * pisen. Los dos puntos no se llevan bien con los ids de documento, así que van como guiones. */
function idBackupManual(ahora = new Date()): string {
  return ahora.toISOString().slice(0, 16).replace(':', '-')
}

/**
 * Guarda una copia ahora, porque el usuario la pidió. A diferencia de la diaria, no pregunta si ya
 * hay una: cuando alguien toca el botón es porque quiere justo este estado guardado —típicamente
 * antes de tocar algo importante—, y decirle "ya tenés una de hoy" sería no hacer lo que pidió.
 *
 * Esta sí propaga el error: el botón tiene que poder avisar si no se pudo.
 */
export async function guardarBackupAhora(
  uid: string,
  negocioData: NegocioDataUsuario,
  indiceActual: BackupAutomaticoEntry[],
): Promise<BackupAutomaticoEntry> {
  const api = await obtenerApi()
  if (!api) throw new Error('No hay conexión con la nube para guardar la copia.')

  const entrada: BackupAutomaticoEntry = { id: idBackupManual(), creadoEn: Date.now(), manual: true }
  await api.setDoc(api.doc(api.db, 'users', uid, 'backups', entrada.id), negocioData)

  const ordenado = [...indiceActual.filter((b) => b.id !== entrada.id), entrada].sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const excedente = ordenado.length - MAX_BACKUPS_AUTOMATICOS
  const aBorrar = excedente > 0 ? ordenado.slice(0, excedente) : []
  const vigentes = excedente > 0 ? ordenado.slice(excedente) : ordenado

  await api.setDoc(api.doc(api.db, 'users', uid), { backupsIndex: vigentes }, { merge: true })
  // La limpieza de los viejos es best-effort: si falla, la copia nueva igual quedó guardada.
  await Promise.all(
    aBorrar.map((b) => api.deleteDoc(api.doc(api.db, 'users', uid, 'backups', b.id)).catch(() => {})),
  )
  return entrada
}

/** Trae el cuerpo completo de un backup automático puntual, para descargarlo o restaurarlo. */
export async function cargarBackupAutomatico(uid: string, id: string): Promise<NegocioDataUsuario | null> {
  const api = await obtenerApi()
  if (!api) return null
  const snap = await api.getDoc(api.doc(api.db, 'users', uid, 'backups', id))
  return snap.exists() ? (snap.data() as NegocioDataUsuario) : null
}
