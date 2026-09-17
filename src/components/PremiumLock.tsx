import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Card } from './Card'
import { Button } from './Button'

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
    <Card padding="lg" className="text-center">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
        <Lock size={14} aria-hidden="true" /> Función {nombrePlan}
      </p>
      <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {titulo}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
        {descripcion}
      </p>
      <Button onClick={onQuieroPremium} variante="primario" pill className="mt-5">
        Actualizar a {nombrePlan}
      </Button>
    </Card>
  )
}
