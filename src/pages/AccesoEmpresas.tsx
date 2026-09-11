import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePlanUsuario } from '../lib/plan'
import { EmpresasPage } from './EmpresasPage'
import { PlanesEmpresa } from '../components/PlanesEmpresa'
import { LoginModal } from '../components/LoginModal'

export function AccesoEmpresas() {
  const { user, cargando: cargandoAuth, habilitado } = useAuth()
  const { plan, cargando: cargandoPlan } = usePlanUsuario(user?.uid)
  const [mostrarLogin, setMostrarLogin] = useState(false)

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
    // Sin Firebase configurado (entorno de desarrollo, por ejemplo): dejamos pasar sin bloqueo.
    return <EmpresasPage />
  }

  if (cargandoAuth) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🧮 Finko para empresas
        </p>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Necesitás una cuenta para entrar
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Iniciá sesión (o creá una cuenta gratis) para ver los planes y acceder al dashboard financiero de
          tu negocio.
        </p>
        <button
          onClick={() => setMostrarLogin(true)}
          className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--series-blue)' }}
        >
          Iniciar sesión
        </button>
        {mostrarLogin && <LoginModal onCerrar={() => setMostrarLogin(false)} />}
      </div>
    )
  }

  if (cargandoPlan) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
  }

  if (plan.estado !== 'activo') {
    return <PlanesEmpresa />
  }

  return <EmpresasPage />
}
