import { useMemo } from 'react'
import { generarComentariosDesvio, type DesvioCategoria, type DesvioVentas } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'

interface Props {
  desvios: DesvioCategoria[]
  ventas: DesvioVentas
  mes: string
  onCambiarMes: (mes: string) => void
  onCambiarReal: (key: string, monto: number) => void
  onCambiarVentas: (monto: number) => void
}

function etiquetaMes(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, 1)
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function PresupuestoVsReal({ desvios, ventas, mes, onCambiarMes, onCambiarReal, onCambiarVentas }: Props) {
  const totalPresupuestado = desvios.reduce((s, d) => s + d.presupuestado, 0)
  const totalReal = desvios.reduce((s, d) => s + d.real, 0)
  const desvioTotalPct = totalPresupuestado > 0 ? ((totalReal - totalPresupuestado) / totalPresupuestado) * 100 : 0
  const comentarios = useMemo(() => generarComentariosDesvio(desvios), [desvios])

  function sumarMeses(delta: number) {
    const [anio, m] = mes.split('-').map(Number)
    const fecha = new Date(anio, m - 1 + delta, 1)
    onCambiarMes(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Presupuesto vs. Real
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => sumarMeses(-1)}
            aria-label="Mes anterior"
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            ←
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {etiquetaMes(mes)}
          </span>
          <button
            onClick={() => sumarMeses(1)}
            aria-label="Mes siguiente"
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            →
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Ventas y gastos de ese mes se completan solos con tus facturas (🧾 auto). Podés pisarlos a mano si hace
        falta.
      </p>

      <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        <p className="mb-2 text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
          Ventas del mes
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Presupuestado
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatoMoneda(ventas.presupuestado)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Real
            </p>
            <div className="flex items-center gap-1.5">
              {ventas.esAutomatico && (
                <span className="shrink-0 text-xs" title="Completado automáticamente desde tus facturas emitidas">
                  🧾 auto
                </span>
              )}
              <InputMoneda
                value={ventas.real}
                onChange={onCambiarVentas}
                className="tabular w-32 rounded-lg border px-2 py-1 text-sm font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Desvío
            </p>
            <p
              className="tabular text-lg font-semibold"
              style={{
                color:
                  ventas.desvioMonto >= 0
                    ? 'var(--status-good-text)'
                    : Math.abs(ventas.desvioPct) < 15
                      ? 'var(--status-warning)'
                      : 'var(--status-critical)',
              }}
            >
              {ventas.desvioMonto >= 0 ? '+' : ''}
              {formatoMoneda(ventas.desvioMonto)} ({ventas.desvioPct >= 0 ? '+' : ''}
              {ventas.desvioPct.toFixed(0)}%)
            </p>
          </div>
        </div>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {ventas.desvioMonto >= 0
            ? 'Facturaste más de lo presupuestado — buena señal.'
            : 'Facturaste menos de lo presupuestado.'}
        </p>
      </div>

      <p className="mb-2 text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
        Gastos por categoría
      </p>

      {comentarios.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {comentarios.map((c) => (
            <li
              key={c.categoria}
              className="flex items-start gap-2 rounded-lg border p-2.5 text-xs"
              style={{
                borderColor: c.direccion === 'exceso' ? 'var(--status-warning)' : 'var(--status-good-text)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="shrink-0">{c.direccion === 'exceso' ? '📈' : '📉'}</span>
              <span>
                <strong>{c.categoria}:</strong> gastaste {formatoMoneda(Math.abs(c.desvioMonto))}{' '}
                {c.direccion === 'exceso' ? 'más' : 'menos'} de lo presupuestado ({Math.abs(c.desvioPct).toFixed(0)}%).
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
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
                  <div className="flex items-center justify-end gap-1.5">
                    {d.esAutomatico && (
                      <span className="shrink-0 text-xs" title="Completado automáticamente desde tus facturas clasificadas">
                        🧾 auto
                      </span>
                    )}
                    <InputMoneda
                      value={d.real}
                      onChange={(v) => onCambiarReal(d.key, v)}
                      className="tabular w-28 rounded-lg border px-2 py-1 text-right text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                    />
                  </div>
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
