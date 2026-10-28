import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Calculator, Gift } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { usePlanUsuario, pruebaVencida, diasRestantesPrueba, enPeriodoDeGracia, diasRestantesGracia } from '../lib/plan'
import { EmpresasPage } from './EmpresasPage'
import { PlanesEmpresa } from '../components/PlanesEmpresa'
import { SegundoFactor } from '../components/SegundoFactor'
import { estadoMfa } from '../lib/mfa'
import { AceptarInvitacion } from '../components/AceptarInvitacion'
import { invitacionEnLaUrl } from '../lib/empresa'
import { useAcceso } from '../lib/useAcceso'
import { FincorpLogo } from '../components/FincorpLogo'
import { SesionUsuario } from '../components/Layout'
import { ThemeToggle } from '../components/ThemeToggle'
import { Link } from 'react-router-dom'

/**
 * El marco de todo lo que pasa ANTES de entrar al sistema: elegir plan, el segundo factor,
 * aceptar una invitación, los carteles de espera.
 *
 * Es deliberadamente mínimo. Estas pantallas no tienen secciones que navegar, así que ponerles
 * la barra lateral de la app sería mostrar un menú que todavía no lleva a ningún lado.
 */
function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-2)' }}>
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <Link to="/" aria-label="Ir al inicio">
          <FincorpLogo height={26} />
        </Link>
        <div className="flex items-center gap-3">
          <SesionUsuario />
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  )
}

