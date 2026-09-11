import { useEffect } from 'react'
import { PlanesEmpresa } from './PlanesEmpresa'

interface Props {
  onCerrar: () => void
}

export function PremiumUpgradeModal({ onCerrar }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-3xl rounded-xl border p-6 sm:p-8"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-end">
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
        <PlanesEmpresa />
      </div>
    </div>
  )
}
