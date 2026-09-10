import { useMemo, useState } from 'react'
import { FUENTES, TODOS_LOS_PRESTAMOS, type CondicionLaboral, type TipoPrestamo } from './data/loans'
import { calcularOferta, rankearPorCFT } from './lib/finance'
import { formatoMoneda } from './lib/finance'
import { obtenerHistorial, guardarSimulacion, eliminarSimulacion } from './lib/history'
import { RankingChart } from './components/RankingChart'
import { LoanTable } from './components/LoanTable'
import { BestOfferCard } from './components/BestOfferCard'
import { BrandHeader } from './components/BrandHeader'
import { FinkoLogo } from './components/FinkoLogo'
import { WhatsAppBanner, WhatsAppFloatingButton } from './components/WhatsAppContact'
import { CompareView } from './components/CompareView'
import { HistoryPanel } from './components/HistoryPanel'
import { SituacionCrediticia } from './components/SituacionCrediticia'
import { AmortizationModal } from './components/AmortizationModal'
import { IncomeCalculator } from './components/IncomeCalculator'
import { Glosario } from './components/Glosario'
import { VeredictoCredito } from './components/VeredictoCredito'

const CONDICIONES: { key: CondicionLaboral | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'empleado', label: 'Empleado en relación de dependencia' },
  { key: 'monotributista', label: 'Monotributista / Autónomo' },
]

interface TabConfig {
  key: TipoPrestamo
  label: string
  montoDefault: number
  montoMin: number
  montoMax: number
  montoStep: number
  plazoDefault: number
  plazoMin: number
  plazoMax: number
  plazoStep: number
}

const TABS: TabConfig[] = [
  {
    key: 'personal',
    label: 'Préstamos personales',
    montoDefault: 5000000,
    montoMin: 100000,
    montoMax: 40000000,
    montoStep: 100000,
    plazoDefault: 24,
    plazoMin: 6,
    plazoMax: 60,
    plazoStep: 6,
  },
  {
    key: 'prendario',
    label: 'Préstamos prendarios (autos)',
    montoDefault: 15000000,
    montoMin: 500000,
    montoMax: 60000000,
    montoStep: 100000,
    plazoDefault: 48,
    plazoMin: 6,
    plazoMax: 60,
    plazoStep: 6,
  },
  {
    key: 'hipotecario',
    label: 'Créditos hipotecarios (UVA)',
    montoDefault: 60000000,
    montoMin: 5000000,
    montoMax: 200000000,
    montoStep: 1000000,
    plazoDefault: 240,
    plazoMin: 60,
    plazoMax: 360,
    plazoStep: 12,
  },
  {
    key: 'jubilados',
    label: 'Jubilados / ANSES',
    montoDefault: 2000000,
    montoMin: 100000,
    montoMax: 50000000,
    montoStep: 100000,
    plazoDefault: 24,
    plazoMin: 6,
    plazoMax: 72,
    plazoStep: 6,
  },
]

