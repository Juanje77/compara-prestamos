import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { usePlanUsuario, pruebaVencida, diasRestantesPrueba } from '../lib/plan'
import { EmpresasPage } from './EmpresasPage'
import { PlanesEmpresa } from '../components/PlanesEmpresa'

export function AccesoEmpresas() {
  const { user, cargando: cargandoAuth, habilitado } = useAuth()
  const { plan, cargando: cargandoPlan } = usePlanUsuario(user?.uid)
  const pruebaIniciada = useRef(false)
  const [pruebaFallo, setPruebaFallo] = useState<string | null>(null)
  const [confirmacionAgotada, setConfirmacionAgotada] = useState(false)

  // Un usuario que nunca tuvo ningún plan registrado arranca automáticamente una prueba gratis
  // de 15 días con acceso Full completo — sin que tenga que elegir nada. Se activa en el
  // servidor (con permisos de administrador) para que no se pueda reiniciar la prueba a mano.
  useEffect(() => {
    if (!habilitado || !user?.uid || cargandoPlan) return
    if (plan.plan !== null || plan.estado !== null) return
    if (pruebaIniciada.current) return
    pruebaIniciada.current = true
    fetch('/api/iniciar-prueba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid }),
    })
      .then(async (r) => {
        // `fetch` no rechaza ante un 500: sólo ante un error de red. Sin este chequeo, un endpoint
        // caído dejaba al usuario mirando "Activando tu prueba…" para siempre y en silencio.
        if (r.ok) return
        const cuerpo = await r.json().catch(() => null)
        throw new Error(`${r.status}${cuerpo?.motivo ? ` · ${cuerpo.motivo}` : ''}`)
      })
      .catch((e: Error) => {
        pruebaIniciada.current = false
        setPruebaFallo(e.message || 'sin respuesta')
      })
  }, [habilitado, user?.uid, cargandoPlan, plan.plan, plan.estado])

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
      if (cancelado) return
      if (intentos < 10) {
        setTimeout(verificar, 3000)
      } else {
        // Mercado Pago no confirmó nada en 30 segundos: lo más probable es que el checkout se haya
        // abandonado. Dejarlo en "Confirmando tu pago…" sería encerrarlo.
        setConfirmacionAgotada(true)
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
    // con todas las funciones (incluido Full) habilitadas para poder probarlas.
    return <EmpresasPage esPremium esFull />
  }

  if (cargandoAuth || (user && cargandoPlan)) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
  }

  if (user && plan.estado === 'pendiente' && !confirmacionAgotada) {
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

  if (user && plan.plan === null && plan.estado === null && pruebaFallo === null) {
    // Recién llegó y no tiene ningún plan registrado: la prueba gratis se está activando en
    // segundo plano (ver el useEffect de arriba) — en cuanto se cree el documento, este mismo
    // componente se vuelve a renderizar solo, gracias al listener en tiempo real de usePlanUsuario.
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Activando tu prueba gratis de 15 días…
      </p>
    )
  }

  if (user && pruebaFallo !== null && plan.plan === null) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          No pudimos activar tu prueba
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Fue un problema nuestro, no tuyo, y tu prueba gratis sigue disponible. Probá de nuevo; si
          vuelve a fallar, escribinos y la activamos a mano.
        </p>
        <button
          type="button"
          onClick={() => setPruebaFallo(null)}
          className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
          style={{ background: 'var(--series-blue)' }}
        >
          Reintentar
        </button>
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          Si nos escribís, pasanos este dato: {pruebaFallo}
        </p>
      </div>
    )
  }

  const vencida = pruebaVencida(plan)
  if (plan.estado !== 'activo' || vencida) {
    return <PlanesEmpresa motivoVencimiento={vencida ? 'prueba' : plan.estado ? 'suscripcion' : undefined} />
  }

  return (
    <>
      {plan.esPrueba && (
        <div
          className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--series-blue)', background: 'var(--surface-1)', color: 'var(--series-blue)' }}
        >
          🎁 Estás en tu prueba gratis de FinCorp Full — te quedan {diasRestantesPrueba(plan)}{' '}
          {diasRestantesPrueba(plan) === 1 ? 'día' : 'días'}.
        </div>
      )}
      <EmpresasPage
        esPremium={plan.plan === 'premium' || plan.plan === 'full'}
        esFull={plan.plan === 'full'}
      />
    </>
  )
}
