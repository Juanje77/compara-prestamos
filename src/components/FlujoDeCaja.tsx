import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatoMoneda } from '../lib/finance'

interface FilaProyeccion {
  mes: number
  saldo: number
}

interface Props {
  saldoInicial: number
  ingresos: number
  gastosTotales: number
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: FilaProyeccion }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const fila = payload[0].payload
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <p className="font-semibold">Mes {fila.mes}</p>
      <p style={{ color: fila.saldo < 0 ? 'var(--status-critical)' : 'var(--text-secondary)' }}>
        Saldo proyectado: <span className="tabular font-medium">{formatoMoneda(fila.saldo)}</span>
      </p>
    </div>
  )
}

export function FlujoDeCaja({ saldoInicial, ingresos, gastosTotales }: Props) {
  const [meses, setMeses] = useState(6)

  const flujoNetoMensual = ingresos - gastosTotales

  const proyeccion = useMemo<FilaProyeccion[]>(() => {
    const filas: FilaProyeccion[] = []
    for (let mes = 1; mes <= meses; mes++) {
      filas.push({ mes, saldo: saldoInicial + flujoNetoMensual * mes })
    }
    return filas
  }, [saldoInicial, flujoNetoMensual, meses])

  const saldoFinal = proyeccion[proyeccion.length - 1]?.saldo ?? saldoInicial
  const mesQuiebre = proyeccion.find((f) => f.saldo < 0)?.mes ?? null

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Proyección de flujo de caja
        </h3>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Meses a proyectar
          <input
            type="range"
            min={3}
            max={12}
            step={1}
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            className="w-28 accent-current"
            style={{ color: 'var(--series-blue)' }}
          />
          <span className="tabular w-10 text-right font-semibold">{meses} m</span>
        </label>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Saldo proyectado a {meses} meses
          </p>
          <p
            className="tabular text-lg font-semibold"
            style={{ color: saldoFinal >= 0 ? 'var(--text-primary)' : 'var(--status-critical)' }}
          >
            {formatoMoneda(saldoFinal)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Riesgo de quiebre de caja
          </p>
          <p
            className="text-sm font-semibold"
            style={{ color: mesQuiebre ? 'var(--status-critical)' : 'var(--status-good-text)' }}
          >
            {mesQuiebre ? `Sin caja en el mes ${mesQuiebre}` : 'No se proyecta quiebre'}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={proyeccion} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis
            dataKey="mes"
            tickFormatter={(v) => `M${v}`}
            stroke="var(--axis)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            axisLine={{ stroke: 'var(--gridline)' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatoMoneda(v)}
            stroke="var(--axis)"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--gridline)' }}
            tickLine={false}
            width={90}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--gridline)', opacity: 0.4 }} />
          <Bar dataKey="saldo" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {proyeccion.map((fila) => (
              <Cell key={fila.mes} fill={fila.saldo < 0 ? 'var(--status-critical)' : 'var(--series-blue)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
