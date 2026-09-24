import { useEffect, useState } from 'react'
import { Calculator, Check } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { formatoMoneda } from '../lib/finance'
import type { PlanTier } from '../lib/plan'
import { LoginModal } from './LoginModal'
import { Card } from './Card'
import { Button } from './Button'

interface PlanConfig {
  key: PlanTier
  nombre: string
  precio: number
  descripcion: string
  features: string[]
}

const PLANES: PlanConfig[] = [
  {
    key: 'basico',
    nombre: 'Básico',
    precio: 20000,
    descripcion: 'Ideal para negocios chicos y monotributistas: cargá tus números día a día y armá tu tablero financiero.',
    features: [
      'Ingresos y gastos diarios, marcando qué facturaste y qué no, con el medio de cobro de cada venta (efectivo, transferencia, QR, débito, crédito)',
      'Monotributo: en qué categoría estás, en cuál vas a quedar en la próxima recategorización y cuánto te sale la cuota',
      'Posición de Ingresos Brutos mes a mes, con alícuota y retenciones editables a mano',
      'Clientes y proveedores, con el total y la cantidad de operaciones de cada uno',
      'Cuentas bancarias y deudas',
      'Indicadores clave (margen, runway, punto de equilibrio, endeudamiento)',
      'Composición de gastos y flujo de caja proyectado',
      'Cobranzas y pagos semanales, con importación desde Excel',
      'Informe financiero con gráficos, listo para imprimir o guardar como PDF',
    ],
  },
  {
    key: 'premium',
    nombre: 'Medio',
    precio: 50000,
    descripcion: 'Todo lo del plan Básico, más herramientas de CFO para anticiparte a los problemas financieros.',
    features: [
      'Todo lo incluido en el plan Básico',
      'Presupuesto vs. Real, con desvío por categoría y comentarios automáticos',
      'Proyección de caja con tasa de crecimiento y escenarios optimista/pesimista',
      'Alertas automáticas y recomendaciones accionables sobre qué hacer',
      'Comprobantes: cargá cada factura emitida y recibida, con ventas/compras netas, margen e IVA discriminado — y con eso Clientes, Proveedores y Monotributo dejan de depender de la carga diaria',
      'Importación de "Mis Comprobantes" de ARCA desde Excel, y exportación del libro para tu contador',
      'Posición de IVA mes a mes, con alícuota y retenciones editables a mano',
      'DSO/DPO y antigüedad de cuentas por cobrar y pagar',
      'Patrimonio y bienes realizables, con el runway extendido ante un quiebre de caja',
    ],
  },
  {
    key: 'full',
    nombre: 'Full',
    precio: 100000,
    descripcion:
      'Todo lo del plan Medio, más un sistema de gestión para usar todos los días: cuentas corrientes, remitos/presupuestos y cheques. Cuanto más lo usás, mejor quedan tus indicadores de CFO.',
    features: [
      'Todo lo incluido en el plan Medio',
      'Cuentas corrientes por cliente y proveedor, con pagos parciales imputados automáticamente (FIFO)',
      'Remitos y presupuestos con anticipos, para trabajos largos que se facturan al terminar',
      'Gestión de cheques vinculados a tus facturas y cuentas corrientes, para tu balance contable',
      'Todo se integra solo: un cheque o un anticipo cargado hoy ya actualiza tus indicadores de CFO',
    ],
  },
]

interface Props {
  /** "prueba" si lo que venció fue la prueba gratis de 15 días; "suscripcion" si tenía una
   * suscripción paga que se pausó o canceló; undefined para un visitante que nunca tuvo plan. */
  motivoVencimiento?: 'prueba' | 'suscripcion'
}

export function PlanesEmpresa({ motivoVencimiento }: Props) {
  const { user } = useAuth()
  const [cargando, setCargando] = useState<PlanTier | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mostrarLogin, setMostrarLogin] = useState(false)
  const [planPendiente, setPlanPendiente] = useState<PlanTier | null>(null)

  // Si el usuario eligió un plan sin estar logueado, en cuanto se loguea retomamos
  // automáticamente la suscripción a ese plan, sin que tenga que volver a tocar el botón.
  useEffect(() => {
    if (user && planPendiente) {
      const plan = planPendiente
      setPlanPendiente(null)
      suscribirse(plan)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function suscribirse(plan: PlanTier) {
    if (!user?.email) {
      setPlanPendiente(plan)
      setMostrarLogin(true)
      return
    }
    setError(null)
    setCargando(plan)
    try {
      // El uid y el email salen del token del lado del servidor — ver api/crear-suscripcion.js.
      const idToken = await user.getIdToken()
      const resp = await fetch('/api/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ plan }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.initPoint) throw new Error(data.error || 'No se pudo iniciar la suscripción.')
      window.location.href = data.initPoint
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
      setCargando(null)
    }
  }

  return (
    <>
      <div className="mb-8 text-center">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          <Calculator size={14} aria-hidden="true" /> FinCorp para empresas
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          {motivoVencimiento === 'prueba'
            ? 'Tu prueba gratis terminó'
            : motivoVencimiento === 'suscripcion'
              ? 'Tu suscripción no está activa'
              : 'Elegí tu plan'}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          {motivoVencimiento === 'prueba'
            ? 'Ya usaste tus 15 días de prueba gratis con acceso Full completo. Elegí un plan para seguir usando FinCorp.'
            : motivoVencimiento === 'suscripcion'
              ? 'Reactivala eligiendo un plan para volver a acceder al dashboard financiero de tu negocio.'
              : 'Para acceder al dashboard financiero de tu negocio necesitás una suscripción activa.'}
          {!user && ' Al elegir un plan te vamos a pedir crear una cuenta gratis para completar el pago.'}
        </p>
      </div>

      <div className="mx-auto mb-8 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PLANES.map((p) => (
          <Card key={p.key} padding="lg" destacada={p.key === 'full'} className="flex flex-col">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {p.nombre}
            </h2>
            <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              <span className="tabular">{formatoMoneda(p.precio)}</span>
              <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                {' '}
                /mes
              </span>
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {p.descripcion}
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-good-text)' }} aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <Button onClick={() => suscribirse(p.key)} disabled={cargando !== null} variante="primario" pill className="mt-6">
              {cargando === p.key ? 'Redirigiendo a Mercado Pago…' : `Suscribirme al ${p.nombre}`}
            </Button>
          </Card>
        ))}
      </div>

      {error && (
        <p
          className="mx-auto mb-8 max-w-3xl rounded-lg border p-3 text-center text-sm"
          style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
        >
          {error}
        </p>
      )}

      <p className="mx-auto max-w-xl text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        El pago se procesa de forma segura a través de Mercado Pago. Podés cancelar la suscripción cuando
        quieras desde tu cuenta de Mercado Pago.
      </p>

      {mostrarLogin && (
        <LoginModal
          onCerrar={() => {
            setMostrarLogin(false)
          }}
        />
      )}
    </>
  )
}
