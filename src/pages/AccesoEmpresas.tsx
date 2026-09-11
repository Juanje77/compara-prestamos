import { useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePlanUsuario } from '../lib/plan'
import { EmpresasPage } from './EmpresasPage'
import { PlanesEmpresa } from '../components/PlanesEmpresa'

export function AccesoEmpresas() {
  const { user, cargando: cargandoAuth, habilitado } = useAuth()
  const { plan, cargando: cargandoPlan } = usePlanUsuario(user?.uid)

  // Respaldo del webhook: si el plan quedó "pendiente" (ya se creó la suscripción pero
  // todavía no se confirmó), consultamos nosotros mismos a Mercado Pago cada pocos segundos
  // en vez de esperar indefinidamente una notificación que en modo de prueba a veces no llega.
  useEffect(() => {
    if (!user?.uid || plan.estado !== 'pendiente') return
    let cancelado = false
    let intentos = 0

    const verificar = async () => {
      if (cancelado) return
      intentos += 1
      try {
        await fetch(`/api/verificar-suscripcion?uid=${encodeURIComponent(user.uid)}`)
      } catch {
        // se reintenta en el próximo tick
      }
      if (!cancelado && intentos < 10) {
        setTimeout(verificar, 3000)
      }
    }

    const primerIntento = setTimeout(verificar, 1500)
    return () => {
      cancelado = true
      clearTimeout(primerIntento)
    }
  }, [user?.uid, plan.estado])

  if (!habilitado) {
    // Sin Firebase configurado (entorno de desarrollo, por ejemplo): dejamos pasar sin bloqueo,
    // con todas las funciones Premium habilitadas para poder probarlas.
    return <EmpresasPage esPremium />
  }

  if (cargandoAuth || (user && cargandoPlan)) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
  }

  if (user && plan.estado === 'pendiente') {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🧮 FinCorp para empresas
        </p>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Confirmando tu pago…
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ya recibimos tu suscripción y estamos confirmándola con Mercado Pago. Esto puede tardar unos
          segundos — no hace falta que recargues la página, se va a destrabar solo.
        </p>
      </div>
    )
  }

  if (plan.estado !== 'activo') {
    return <PlanesEmpresa />
  }

  return <EmpresasPage esPremium={plan.plan === 'premium'} />
}
