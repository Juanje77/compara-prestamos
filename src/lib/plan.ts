import { useEffect, useState } from 'react'
import { app, firebaseHabilitado } from './firebase'

export type PlanTier = 'basico' | 'premium'
export type EstadoPlan = 'activo' | 'pausado' | 'cancelado' | 'pendiente'

export interface PlanUsuario {
  plan: PlanTier | null
  estado: EstadoPlan | null
}

const PLAN_VACIO: PlanUsuario = { plan: null, estado: null }

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
          callback({ plan: data?.plan ?? null, estado: data?.estado ?? null })
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
