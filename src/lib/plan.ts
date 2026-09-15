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
}

const PLAN_VACIO: PlanUsuario = { plan: null, estado: null, esPrueba: false, pruebaFin: null }

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
          const data = snap.data() as Partial<PlanUsuario> | undefined
          callback({
            plan: data?.plan ?? null,
            estado: data?.estado ?? null,
            esPrueba: data?.esPrueba ?? false,
            pruebaFin: data?.pruebaFin ?? null,
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
