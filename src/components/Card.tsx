import type { HTMLAttributes, ReactNode } from 'react'

// El contenedor con borde + fondo que se repetía a mano en decenas de pantallas, con paddings
// levemente distintos entre una y otra (p-4 acá, p-5 allá, p-6 más allá) sin que nadie lo hubiera
// decidido así a propósito. Tres tamaños fijos en vez de "cualquier número que haya quedado bien".

type Padding = 'sm' | 'md' | 'lg'

const PADDING: Record<Padding, string> = { sm: 'p-4', md: 'p-5', lg: 'p-6' }

interface Props extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding
  /** Tinte celeste sutil, para destacar una sección (hoy usado a mano en varios lados con
   * color-mix contra var(--series-blue)). */
  destacada?: boolean
  children: ReactNode
}

export function Card({ padding = 'md', destacada = false, className = '', style, children, ...props }: Props) {
  return (
    <div
      className={`rounded-xl border ${PADDING[padding]} ${className}`}
      style={{
        borderColor: destacada ? 'var(--series-blue)' : 'var(--border)',
        background: destacada ? 'color-mix(in srgb, var(--series-blue) 6%, var(--surface-1))' : 'var(--surface-1)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
