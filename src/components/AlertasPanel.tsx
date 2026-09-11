import type { Alerta } from '../lib/cfo'

interface Props {
  alertas: Alerta[]
}

export function AlertasPanel({ alertas }: Props) {
  if (alertas.length === 0) {
    return (
      <div
        className="mb-6 flex items-center gap-2 rounded-lg border p-3 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--status-good-text)' }}
      >
        ✅ No hay alertas activas: tus indicadores están dentro de los rangos esperados.
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-2">
      {alertas.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2 rounded-lg border p-3 text-sm"
          style={{
            borderColor: a.severidad === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)',
            background: 'var(--surface-1)',
            color: a.severidad === 'critical' ? 'var(--status-critical)' : 'var(--text-primary)',
          }}
        >
          <span className="shrink-0">{a.severidad === 'critical' ? '🔴' : '🟡'}</span>
          <span>{a.mensaje}</span>
        </div>
      ))}
    </div>
  )
}
