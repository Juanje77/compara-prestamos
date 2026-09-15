import type { ReactNode } from 'react'

interface Props {
  activo: boolean
  titulo: string
  descripcion: string
  /** Qué plan hace falta para desbloquear esta sección — "medio" (antes "Premium") para la
   * mayoría, "full" para Cuentas corrientes, Remitos/presupuestos y Cheques. */
  nivelRequerido?: 'medio' | 'full'
  onQuieroPremium: () => void
  children: ReactNode
}

export function PremiumLock({ activo, titulo, descripcion, nivelRequerido = 'medio', onQuieroPremium, children }: Props) {
  if (activo) return <>{children}</>

  const nombrePlan = nivelRequerido === 'full' ? 'Full' : 'Medio'

  return (
    <div
      className="rounded-xl border p-8 text-center"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
        🔒 Función {nombrePlan}
      </p>
      <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {titulo}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
        {descripcion}
      </p>
      <button
        onClick={onQuieroPremium}
        className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--series-blue)' }}
      >
        Actualizar a {nombrePlan}
      </button>
    </div>
  )
}
