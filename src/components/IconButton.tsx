import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

// Reemplaza los botones que eran un emoji suelto (🗑, ✕) — 29 apariciones repartidas en toda la
// app, cada una con su propio tamaño y color a mano. `label` es obligatorio: es lo único que hace
// accesible un botón que no tiene texto.

type Tono = 'muted' | 'peligro'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  tono?: Tono
  size?: number
}

const COLOR: Record<Tono, string> = {
  muted: 'var(--text-muted)',
  peligro: 'var(--status-critical)',
}

export function IconButton({ icon: Icon, label, tono = 'muted', size = 16, className = '', style, ...props }: Props) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40 ${className}`}
      style={{ color: COLOR[tono], ...style }}
      {...props}
    >
      <Icon size={size} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
