import { Lightbulb } from 'lucide-react'
import type { Recomendacion } from '../lib/cfo'

interface Props {
  recomendaciones: Recomendacion[]
}

/** El cierre de "qué hacer" que un CFO siempre agrega después del diagnóstico (ver AlertasPanel) —
 * no alcanza con decir qué pasó, hay que decir qué hacer al respecto. */
export function Recomendaciones({ recomendaciones }: Props) {
  if (recomendaciones.length === 0) return null

  return (
    <section className="mb-6 rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-3 inline-flex items-center gap-1.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        <Lightbulb size={16} aria-hidden="true" /> Qué hacer
      </h2>
      <ul className="space-y-2">
        {recomendaciones.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <span
              className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                background: r.prioridad === 'alta' ? 'var(--status-critical)' : 'var(--status-warning)',
                color: 'white',
              }}
            >
              {r.prioridad}
            </span>
            <span>{r.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
