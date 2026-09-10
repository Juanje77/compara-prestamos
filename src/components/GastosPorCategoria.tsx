import type { CategoriaGasto } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  categorias: CategoriaGasto[]
}

export function GastosPorCategoria({ categorias }: Props) {
  const activas = categorias.filter((c) => c.monto > 0)
  const total = activas.reduce((s, c) => s + c.monto, 0)

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Composición de gastos
      </h3>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Total mensual: <span className="tabular font-semibold">{formatoMoneda(total)}</span>
      </p>

      {activas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Cargá al menos un gasto para ver la composición.
        </p>
      ) : (
        <>
          <div className="flex h-6 w-full overflow-hidden rounded" style={{ gap: 2, background: 'var(--surface-1)' }}>
            {activas.map((c) => (
              <div
                key={c.key}
                style={{
                  width: `${(c.monto / total) * 100}%`,
                  background: c.color,
                  minWidth: 2,
                }}
                title={`${c.label}: ${formatoMoneda(c.monto)}`}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-2">
            {activas.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </span>
                <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {formatoMoneda(c.monto)}{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    ({((c.monto / total) * 100).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
