import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Calculator, Gift } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { usePlanUsuario, pruebaVencida, diasRestantesPrueba, enPeriodoDeGracia, diasRestantesGracia } from '../lib/plan'
import { EmpresasPage } from './EmpresasPage'
import { PlanesEmpresa } from '../components/PlanesEmpresa'

export function AccesoEmpresas() {
  const { user, cargando: cargandoAuth, habilitado } = useAuth()
  const { plan, cargando: cargandoPlan } = usePlanUsuario(user?.uid)
  const pruebaIniciada = useRef(false)
  const [pruebaFallo, setPruebaFallo] = useState<string | null>(null)
  const [pruebaDenegada, setPruebaDenegada] = useState(false)
  // Cambiarlo es lo que hace que "Reintentar" vuelva a disparar el efecto de abajo: sin esto en
  // sus dependencias, limpiar pruebaFallo no alcanzaba para que el fetch se repitiera, y el botón
  // se quedaba mostrando el mismo error 12 segundos después sin haber vuelto a intentar nada.
  const [reintentoNonce, setReintentoNonce] = useState(0)
  const [confirmacionAgotada, setConfirmacionAgotada] = useState(false)
  const [verPlanesManual, setVerPlanesManual] = useState(false)

  // Quién puede necesitar que le arranquemos la prueba gratis: un usuario que nunca tuvo ningún
  // plan, o uno que dejó un checkout de Mercado Pago a medias (crear-suscripcion ya escribe
  // "pendiente" apenas se toca un plan, antes de pagar nada) y esa suscripción nunca se confirmó
  // — ver la verificación de más abajo. Sin este segundo caso, un checkout abandonado dejaba a la
  // persona sin prueba para siempre, porque el cliente nunca volvía a intentarla.
  const sinPlan = plan.plan === null && plan.estado === null
  const checkoutAbandonado = plan.estado === 'pendiente' && confirmacionAgotada
  const puedeIntentarPrueba = sinPlan || checkoutAbandonado

  // Arranca automáticamente una prueba gratis de 15 días con acceso Full completo — sin que el
  // usuario tenga que elegir nada. Se activa en el servidor (con permisos de administrador) para
  // que no se pueda reiniciar la prueba a mano; el propio servidor decide si corresponde o no
  // (por ejemplo, si ya usó una prueba antes, este mismo pedido no cambia nada).
  useEffect(() => {
    if (!habilitado || !user?.uid || cargandoPlan || !puedeIntentarPrueba) return
    if (pruebaIniciada.current) return
    pruebaIniciada.current = true
    // El servidor saca el uid del token, no del cuerpo — ver api/iniciar-prueba.js.
    user
      .getIdToken()
      .then((idToken) =>
        fetch('/api/iniciar-prueba', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      )
      .then(async (r) => {
        // `fetch` no rechaza ante un 500: sólo ante un error de red. Sin este chequeo, un endpoint
        // caído dejaba al usuario mirando "Activando tu prueba…" para siempre y en silencio.
        const tipo = r.headers.get('content-type') ?? ''
        if (!tipo.includes('application/json')) {
          // Un 200 que devuelve HTML significa que la ruta de /api/ no se está ejecutando y la cayó
          // el rewrite de la SPA. Se ve igual que un éxito, pero no escribió nada.
          throw new Error(`${r.status} · respuesta no-JSON (${tipo.split(';')[0] || 'sin tipo'})`)
        }
        const cuerpo = await r.json().catch(() => null)
        if (!r.ok) {
          throw new Error(`${r.status}${cuerpo?.motivo ? ` · ${cuerpo.motivo}` : ''}`)
        }
        // Un 200 no siempre significa "prueba otorgada": si el servidor decide que no corresponde
        // (ya usó una antes), devuelve el plan tal cual estaba, sin tocar nada. Sin este chequeo,
        // ese caso se quedaba esperando para siempre un cambio en Firestore que nunca iba a llegar.
        if (cuerpo?.estado !== 'activo') {
          setPruebaDenegada(true)
        }
      })
      .catch((e: Error) => {
        pruebaIniciada.current = false
        setPruebaFallo(e.message || 'sin respuesta')
      })
  }, [habilitado, user, cargandoPlan, puedeIntentarPrueba, reintentoNonce])

  // Red de seguridad: si después de unos segundos el plan sigue sin aparecer, algo salió mal aunque
  // el pedido no haya dado error. Mejor mostrar una salida que dejar a alguien mirando un cartel
  // que no avanza nunca.
  useEffect(() => {
    if (!habilitado || !user?.uid || cargandoPlan || !puedeIntentarPrueba) return
    if (pruebaFallo !== null || pruebaDenegada) return

    const reloj = setTimeout(() => setPruebaFallo('sin respuesta a tiempo'), 12000)
    return () => clearTimeout(reloj)
  }, [habilitado, user?.uid, cargandoPlan, puedeIntentarPrueba, pruebaFallo, pruebaDenegada])

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
        const idToken = await user.getIdToken()
        await fetch('/api/verificar-suscripcion', { headers: { Authorization: `Bearer ${idToken}` } })
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
  }, [user, plan.estado])

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
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          <Calculator size={14} aria-hidden="true" /> FinCorp para empresas
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

  if (user && puedeIntentarPrueba && pruebaFallo === null && !pruebaDenegada) {
    // La prueba gratis se está activando en segundo plano (ver el useEffect de arriba) — en
    // cuanto se cree o actualice el documento, este mismo componente se vuelve a renderizar
    // solo, gracias al listener en tiempo real de usePlanUsuario.
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Activando tu prueba gratis de 15 días…
      </p>
    )
  }

  if (user && pruebaFallo !== null && puedeIntentarPrueba) {
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
          onClick={() => {
            setPruebaFallo(null)
            setReintentoNonce((n) => n + 1)
          }}
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
  const enGracia = enPeriodoDeGracia(plan)
  if ((plan.estado !== 'activo' && !enGracia) || vencida) {
    // Si la prueba se denegó estando en "pendiente" (ver puedeOtorgarsePrueba en _prueba.js), el
    // único motivo posible es que este usuario ya había usado una prueba antes.
    return (
      <PlanesEmpresa motivoVencimiento={vencida || pruebaDenegada ? 'prueba' : plan.estado ? 'suscripcion' : undefined} />
    )
  }

  if (verPlanesManual) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setVerPlanesManual(false)}
          className="mb-4 text-sm font-medium"
          style={{ color: 'var(--series-blue)' }}
        >
          ‹ Volver
        </button>
        <PlanesEmpresa motivoVencimiento="suscripcion" />
      </div>
    )
  }

  return (
    <>
      {plan.esPrueba && (
        <div
          className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--series-blue)', background: 'var(--surface-1)', color: 'var(--series-blue)' }}
        >
          <Gift size={16} className="shrink-0" aria-hidden="true" /> Estás en tu prueba gratis de FinCorp Full — te quedan {diasRestantesPrueba(plan)}{' '}
          {diasRestantesPrueba(plan) === 1 ? 'día' : 'días'}.
        </div>
      )}
      {enGracia && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--status-critical)', background: 'var(--surface-1)', color: 'var(--status-critical)' }}
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
            No pudimos procesar el pago de tu suscripción. Te quedan {diasRestantesGracia(plan)}{' '}
            {diasRestantesGracia(plan) === 1 ? 'día' : 'días'} de acceso antes de perderlo.
          </span>
          <button
            type="button"
            onClick={() => setVerPlanesManual(true)}
            className="shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold text-white"
            style={{ background: 'var(--status-critical)' }}
          >
            Regularizar pago
          </button>
        </div>
      )}
      <EmpresasPage
        esPremium={plan.plan === 'premium' || plan.plan === 'full'}
        esFull={plan.plan === 'full'}
      />
    </>
  )
}
