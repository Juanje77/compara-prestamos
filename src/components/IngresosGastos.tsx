import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { MedioCobro, MovimientoDiario, TipoMovimientoDiario } from '../lib/cfo'
import { MEDIOS_COBRO_LABEL, calcularResumenMovimientosDiarios, calcularTotalesPorMedioCobro } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'

interface Props {
  movimientos: MovimientoDiario[]
  onAgregar: (movimiento: Omit<MovimientoDiario, 'id'>) => void
  onEliminar: (id: string) => void
}

const COLORES_MEDIO: Record<MedioCobro, string> = {
  efectivo: 'var(--series-6)',
  transferencia: 'var(--series-blue)',
  qr: 'var(--series-4)',
  debito: 'var(--series-3)',
  credito: 'var(--series-2)',
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function RankingTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <p className="font-semibold">{payload[0].name}</p>
      <p className="tabular" style={{ color: 'var(--text-secondary)' }}>
        {formatoMoneda(payload[0].value)}
      </p>
    </div>
  )
}

export function IngresosGastos({ movimientos, onAgregar, onEliminar }: Props) {
  const [tipo, setTipo] = useState<TipoMovimientoDiario>('ingreso')
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState(0)
  const [fecha, setFecha] = useState(hoyISO)
  const [medioCobro, setMedioCobro] = useState<MedioCobro>('efectivo')
  const [filtro, setFiltro] = useState<'todos' | TipoMovimientoDiario>('todos')

  const resumen = useMemo(() => calcularResumenMovimientosDiarios(movimientos), [movimientos])
  const totalesPorMedio = useMemo(() => calcularTotalesPorMedioCobro(movimientos), [movimientos])

  const listado = movimientos
    .filter((m) => filtro === 'todos' || m.tipo === filtro)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!concepto.trim() || !monto || monto <= 0 || !fecha) return
    onAgregar({
      tipo,
      concepto: concepto.trim(),
      monto,
      fecha,
      medioCobro: tipo === 'ingreso' ? medioCobro : undefined,
    })
    setConcepto('')
    setMonto(0)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Ingresos y gastos
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cargá cada venta o gasto del día a día, sin necesidad de facturar — ideal si sos monotributista. En
          cada venta anotá con qué te cobraron, para saber cuánto entra en efectivo y cuánto de forma digital.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimientoDiario)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="ingreso">Ingreso (venta)</option>
            <option value="gasto">Gasto</option>
          </select>
          <input
            type="text"
            placeholder="Concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="min-w-[140px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <InputMoneda
            placeholder="Monto"
            value={monto}
            onChange={setMonto}
            className="tabular w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          {tipo === 'ingreso' && (
            <select
              value={medioCobro}
              onChange={(e) => setMedioCobro(e.target.value as MedioCobro)}
              title="Con qué te cobraron"
              className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            >
              {(Object.keys(MEDIOS_COBRO_LABEL) as MedioCobro[]).map((medio) => (
                <option key={medio} value={medio}>
                  {MEDIOS_COBRO_LABEL[medio]}
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--series-blue)' }}
          >
            Agregar
          </button>
        </form>
      </section>

      {movimientos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ningún ingreso ni gasto.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total ingresos
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(resumen.totalIngresos)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total gastos
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(resumen.totalGastos)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Saldo del período
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: resumen.saldo >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
              >
                {formatoMoneda(resumen.saldo)}
              </p>
            </div>
          </section>

          {totalesPorMedio.length > 0 && (
            <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Ingresos por medio de cobro
              </h3>
              <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={totalesPorMedio}
                      dataKey="monto"
                      nameKey="medio"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={2}
                    >
                      {totalesPorMedio.map((t) => (
                        <Cell key={t.medio} fill={COLORES_MEDIO[t.medio]} stroke="var(--surface-1)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<RankingTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-2">
                  {totalesPorMedio.map((t) => (
                    <li key={t.medio} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORES_MEDIO[t.medio] }} />
                      <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                        {MEDIOS_COBRO_LABEL[t.medio]}
                      </span>
                      <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatoMoneda(t.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Movimientos cargados
              </h3>
              <div className="flex gap-2">
                {(['todos', 'ingreso', 'gasto'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className="rounded-full border px-3 py-1 text-xs font-medium"
                    style={
                      filtro === f
                        ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                        : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                    }
                  >
                    {f === 'todos' ? 'Todos' : f === 'ingreso' ? 'Ingresos' : 'Gastos'}
                  </button>
                ))}
              </div>
            </div>

            <ul className="max-h-96 space-y-1.5 overflow-y-auto">
              {listado.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
                  >
                    {m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                  </span>
                  <span className="min-w-[100px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {m.concepto}
                  </span>
                  <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR')}
                  </span>
                  {m.medioCobro && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      {MEDIOS_COBRO_LABEL[m.medioCobro]}
                    </span>
                  )}
                  <span
                    className="tabular shrink-0 font-medium"
                    style={{ color: m.tipo === 'gasto' ? 'var(--status-critical)' : 'var(--text-primary)' }}
                  >
                    {m.tipo === 'gasto' ? '-' : ''}
                    {formatoMoneda(m.monto)}
                  </span>
                  <button
                    onClick={() => onEliminar(m.id)}
                    aria-label="Eliminar movimiento"
                    className="shrink-0 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