function App() {
  const [tipo, setTipo] = useState<TipoPrestamo>('personal')
  const tabConfig = TABS.find((t) => t.key === tipo)!

  const [monto, setMonto] = useState(tabConfig.montoDefault)
  const [plazo, setPlazo] = useState(tabConfig.plazoDefault)
  const [condicionLaboral, setCondicionLaboral] = useState<CondicionLaboral | 'todos'>('todos')
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [historial, setHistorial] = useState(() => obtenerHistorial())
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [verCuotasId, setVerCuotasId] = useState<string | null>(null)
  const [ingreso, setIngreso] = useState(1000000)

  function cambiarTab(next: TipoPrestamo) {
    const cfg = TABS.find((t) => t.key === next)!
    setTipo(next)
    setMonto(cfg.montoDefault)
    setPlazo(cfg.plazoDefault)
    setSeleccionados([])
  }

  const ofertasBase = useMemo(
    () =>
      TODOS_LOS_PRESTAMOS[tipo].filter(
        (o) => condicionLaboral === 'todos' || !o.segmentos || o.segmentos.includes(condicionLaboral),
      ),
    [tipo, condicionLaboral],
  )

  const ofertas = useMemo(() => {
    const calculadas = ofertasBase.map((o) => calcularOferta(o, monto, plazo))
    return rankearPorCFT(calculadas)
  }, [ofertasBase, monto, plazo])

  const mejor = ofertas[0]
  const ofertasSeleccionadas = ofertas.filter((o) => seleccionados.includes(o.id))

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  function handleGuardarSimulacion() {
    guardarSimulacion(tipo, monto, plazo, ofertas)
    setHistorial(obtenerHistorial())
    setGuardadoOk(true)
    setTimeout(() => setGuardadoOk(false), 2500)
  }

  function handleEliminarSimulacion(id: string) {
    eliminarSimulacion(id)
    setHistorial(obtenerHistorial())
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <FinkoLogo />
        <p className="mt-1 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🇦🇷 Comparador de préstamos argentinos
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          ¿Qué banco tiene el préstamo más conveniente?
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Compará tasas y costos de las principales líneas de crédito de bancos argentinos y encontrá
          la opción con menor Costo Financiero Total (CFT) — el indicador que de verdad refleja lo que vas a pagar.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tipo === t.key}
            onClick={() => cambiarTab(t.key)}
            className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            style={
              tipo === t.key
                ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section
        className="mb-6 grid grid-cols-1 gap-4 rounded-xl border p-5 sm:grid-cols-2"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Monto a solicitar
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={tabConfig.montoMin}
              max={tabConfig.montoMax}
              step={tabConfig.montoStep}
              value={monto}
              onChange={(e) => setMonto(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-36 shrink-0 text-right font-semibold">{formatoMoneda(monto)}</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Plazo (meses)
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={tabConfig.plazoMin}
              max={tabConfig.plazoMax}
              step={tabConfig.plazoStep}
              value={plazo}
              onChange={(e) => setPlazo(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-20 shrink-0 text-right font-semibold">{plazo} m</span>
          </div>
        </label>

        {tipo === 'personal' && (
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Condición laboral
            </span>
            <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              No todos los bancos ofrecen la misma tasa a empleados en relación de dependencia que a
              monotributistas/autónomos — filtrá para ver solo lo que aplica a tu caso.
            </p>
            <div className="flex flex-wrap gap-2">
              {CONDICIONES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCondicionLaboral(c.key)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={
                    condicionLaboral === c.key
                      ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </label>
        )}
      </section>

      {mejor && (
        <section className="mb-4">
          <BestOfferCard oferta={mejor} tipo={tipo} />
        </section>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          onClick={handleGuardarSimulacion}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--series-blue)' }}
        >
          💾 Guardar simulación
        </button>
        {guardadoOk && (
          <span className="text-sm font-medium" style={{ color: 'var(--status-good-text)' }}>
            ✓ Guardada en tu historial
          </span>
        )}
        {seleccionados.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {seleccionados.length} seleccionada(s) para comparar — marcá el check en la tabla de abajo.
          </span>
        )}
      </div>

      {tipo !== 'hipotecario' && (
        <IncomeCalculator
          ofertasBase={ofertasBase}
          plazo={plazo}
          ingreso={ingreso}
          onCambiarIngreso={setIngreso}
          onAplicarMonto={setMonto}
        />
      )}

      {mejor && (
        <VeredictoCredito oferta={mejor} ofertasComparables={ofertas} monto={monto} tipo={tipo} ingreso={ingreso} />
      )}

      <WhatsAppBanner />

      <SituacionCrediticia />

      <CompareView
        ofertas={ofertasSeleccionadas}
        tipo={tipo}
        onQuitar={toggleSeleccion}
        onCerrar={() => setSeleccionados([])}
      />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Ranking por Costo Financiero Total (CFT anual)
        </h2>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <RankingChart ofertas={ofertas} />
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Detalle de todas las ofertas
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Marcá el check para comparar hasta 3 ofertas lado a lado
          </p>
        </div>
        <LoanTable
          ofertas={ofertas}
          tipo={tipo}
          seleccionados={seleccionados}
          onToggleSeleccion={toggleSeleccion}
          onVerCuotas={setVerCuotasId}
        />
      </section>

      <HistoryPanel historial={historial} onEliminar={handleEliminarSimulacion} />

      <Glosario />

      <footer className="border-t pt-6 pb-10 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <p className="mb-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Sobre estos datos
        </p>
        <p className="mb-2 max-w-3xl">
          Las tasas mostradas son de referencia, relevadas de fuentes públicas y prensa especializada en
          agosto de 2026. Las ofertas marcadas como <em>(estimado)</em> están calculadas dentro del rango de
          mercado vigente pero no fueron confirmadas contra el sitio oficial del banco. Las tasas reales
          dependen de tu perfil crediticio, relación con el banco y cambian frecuentemente — verificá siempre
          la tasa vigente antes de decidir. El cálculo de cuota usa el sistema francés de amortización; los
          créditos hipotecarios UVA ajustan el capital por inflación mes a mes, por lo que la cuota informada
          es solo la inicial.
        </p>
        <p className="mb-2 max-w-3xl">
          Tu historial de simulaciones se guarda únicamente en este navegador (no se envía a ningún servidor).
          La consulta de situación crediticia se hace directo contra la Central de Deudores del BCRA — no
          almacenamos tu CUIT/CUIL ni el resultado en ningún lado.
        </p>
        <p className="mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Fuentes
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {FUENTES.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noreferrer" className="hover:underline">
                {f.titulo}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-3 text-center text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
            Creado por
          </p>
          <div className="flex justify-center">
            <BrandHeader />
          </div>
        </div>
      </footer>

      <WhatsAppFloatingButton />

      {verCuotasId &&
        (() => {
          const oferta = ofertas.find((o) => o.id === verCuotasId)
          if (!oferta) return null
          return (
            <AmortizationModal oferta={oferta} monto={monto} plazo={plazo} onCerrar={() => setVerCuotasId(null)} />
          )
        })()}
    </div>
  )
}

export default App
