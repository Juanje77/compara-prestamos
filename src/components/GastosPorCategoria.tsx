import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { CategoriaGasto } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  categorias: CategoriaGasto[]
}

function TortaTooltip({ active, payload }: { active?: boolean; payload?: { payload: CategoriaGasto; value: number }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const { label, monto } = payload[0].payload
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <p className="font-semibold">{label}</p>
      <p className="tabular" style={{ color: 'var(--text-secondary)' }}>
        {formatoMoneda(monto)}
      </p>
    </div>
  )
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
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={activas} dataKey="monto" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {activas.map((c) => (
                  <Cell key={c.key} fill={c.color} stroke="var(--surface-1)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<TortaTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <ul className="mt-2 space-y-2">
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