export function AccesoEmpresas() {
  const { user, cargando: cargandoAuth, habilitado } = useAuth()
  // Quién es: dueño de su cuenta, o empleado de la empresa de otro. De acá sale el uid con el que
  // se habla con Firestore — para un empleado NO es el suyo, sino el del dueño.
  const { acceso, cargando: cargandoAcceso, refrescar: refrescarAcceso } = useAcceso()
  // El plan es el de la empresa. Un empleado no tiene plan propio y nunca va a tenerlo: paga el
  // dueño, y de ese plan depende qué módulos existen.
  const { plan, cargando: cargandoPlan } = usePlanUsuario(acceso?.empresaId)
  // El código del mail de invitación. Se guarda al montar y no se vuelve a leer de la URL: una
  // vez aceptada, limpiamos la dirección para que recargar no intente aceptarla de nuevo.
  const [codigoInvitacion, setCodigoInvitacion] = useState<string | null>(() =>
    invitacionEnLaUrl(window.location.search),
  )
  const pruebaIniciada = useRef(false)
  const [pruebaFallo, setPruebaFallo] = useState<string | null>(null)
  const [pruebaDenegada, setPruebaDenegada] = useState(false)
  // Cambiarlo es lo que hace que "Reintentar" vuelva a disparar el efecto de abajo: sin esto en
  // sus dependencias, limpiar pruebaFallo no alcanzaba para que el fetch se repitiera, y el botón
  // se quedaba mostrando el mismo error 12 segundos después sin haber vuelto a intentar nada.
  const [reintentoNonce, setReintentoNonce] = useState(0)
  const [confirmacionAgotada, setConfirmacionAgotada] = useState(false)
  const [verPlanesManual, setVerPlanesManual] = useState(false)
  // Segundo factor: null mientras no se sabe, true si este dispositivo tiene que verificarse.
  // Se consulta apenas hay sesión, y si el dispositivo ya está confiado el servidor le renueva la
  // marca al token sin que el usuario haga nada.
  const [pideCodigo, setPideCodigo] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) {
      setPideCodigo(null)
      return
    }
    let cancelado = false
    estadoMfa()
      .then((estado) => {
        if (!cancelado) setPideCodigo(estado.configurado && estado.haceFaltaCodigo)
      })
      .catch(() => {
        // Si la consulta falla (sin red, servidor caído), no se deja a nadie afuera: las reglas de
        // Firestore siguen exigiendo la marca, así que el que no pasó el factor no ve datos igual.
        if (!cancelado) setPideCodigo(false)
      })
    return () => {
      cancelado = true
    }
  }, [user])

  // Quién puede necesitar que le arranquemos la prueba gratis: un usuario que nunca tuvo ningún
  // plan, o uno que dejó un checkout de Mercado Pago a medias (crear-suscripcion ya escribe
  // "pendiente" apenas se toca un plan, antes de pagar nada) y esa suscripción nunca se confirmó
  // — ver la verificación de más abajo. Sin este segundo caso, un checkout abandonado dejaba a la
  // persona sin prueba para siempre, porque el cliente nunca volvía a intentarla.
  const sinPlan = plan.plan === null && plan.estado === null
  const checkoutAbandonado = plan.estado === 'pendiente' && confirmacionAgotada
  // Solo el dueño, y solo cuando ya sabemos que lo es. El `acceso !== null` no es de más: hasta
  // que el token no se lee, el plan que se está mirando es el vacío, así que un empleado daría
  // "sin plan" por un instante y le arrancaríamos una prueba en su propia cuenta — un plan
  // paralelo al de la empresa, que no usa nadie y encima le gasta la prueba gratis.
  const puedeIntentarPrueba = acceso !== null && acceso.esDueno && (sinPlan || checkoutAbandonado)

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

  if (cargandoAuth || (user && cargandoAcceso) || (user && cargandoPlan) || (user && pideCodigo === null)) {
    return (
      <Marco>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
      </Marco>
    )
  }

  // Antes que cualquier otra cosa de la cuenta: sin segundo factor no se muestra nada del negocio.
  if (user && pideCodigo) {
    return (
      <Marco>
        <SegundoFactor onVerificado={() => setPideCodigo(false)} />
      </Marco>
    )
  }

  // Entró con el link del mail: hasta que no acepte, su cuenta está vacía y mostrarle el sistema
  // sería mostrarle un negocio en blanco. Va después del segundo factor a propósito.
  if (user && codigoInvitacion) {
    return (
      <Marco>
        <AceptarInvitacion
          codigo={codigoInvitacion}
          email={user.email}
          onAceptada={() => {
            setCodigoInvitacion(null)
            // Saca el código de la URL: recargar no tiene que volver a intentar aceptar una
            // invitación que ya se usó, porque el servidor contestaría "ya se usó" sin motivo.
            window.history.replaceState(null, '', window.location.pathname)
            void refrescarAcceso()
          }}
          onCancelar={() => {
            setCodigoInvitacion(null)
            window.history.replaceState(null, '', window.location.pathname)
          }}
        /></Marco>
       )
  }

  if (user && plan.estado === 'pendiente' && !confirmacionAgotada) {
    return (
      <Marco>
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
        </div></Marco>
       )
  }

  if (user && puedeIntentarPrueba && pruebaFallo === null && !pruebaDenegada) {
    // La prueba gratis se está activando en segundo plano (ver el useEffect de arriba) — en
    // cuanto se cree o actualice el documento, este mismo componente se vuelve a renderizar
    // solo, gracias al listener en tiempo real de usePlanUsuario.
    return (
      <Marco>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Activando tu prueba gratis de 15 días…
        </p></Marco>
       )
  }

  if (user && pruebaFallo !== null && puedeIntentarPrueba) {
    return (
      <Marco>
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
        </div></Marco>
       )
  }

  const vencida = pruebaVencida(plan)
  const enGracia = enPeriodoDeGracia(plan)
  if ((plan.estado !== 'activo' && !enGracia) || vencida) {
    // Si la prueba se denegó estando en "pendiente" (ver puedeOtorgarsePrueba en _prueba.js), el
    // único motivo posible es que este usuario ya había usado una prueba antes.
    return (
      <Marco>
        <PlanesEmpresa motivoVencimiento={vencida || pruebaDenegada ? 'prueba' : plan.estado ? 'suscripcion' : undefined} /></Marco>
       )
  }

  if (verPlanesManual) {
    return (
      <Marco>
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
        </div></Marco>
       )
  }

  // Los avisos de prueba y de mora van ADENTRO de la app, no encima: fuera del marco quedarían
  // pegados al borde de la ventana, sin la barra lateral ni el encabezado, como si fueran de
  // otra página.
  const avisos = (
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
    </>
  )

  return (
    <EmpresasPage
      esPremium={plan.plan === 'premium' || plan.plan === 'full'}
      esFull={plan.plan === 'full'}
      acceso={acceso ?? undefined}
      aviso={avisos}
    />
  )
}
