import { useMemo } from 'react'
import { Bar, BarChart, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatoMoneda } from '../lib/finance'
import { proyectarFlujoCaja, proyectarFlujoCajaEscenarios, type FilaProyeccion } from '../lib/cfo'

interface Props {
  saldoInicial: number
  ingresos: number
  usaIngresosReales?: boolean
  gastosTotales: number
  usaGastosReales?: boolean
  meses: number
  onCambiarMeses: (meses: number) => void
  tasaCrecimiento?: number
  onCambiarTasaCrecimiento?: (tasa: number) => void
  esPremium?: boolean
  onQuierePremium?: () => void
}

interface FilaEscenarios {
  mes: number
  pesimista: number
  base: number
  optimista: number
}

function EscenariosTooltip({ active, payload }: { active?: boolean; payload?: { payload: FilaEscenarios }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const fila = payload[0].payload
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <p className="mb-1 font-semibold">Mes {fila.mes}</p>
      <p className="tabular" style={{ color: 'var(--status-critical)' }}>
        Pesimista: {formatoMoneda(fila.pesimista)}
      </p>
      <p className="tabular" style={{ color: 'var(--series-blue)' }}>
        Base: {formatoMoneda(fila.base)}
      </p>
      <p className="tabular" style={{ color: 'var(--status-good-text)' }}>
        Optimista: {formatoMoneda(fila.optimista)}
      </p>
    </div>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: FilaProyeccion }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const fila = payload[0].payload
  const margenNeto = fila.ingresos - fila.gastos
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <p className="mb-1 font-semibold">Mes {fila.mes}</p>
      <p
        className="tabular"
        style={{ color: margenNeto < 0 ? 'var(--status-critical)' : 'var(--status-good-text)' }}
      >
        Flujo neto del mes: {formatoMoneda(margenNeto)}
      </p>
      <p
        className="tabular font-medium"
        style={{ color: fila.saldo < 0 ? 'var(--status-critical)' : 'var(--text-secondary)' }}
      >
        Saldo acumulado: {formatoMoneda(fila.saldo)}
      </p>
    </div>
  )
}

export function FlujoDeCaja({
  saldoInicial,
  ingresos,
  usaIngresosReales = false,
  gastosTotales,
  usaGastosReales = false,
  meses,
  onCambiarMeses,
  tasaCrecimiento = 0,
  onCambiarTasaCrecimiento,
  esPremium = false,
  onQuierePremium,
}: Props) {
  const proyeccion = useMemo(
    () => proyectarFlujoCaja(saldoInicial, ingresos, gastosTotales, meses, esPremium ? tasaCrecimiento : 0),
    [saldoInicial, ingresos, gastosTotales, meses, esPremium, tasaCrecimiento],
  )

  const saldoFinal = proyeccion[proyeccion.length - 1]?.saldo ?? saldoInicial
  const mesQuiebre = proyeccion.find((f) => f.saldo < 0)?.mes ?? null

  const datosEscenarios = useMemo(() => {
    if (!esPremium) return []
    const escenarios = proyectarFlujoCajaEscenarios(saldoInicial, ingresos, gastosTotales, meses, tasaCrecimiento)
    const base = escenarios.find((e) => e.nombre === 'base')!.filas
    const pesimista = escenarios.find((e) => e.nombre === 'pesimista')!.filas
    const optimista = escenarios.find((e) => e.nombre === 'optimista')!.filas
    return base.map((f, i) => ({ mes: f.mes, pesimista: pesimista[i].saldo, base: f.saldo, optimista: optimista[i].saldo }))
  }, [esPremium, saldoInicial, ingresos, gastosTotales, meses, tasaCrecimiento])

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Proyección de flujo de caja
          </h3>
          {(usaIngresosReales || usaGastosReales) && (
            <p className="text-xs" style={{ color: 'var(--series-blue)' }}>
              📊 Usando el promedio real de{' '}
              {usaIngresosReales && usaGastosReales
                ? 'tus ventas y compras cargadas'
                : usaIngresosReales
                  ? 'tus ventas cargadas'
                  : 'tus compras cargadas'}{' '}
              en Comprobantes
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Meses a proyectar
          <input
            type="range"
            min={3}
            max={12}
            step={1}
            value={meses}
            onChange={(e) => onCambiarMeses(Number(e.target.value))}
            className="w-28 accent-current"
            style={{ color: 'var(--series-blue)' }}
          />
          <span className="tabular w-10 text-right font-semibold">{meses} m</span>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {esPremium ? (
          <label className="flex items-center gap-2">
            Crecimiento mensual esperado
            <input
              type="range"
              min={-10}
              max={20}
              step={1}
              value={tasaCrecimiento}
              onChange={(e) => onCambiarTasaCrecimiento?.(Number(e.target.value))}
              className="w-28 accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-12 text-right font-semibold">{tasaCrecimiento}%</span>
          </label>
        ) : (
          <button onClick={onQuierePremium} className="flex items-center gap-1.5" style={{ color: 'var(--series-blue)' }}>
            🔒 Con Premium podés proyectar con una tasa de crecimiento mensual
          </button>
        )}
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
          <Bar dataKey={(fila: FilaProyeccion) => fila.ingresos - fila.gastos} name="Flujo neto del mes" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {proyeccion.map((fila) => (
              <Cell key={fila.mes} fill={fila.ingresos - fila.gastos < 0 ? 'var(--status-critical)' : 'var(--series-blue)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {esPremium && datosEscenarios.length > 0 && (
        <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--gridline)' }}>
          <h4 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Saldo proyectado por escenario
          </h4>
          <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Pesimista: 10% menos de ingresos y 10% más de gastos. Optimista: lo inverso. Ningún CFO presenta una
            proyección con un solo número.
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={datosEscenarios} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
              <Tooltip content={<EscenariosTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="pesimista" name="Pesimista" stroke="var(--status-critical)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="base" name="Base" stroke="var(--series-blue)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="optimista" name="Optimista" stroke="var(--status-good-text)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
