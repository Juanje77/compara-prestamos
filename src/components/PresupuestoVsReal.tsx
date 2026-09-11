import type { DesvioCategoria } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  desvios: DesvioCategoria[]
  onCambiarReal: (key: string, monto: number) => void
}

export function PresupuestoVsReal({ desvios, onCambiarReal }: Props) {
  const totalPresupuestado = desvios.reduce((s, d) => s + d.presupuestado, 0)
  const totalReal = desvios.reduce((s, d) => s + d.real, 0)
  const desvioTotalPct = totalPresupuestado > 0 ? ((totalReal - totalPresupuestado) / totalPresupuestado) * 100 : 0

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Presupuesto vs. Real
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Cargá lo que realmente gastaste este mes en cada categoría y comparalo contra lo presupuestado.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
              <th className="pb-2 font-medium">Categoría</th>
              <th className="pb-2 text-right font-medium">Presupuestado</th>
              <th className="pb-2 text-right font-medium">Real</th>
              <th className="pb-2 text-right font-medium">Desvío</th>
            </tr>
          </thead>
          <tbody>
            {desvios.map((d) => (
              <tr key={d.key} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                <td className="py-2" style={{ color: 'var(--text-primary)' }}>
                  {d.label}
                </td>
                <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                  {formatoMoneda(d.presupuestado)}
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    value={d.real}
                    onChange={(e) => onCambiarReal(d.key, Number(e.target.value))}
                    className="tabular w-28 rounded-lg border px-2 py-1 text-right text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                  />
                </td>
                <td
                  className="tabular py-2 text-right font-medium"
                  style={{
                    color:
                      Math.abs(d.desvioPct) < 5
                        ? 'var(--status-good-text)'
                        : Math.abs(d.desvioPct) < 20
                          ? 'var(--status-warning)'
                          : 'var(--status-critical)',
                  }}
                >
                  {d.desvioMonto >= 0 ? '+' : ''}
                  {formatoMoneda(d.desvioMonto)} ({d.desvioPct >= 0 ? '+' : ''}
                  {d.desvioPct.toFixed(0)}%)
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              <td className="py-2" style={{ color: 'var(--text-primary)' }}>
                Total
              </td>
              <td className="tabular py-2 text-right" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(totalPresupuestado)}
              </td>
              <td className="tabular py-2 text-right" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(totalReal)}
              </td>
              <td
                className="tabular py-2 text-right"
                style={{ color: desvioTotalPct <= 5 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
              >
                {desvioTotalPct >= 0 ? '+' : ''}
                {desvioTotalPct.toFixed(0)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
