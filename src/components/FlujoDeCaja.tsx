import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatoMoneda } from '../lib/finance'
import { buildWhatsAppLink } from './WhatsAppContact'

interface FilaProyeccion {
  mes: number
  saldo: number
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
      <p style={{ color: fila.saldo < 0 ? '#a02020' : 'var(--text-secondary)' }}>
        Saldo proyectado: <span className="tabular font-medium">{formatoMoneda(fila.saldo)}</span>
      </p>
    </div>
  )
}

export function FlujoDeCaja() {
  const [saldoInicial, setSaldoInicial] = useState(2000000)
  const [ingresos, setIngresos] = useState(6000000)
  const [egresosFijos, setEgresosFijos] = useState(4000000)
  const [egresosVariables, setEgresosVariables] = useState(1500000)
  const [meses, setMeses] = useState(6)

  const flujoNetoMensual = ingresos - egresosFijos - egresosVariables

  const proyeccion = useMemo<FilaProyeccion[]>(() => {
    const filas: FilaProyeccion[] = []
    for (let mes = 1; mes <= meses; mes++) {
      filas.push({ mes, saldo: saldoInicial + flujoNetoMensual * mes })
    }
    return filas
  }, [saldoInicial, flujoNetoMensual, meses])

  const saldoFinal = proyeccion[proyeccion.length - 1]?.saldo ?? saldoInicial
  const mesQuiebre = proyeccion.find((f) => f.saldo < 0)?.mes ?? null

  const mensajeWhatsApp = `Hola Juan! Armé el flujo de caja estimado de mi negocio en Finko (saldo proyectado a ${meses} meses: ${formatoMoneda(
    saldoFinal,
  )}) y quiero asesoramiento.`

  return (
    <section
      className="mb-8 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        Flujo de caja estimado
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Cargá los números estimados de tu negocio y proyectamos cómo evoluciona tu caja mes a mes. Es un punto
        de partida rápido — para un flujo de caja real, con tus datos concretos, escribinos por WhatsApp.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Saldo de caja actual
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={50000000}
              step={100000}
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-32 shrink-0 text-right font-semibold">{formatoMoneda(saldoInicial)}</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Meses a proyectar
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={3}
              max={12}
              step={1}
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-20 shrink-0 text-right font-semibold">{meses} m</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Ingresos mensuales estimados
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100000000}
              step={100000}
              value={ingresos}
              onChange={(e) => setIngresos(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-32 shrink-0 text-right font-semibold">{formatoMoneda(ingresos)}</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Egresos fijos mensuales
          </span>
          <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Alquiler, sueldos, servicios — lo que pagás sí o sí todos los meses.
          </p>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100000000}
              step={100000}
              value={egresosFijos}
              onChange={(e) => setEgresosFijos(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-32 shrink-0 text-right font-semibold">{formatoMoneda(egresosFijos)}</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Egresos variables mensuales
          </span>
          <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Insumos, comisiones, impuestos variables — lo que cambia según cuánto vendas.
          </p>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100000000}
              step={100000}
              value={egresosVariables}
              onChange={(e) => setEgresosVariables(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-32 shrink-0 text-right font-semibold">{formatoMoneda(egresosVariables)}</span>
          </div>
        </label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Flujo neto mensual
          </p>
          <p
            className="tabular text-lg font-semibold"
            style={{ color: flujoNetoMensual >= 0 ? 'var(--status-good-text)' : '#a02020' }}
          >
            {flujoNetoMensual >= 0 ? '+' : ''}
            {formatoMoneda(flujoNetoMensual)}
          </p>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Saldo proyectado a {meses} meses
          </p>
          <p
            className="tabular text-lg font-semibold"
            style={{ color: saldoFinal >= 0 ? 'var(--text-primary)' : '#a02020' }}
          >
            {formatoMoneda(saldoFinal)}
          </p>
        </div>
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: mesQuiebre ? '#d03b3b' : 'var(--border)' }}
        >
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Riesgo de quiebre de caja
          </p>
          <p className="text-sm font-semibold" style={{ color: mesQuiebre ? '#a02020' : 'var(--status-good-text)' }}>
            {mesQuiebre ? `Te quedás sin caja en el mes ${mesQuiebre}` : 'No se proyecta quiebre de caja'}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <ResponsiveContainer width="100%" height={220}>
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
                <Cell key={fila.mes} fill={fila.saldo < 0 ? '#d03b3b' : 'var(--series-blue)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            ¿Querés armar esto con tus números reales?
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            A partir de tu flujo de caja armamos juntos un plan concreto para tu negocio.
          </p>
        </div>
        <a
          href={buildWhatsAppLink(mensajeWhatsApp)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#25D366' }}
        >
          Pedir asesoría por WhatsApp
        </a>
      </div>

      <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Estimación simplificada: asume ingresos y egresos constantes mes a mes, sin estacionalidad ni
        impuestos específicos de tu actividad. No reemplaza un flujo de caja profesional.
      </p>
    </section>
  )
}
