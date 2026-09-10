import { useMemo, useState } from 'react'
import { FlujoDeCaja } from '../components/FlujoDeCaja'
import { GastosPorCategoria } from '../components/GastosPorCategoria'
import { KpiCard } from '../components/KpiCard'
import { buildWhatsAppLink } from '../components/WhatsAppContact'
import {
  calcularGastosTotales,
  calcularMargenOperativo,
  calcularPuntoEquilibrio,
  calcularRunwayMeses,
  type CategoriaGasto,
} from '../lib/cfo'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'

interface CategoriaConfig {
  key: string
  label: string
  tipo: CategoriaGasto['tipo']
  color: string
  default: number
}

const CATEGORIAS_CONFIG: CategoriaConfig[] = [
  { key: 'sueldos', label: 'Sueldos y cargas sociales', tipo: 'fijo', color: 'var(--series-blue)', default: 2500000 },
  { key: 'alquiler', label: 'Alquiler y servicios', tipo: 'fijo', color: 'var(--series-2)', default: 900000 },
  { key: 'impuestos', label: 'Impuestos', tipo: 'fijo', color: 'var(--series-3)', default: 600000 },
  { key: 'insumos', label: 'Insumos / mercadería', tipo: 'variable', color: 'var(--series-4)', default: 1500000 },
  { key: 'otros', label: 'Otros gastos variables', tipo: 'variable', color: 'var(--series-5)', default: 500000 },
]

export function EmpresasPage() {
  const [saldoInicial, setSaldoInicial] = useState(2000000)
  const [ingresos, setIngresos] = useState(7000000)
  const [montos, setMontos] = useState<Record<string, number>>(() =>
    Object.fromEntries(CATEGORIAS_CONFIG.map((c) => [c.key, c.default])),
  )

  function cambiarMonto(key: string, monto: number) {
    setMontos((prev) => ({ ...prev, [key]: monto }))
  }

  const categorias: CategoriaGasto[] = CATEGORIAS_CONFIG.map((c) => ({
    key: c.key,
    label: c.label,
    tipo: c.tipo,
    color: c.color,
    monto: montos[c.key] ?? 0,
  }))

  const { fijos: gastosFijos, variables: gastosVariables, total: gastosTotales } = calcularGastosTotales(categorias)

  const margenOperativo = calcularMargenOperativo(ingresos, gastosTotales)
  const runwayMeses = calcularRunwayMeses(saldoInicial, gastosTotales)
  const puntoEquilibrio = useMemo(
    () => calcularPuntoEquilibrio(ingresos, gastosFijos, gastosVariables),
    [ingresos, gastosFijos, gastosVariables],
  )

  const mensajeWhatsApp = `Hola Juan! Armé mi dashboard financiero en Finko (margen operativo: ${formatoPorcentaje(
    margenOperativo,
  )}, runway de caja: ${runwayMeses === Infinity ? 'sin límite' : `${runwayMeses.toFixed(1)} meses`}) y quiero asesoramiento para mi negocio.`

  return (
    <>
      <div className="mb-8">
        <p className="mt-1 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🧮 Finko para empresas
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          Gestioná las finanzas de tu negocio, sin ser financista
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cargá los números estimados de tu negocio una sola vez y armamos tu tablero: indicadores clave,
          composición de gastos y proyección de caja.
        </p>
      </div>

      <section
        className="mb-6 rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Datos de tu negocio
        </h2>
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

          {CATEGORIAS_CONFIG.map((c) => (
            <label className="block" key={c.key}>
              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                {c.label}
                <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                  ({c.tipo})
                </span>
              </span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={20000000}
                  step={50000}
                  value={montos[c.key] ?? 0}
                  onChange={(e) => cambiarMonto(c.key, Number(e.target.value))}
                  className="w-full accent-current"
                  style={{ color: 'var(--series-blue)' }}
                />
                <span className="tabular w-32 shrink-0 text-right font-semibold">
                  {formatoMoneda(montos[c.key] ?? 0)}
                </span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Margen operativo"
          value={formatoPorcentaje(margenOperativo)}
          status={margenOperativo >= 15 ? 'good' : margenOperativo >= 0 ? 'warning' : 'critical'}
          statusLabel={
            margenOperativo >= 15
              ? 'Margen saludable'
              : margenOperativo >= 0
                ? 'Margen ajustado'
                : 'Estás perdiendo plata cada mes'
          }
        />
        <KpiCard
          label="Runway de caja"
          value={runwayMeses === Infinity ? '∞' : `${runwayMeses.toFixed(1)} meses`}
          status={runwayMeses >= 6 ? 'good' : runwayMeses >= 3 ? 'warning' : 'critical'}
          statusLabel="Si el ingreso cayera a cero, así de lejos llega tu caja"
        />
        <KpiCard
          label="Punto de equilibrio"
          value={puntoEquilibrio.alcanzable ? formatoMoneda(puntoEquilibrio.ingresosNecesarios) : 'No alcanzable'}
          status={
            !puntoEquilibrio.alcanzable
              ? 'critical'
              : ingresos >= puntoEquilibrio.ingresosNecesarios
                ? 'good'
                : 'warning'
          }
          statusLabel={
            !puntoEquilibrio.alcanzable
              ? 'Los gastos variables superan tus ingresos'
              : ingresos >= puntoEquilibrio.ingresosNecesarios
                ? 'Ya superaste el punto de equilibrio'
                : `Te faltan ${formatoMoneda(puntoEquilibrio.ingresosNecesarios - ingresos)} en ventas/mes`
          }
        />
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GastosPorCategoria categorias={categorias} />
        <FlujoDeCaja saldoInicial={saldoInicial} ingresos={ingresos} gastosTotales={gastosTotales} />
      </section>

      <section
        className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border p-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            ¿Querés armar esto con tus números reales?
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            A partir de este tablero armamos juntos un plan financiero concreto para tu negocio.
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
      </section>

      <p className="border-t pt-6 pb-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        Estimación simplificada con fines orientativos: asume ingresos y gastos constantes mes a mes, sin
        estacionalidad, y un punto de equilibrio donde los gastos variables escalan linealmente con las ventas.
        No reemplaza un análisis financiero profesional de tu negocio.
      </p>
    </>
  )
}
