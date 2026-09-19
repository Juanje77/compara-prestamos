import { useEffect, useState } from 'react'
import { app, firebaseHabilitado } from './firebase'

/** "premium" internamente sigue siendo el valor guardado para el nivel medio (mostrado al
 * usuario como "Medio") — no se renombra para no romper el acceso de quienes ya están
 * suscriptos con ese valor en Firestore. "full" es el nivel nuevo, arriba de todo. */
export type PlanTier = 'basico' | 'premium' | 'full'
export type EstadoPlan = 'activo' | 'pausado' | 'cancelado' | 'pendiente'

export interface PlanUsuario {
  plan: PlanTier | null
  estado: EstadoPlan | null
  /** true mientras el acceso viene de la prueba gratis de 15 días, no de una suscripción paga. */
  esPrueba: boolean
  /** Fecha ISO en la que termina la prueba gratis (solo tiene sentido si esPrueba es true). */
  pruebaFin: string | null
  /** Fecha ISO desde la que el estado viene siendo "pausado" o "cancelado" sin interrupción — la
   * base del período de gracia (ver enPeriodoDeGracia). null si está activo o nunca falló un cobro. */
  pausadoDesde: string | null
}

const PLAN_VACIO: PlanUsuario = { plan: null, estado: null, esPrueba: false, pruebaFin: null, pausadoDesde: null }

/** true si la prueba gratis ya venció — a partir de ahí no alcanza con estado "activo". */
export function pruebaVencida(plan: PlanUsuario): boolean {
  return !!(plan.esPrueba && plan.pruebaFin && new Date(plan.pruebaFin) < new Date())
}

/** Días que quedan de prueba gratis (0 si no está en prueba o ya venció). */
export function diasRestantesPrueba(plan: PlanUsuario): number {
  if (!plan.esPrueba || !plan.pruebaFin) return 0
  const ms = new Date(plan.pruebaFin).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

/** Días de tolerancia tras un cobro fallido antes de cortar el acceso — no aplica a la prueba
 * gratis, solo a una suscripción paga que Mercado Pago pausó o canceló. */
export const DIAS_GRACIA_SUSCRIPCION = 5

/** true si el pago falló (estado "pausado"/"cancelado") pero todavía está dentro de los
 * DIAS_GRACIA_SUSCRIPCION desde que empezó a fallar — el acceso sigue funcionando igual. */
export function enPeriodoDeGracia(plan: PlanUsuario): boolean {
  if (plan.estado !== 'pausado' && plan.estado !== 'cancelado') return false
  if (!plan.pausadoDesde) return false
  const limite = new Date(plan.pausadoDesde).getTime() + DIAS_GRACIA_SUSCRIPCION * 24 * 60 * 60 * 1000
  return Date.now() < limite
}

/** Días que quedan de gracia (0 si no aplica o ya se agotó). */
export function diasRestantesGracia(plan: PlanUsuario): number {
  if (!plan.pausadoDesde || !enPeriodoDeGracia(plan)) return 0
  const limite = new Date(plan.pausadoDesde).getTime() + DIAS_GRACIA_SUSCRIPCION * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((limite - Date.now()) / (24 * 60 * 60 * 1000)))
}

type FirestoreApi = {
  db: import('firebase/firestore').Firestore
  doc: typeof import('firebase/firestore').doc
  onSnapshot: typeof import('firebase/firestore').onSnapshot
}

let apiPromise: Promise<FirestoreApi | null> | null = null

function obtenerApi(): Promise<FirestoreApi | null> {
  if (!apiPromise) {
    apiPromise = (async () => {
      if (!firebaseHabilitado || !app) return null
      const { getFirestore, doc, onSnapshot } = await import('firebase/firestore')
      return { db: getFirestore(app), doc, onSnapshot }
    })()
  }
  return apiPromise
}

/** Se suscribe en tiempo real al plan del usuario — así, apenas Mercado Pago confirma el pago
 * y el webhook actualiza Firestore, la app se destraba sola sin que el usuario recargue. */
function suscribirsePlanUsuario(uid: string, callback: (plan: PlanUsuario) => void): () => void {
  let cancelado = false
  let unsubscribe: (() => void) | null = null

  obtenerApi()
    .then((api) => {
      if (cancelado || !api) {
        callback(PLAN_VACIO)
        return
      }
      unsubscribe = api.onSnapshot(
        api.doc(api.db, 'users', uid, 'meta', 'plan'),
        (snap) => {
          // Un snapshot "fromCache" (sin red en el instante de conectar, típico de un dispositivo
          // que recién arranca) puede llegar vacío aunque el usuario sí tenga un plan real en el
          // servidor. Tratarlo como definitivo mostraría "sin plan" por un instante y podría
          // disparar la activación de la prueba gratis de más — se espera al snapshot confirmado
          // por el servidor, que llega solo apenas hay conexión.
          if (snap.metadata.fromCache) return
          const data = snap.data() as Partial<PlanUsuario> | undefined
          callback({
            plan: data?.plan ?? null,
            estado: data?.estado ?? null,
            esPrueba: data?.esPrueba ?? false,
            pruebaFin: data?.pruebaFin ?? null,
            pausadoDesde: data?.pausadoDesde ?? null,
          })
        },
        () => callback(PLAN_VACIO),
      )
    })
    .catch(() => callback(PLAN_VACIO))

  return () => {
    cancelado = true
    unsubscribe?.()
  }
}

export function usePlanUsuario(uid: string | undefined): { cargando: boolean; plan: PlanUsuario } {
  const [cargando, setCargando] = useState(true)
  const [plan, setPlan] = useState<PlanUsuario>(PLAN_VACIO)

  useEffect(() => {
    if (!uid) {
      setPlan(PLAN_VACIO)
      setCargando(false)
      return
    }
    setCargando(true)
    const unsubscribe = suscribirsePlanUsuario(uid, (p) => {
      setPlan(p)
      setCargando(false)
    })
    return unsubscribe
  }, [uid])

  return { cargando, plan }
}
