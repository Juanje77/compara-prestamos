import type { ReactNode } from 'react'

interface Props {
  activo: boolean
  titulo: string
  descripcion: string
  onQuieroPremium: () => void
  children: ReactNode
}

export function PremiumLock({ activo, titulo, descripcion, onQuieroPremium, children }: Props) {
  if (activo) return <>{children}</>

  return (
    <div
      className="rounded-xl border p-8 text-center"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
        🔒 Función Premium
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
        Actualizar a Premium
      </button>
    </div>
  )
}
