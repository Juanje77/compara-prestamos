import { app, firebaseHabilitado } from './firebase'
import type { Anticipo, Bien, Cheque, ClasificacionesProveedores, CuentaBancaria, DatosEmisorFiscal, Deuda, Empleado, Factura, IngresosBrutosManualMes, IvaManualMes, MovimientoBancario, MovimientoDiario, MovimientoStock, MovimientoTesoreria, Pago, Producto, RemitoPresupuesto, Sector } from './cfo'
import type { Movimiento } from './movimientosSemana'
import type { DatosMonotributo } from './monotributo'
import {
  BLOQUES,
  bloquesQueCambiaron,
  partirNegocio,
  unirBloques,
  type BloquesNegocio,
  type ContenidoBloque,
} from './negocioBloques'
import type { BloqueDatos } from './permisos'

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
  /** Cuándo se pasó esta cuenta a guardar el negocio en bloques. Su presencia dice que el
   * `negocioData` del documento principal ya no es la verdad, sino el respaldo de antes. */
  migradoABloquesEn?: number
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

/** El documento de un bloque del negocio — ver negocioBloques.ts y permisos.ts. */
function refBloque(api: FirestoreApi, uid: string, bloque: BloqueDatos) {
  return api.doc(api.db, 'users', uid, 'datos', bloque)
}

/** Trae los datos guardados del usuario logueado, o null si todavía no tiene nada guardado. */
export async function cargarDatosUsuario(uid: string, bloques: BloqueDatos[] = BLOQUES): Promise<DatosUsuario | null> {
  const api = await obtenerApi()
  if (!api) return null
  const [principal, ...snapsBloques] = await Promise.all([
    api.getDoc(api.doc(api.db, 'users', uid)),
    ...bloques.map((b) => api.getDoc(refBloque(api, uid, b))),
  ])

  const porBloque: BloquesNegocio = {}
  snapsBloques.forEach((snap, i) => {
    if (snap.exists()) porBloque[bloques[i]] = snap.data() as ContenidoBloque
  })

  const base = principal.exists() ? (principal.data() as DatosUsuario) : null
  if (!base && Object.keys(porBloque).length === 0) return null

  return armarDatos(base, porBloque)
}

/**
 * Junta el documento principal con los bloques. Los bloques mandan: el `negocioData` del
 * documento principal es la foto anterior a partirlo, que se deja como respaldo pero ya no es la
 * verdad (ver migrarABloques).
 *
 * `movimientosSemana` sale del bloque `semana` y vuelve a su lugar de siempre, para que el resto
 * del sistema no se entere de que ahora vive en un documento aparte.
 */
function armarDatos(base: DatosUsuario | null, porBloque: BloquesNegocio): DatosUsuario {
  const hayBloques = Object.keys(porBloque).length > 0
  if (!hayBloques) return { ...(base ?? {}) }

  const { movimientosSemana, ...negocio } = unirBloques(porBloque) as Record<string, unknown>
  return {
    ...(base ?? {}),
    negocioData: negocio as unknown as NegocioDataUsuario,
    movimientosSemana: (movimientosSemana as Movimiento[] | undefined) ?? base?.movimientosSemana,
  }
}

/**
 * El objeto que se reparte en bloques. Es el negocio más `movimientosSemana`, que se guarda al
 * lado y no adentro, pero necesita su propio documento por la misma razón que el resto: que un
 * empleado con Cobranzas pueda leerlo sin que eso le abra los sueldos.
 */
function aPartir(negocio: NegocioDataUsuario | undefined, semana: Movimiento[] | undefined): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(negocio ?? {}) }
  if (semana !== undefined) base.movimientosSemana = semana
  return base
}

/** Lo último que se guardó de cada bloque, para no reescribir los que no cambiaron. */
const ultimosBloques = new Map<string, BloquesNegocio>()

/**
 * Guarda los datos del usuario. El negocio se parte en bloques y se escriben solo los que
 * cambiaron: Firestore cobra por escritura y guardar los cinco en cada tecla sería multiplicar
 * por cinco el costo sin ninguna ganancia.
 *
 * El resto de los campos (movimientos de la semana, índice de backups) siguen en el documento
 * principal, que no tiene nada sensible y lo lee cualquier miembro.
 */
export async function guardarDatosUsuario(
  uid: string,
  datos: Partial<DatosUsuario>,
  /** Qué bloques tiene permitido escribir quien guarda. Para un empleado es clave: su pantalla
   * arranca con `empleados: []` porque no puede leer ese bloque, y si lo guardara estaría
   * borrando la nómina. Las reglas de Firestore lo rechazarían igual —son la frontera real—,
   * pero no hay por qué mandar una escritura que sabemos que está mal. */
  bloquesPermitidos: BloqueDatos[] = BLOQUES,
): Promise<void> {
  const api = await obtenerApi()
  if (!api) return

  const { negocioData, movimientosSemana, ...resto } = datos
  const escrituras: Promise<unknown>[] = []

  if (Object.keys(resto).length > 0) {
    escrituras.push(api.setDoc(api.doc(api.db, 'users', uid), resto, { merge: true }))
  }

  if (negocioData || movimientosSemana) {
    const partido = partirNegocio(aPartir(negocioData, movimientosSemana))
    // Solo se comparan los bloques que este guardado trae. Un guardado de la planilla semanal no
    // sabe nada del negocio, y si se comparara contra el estado completo borraría los otros cuatro.
    const previos = ultimosBloques.get(uid) ?? null
    const alcance = BLOQUES.filter((b) => partido[b] !== undefined || previos?.[b] !== undefined)
    const cambiados = bloquesQueCambiaron(partido, previos).filter(
      (b) => alcance.includes(b) && partido[b] !== undefined && bloquesPermitidos.includes(b),
    )
    for (const bloque of cambiados) {
      escrituras.push(api.setDoc(refBloque(api, uid, bloque), partido[bloque] ?? {}))
    }
    // Se recuerda recién después de que las escrituras salieron: si fallan, el próximo intento
    // tiene que volver a mandarlas y no creer que ya están guardadas.
    await Promise.all(escrituras)
    ultimosBloques.set(uid, { ...(previos ?? {}), ...partido })
    return
  }

  await Promise.all(escrituras)
}

