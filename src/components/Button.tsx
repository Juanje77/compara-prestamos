import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Los tres estilos de botón que ya existían, repetidos a mano en cada pantalla — acá quedan en un
// solo lugar. `pill` son los CTA grandes (redondeados del todo); sin `pill` son los botones de
// acción dentro de un panel (más chicos, esquinas menos redondeadas). Ver también IconButton, para
// los botones que son solo un ícono.

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  /** Redondeado del todo (los CTA de "Empezar prueba gratis", "Actualizar a Full"). Por defecto
   * son los botones de acción más chicos que aparecen dentro de un panel. */
  pill?: boolean
  icono?: ReactNode
  children?: ReactNode
}

const BASE = 'inline-flex shrink-0 items-center justify-center gap-1.5 font-medium transition-opacity disabled:opacity-60 disabled:cursor-not-allowed'

function estilo(variante: Variante, pill: boolean): React.CSSProperties {
  switch (variante) {
    case 'primario':
      return { background: 'var(--series-blue)', color: '#fff' }
    case 'peligro':
      return { background: 'var(--status-critical)', color: '#fff' }
    case 'fantasma':
      return { color: 'var(--text-secondary)' }
    case 'secundario':
    default:
      return pill
        ? { borderColor: 'var(--series-blue)', color: 'var(--series-blue)', borderWidth: 1 }
        : { borderColor: 'var(--border)', color: 'var(--text-secondary)', borderWidth: 1, background: 'var(--surface-1)' }
  }
}

export function Button({ variante = 'secundario', pill = false, icono, children, className = '', style, ...props }: Props) {
  const forma = pill ? 'rounded-full px-5 py-2.5 text-sm font-semibold' : 'rounded-lg px-3 py-1.5 text-sm'
  const hover = variante !== 'fantasma' ? 'hover:opacity-90' : ''

  return (
    <button className={`${BASE} ${forma} ${hover} ${className}`} style={{ ...estilo(variante, pill), ...style }} {...props}>
      {icono}
      {children}
    </button>
  )
}
