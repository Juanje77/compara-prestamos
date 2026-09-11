import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { formatoMoneda } from '../lib/finance'
import type { PlanTier } from '../lib/plan'

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
    descripcion: 'Todo lo que necesitás para gestionar las finanzas de tu negocio.',
    features: [
      'Cuentas bancarias y deudas',
      'Indicadores clave (margen, runway, punto de equilibrio, endeudamiento)',
      'Composición de gastos y flujo de caja proyectado',
      'Cobranzas y pagos semanales, con importación desde Excel',
      'Exportación a PDF',
    ],
  },
  {
    key: 'premium',
    nombre: 'Premium',
    precio: 50000,
    descripcion: 'Todo lo del plan Básico, más funciones avanzadas a medida que las vayamos sumando.',
    features: [
      'Todo lo incluido en el plan Básico',
      'Prioridad en nuevas funciones del dashboard',
      'Asesoramiento prioritario por WhatsApp',
    ],
  },
]

export function PlanesEmpresa() {
  const { user } = useAuth()
  const [cargando, setCargando] = useState<PlanTier | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function suscribirse(plan: PlanTier) {
    if (!user?.email) return
    setError(null)
    setCargando(plan)
    try {
      const resp = await fetch('/api/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email, plan }),
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
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🧮 FinCorp para empresas
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          Elegí tu plan
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Para acceder al dashboard financiero de tu negocio necesitás una suscripción activa.
        </p>
      </div>

      <div className="mx-auto mb-8 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        {PLANES.map((p) => (
          <div
            key={p.key}
            className="flex flex-col rounded-xl border p-6"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
          >
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
                  <span style={{ color: 'var(--status-good-text)' }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => suscribirse(p.key)}
              disabled={cargando !== null}
              className="mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--series-blue)' }}
            >
              {cargando === p.key ? 'Redirigiendo a Mercado Pago…' : `Suscribirme al ${p.nombre}`}
            </button>
          </div>
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
    </>
  )
}