/**
 * Pasa a bloques un negocio que todavía estaba guardado entero en el documento principal.
 *
 * Corre una sola vez por cuenta, al detectar que hay `negocioData` pero ningún bloque. El
 * `negocioData` viejo NO se borra: queda como respaldo de cómo estaba todo justo antes de
 * partirlo, por si algo sale mal. Limpiarlo es una tarea aparte, para otro día, cuando esto haya
 * estado un tiempo andando.
 */
export async function migrarABloques(
  uid: string,
  negocioData: NegocioDataUsuario,
  movimientosSemana?: Movimiento[],
): Promise<void> {
  const api = await obtenerApi()
  if (!api) return
  const partido = partirNegocio(aPartir(negocioData, movimientosSemana))
  await Promise.all(
    BLOQUES.filter((b) => partido[b] !== undefined).map((b) => api.setDoc(refBloque(api, uid, b), partido[b] ?? {})),
  )
  await api.setDoc(api.doc(api.db, 'users', uid), { migradoABloquesEn: Date.now() }, { merge: true })
  ultimosBloques.set(uid, partido)
}

/**
 * Como cargarDatosUsuario, pero se queda escuchando: si estos datos cambian en Firestore
 * (porque la misma empresa los está editando desde otra pestaña o dispositivo a la vez), llama
 * a `onDatos` de nuevo con la versión nueva, sin esperar a que se recargue la página. También
 * llama a `onDatos` con el primer valor apenas se conecta. Devuelve una función para dejar de
 * escuchar (llamarla al desmontar).
 */
export function suscribirseADatosUsuario(
  uid: string,
  onDatos: (datos: DatosUsuario | null) => void,
  /** Qué bloques escuchar. El dueño los escucha todos; un empleado, solo los de sus módulos —
   * pedir uno al que no tiene acceso haría que la regla rechace el listener. */
  bloques: BloqueDatos[] = BLOQUES,
): () => void {
  let cancelado = false
  const bajas: (() => void)[] = []

  // Lo último recibido de cada parte. Cada documento llega por su cuenta y en cualquier orden, así
  // que se guardan y se avisa con todo junto: si no, la pantalla vería un negocio a medio armar.
  let principal: DatosUsuario | null = null
  let principalLlego = false
  const porBloque: BloquesNegocio = {}
  const bloquesLlegados = new Set<BloqueDatos>()
  let migracionIntentada = false

  function avisar() {
    // Recién cuando contestaron todos: avisar antes dejaría a EmpresasPage guardando sobre un
    // negocio incompleto, que es exactamente cómo se pierden datos.
    if (!principalLlego || bloquesLlegados.size < bloques.length) return

    const hayBloques = Object.keys(porBloque).length > 0
    const legado = principal?.negocioData

    // Cuenta vieja: tiene el negocio entero en el documento principal y ningún bloque todavía.
    // Se parte una sola vez, sin borrar el original.
    if (!hayBloques && legado && !migracionIntentada) {
      migracionIntentada = true
      void migrarABloques(uid, legado, principal?.movimientosSemana).catch(() => {
        // Si falla, se sigue mostrando el negocio del documento principal y se reintenta la
        // próxima vez que se abra la app: no se pierde nada.
      })
    }

    if (!principal && !hayBloques) {
      onDatos(null)
      return
    }
    onDatos(armarDatos(principal, porBloque))
  }

  obtenerApi().then((api) => {
    if (!api || cancelado) return

    for (const bloque of bloques) {
      bajas.push(
        api.onSnapshot(
          refBloque(api, uid, bloque),
          (snap) => {
            if (snap.metadata.fromCache) return
            if (snap.exists()) porBloque[bloque] = snap.data() as ContenidoBloque
            else delete porBloque[bloque]
            bloquesLlegados.add(bloque)
            avisar()
          },
          () => {
            // Sin permiso sobre este bloque (o sin conexión): se lo da por contestado y vacío,
            // para no dejar la pantalla esperando para siempre por algo que no va a llegar.
            bloquesLlegados.add(bloque)
            avisar()
          },
        ),
      )
    }

    bajas.push(api.onSnapshot(
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
        principal = snap.exists() ? (snap.data() as DatosUsuario) : null
        principalLlego = true
        avisar()
      },
      () => {
        // Firestore puede no estar disponible todavía (sin conexión, etc.) — seguimos con lo local.
      },
    ))
  })
  return () => {
    cancelado = true
    for (const baja of bajas) baja()
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
