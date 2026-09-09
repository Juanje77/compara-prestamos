import { useMemo, useState } from 'react'
import { FUENTES, TODOS_LOS_PRESTAMOS, type TipoPrestamo } from './data/loans'
import { calcularOferta, rankearPorCFT } from './lib/finance'
import { formatoMoneda } from './lib/finance'
import { RankingChart } from './components/RankingChart'
import { LoanTable } from './components/LoanTable'
import { BestOfferCard } from './components/BestOfferCard'
import { BrandHeader } from './components/BrandHeader'
import { WhatsAppBanner, WhatsAppFloatingButton } from './components/WhatsAppContact'

const TABS: { key: TipoPrestamo; label: string; montoDefault: number; plazoDefault: number }[] = [
  { key: 'personal', label: 'Préstamos personales', montoDefault: 5000000, plazoDefault: 24 },
  { key: 'prendario', label: 'Préstamos prendarios (autos)', montoDefault: 15000000, plazoDefault: 48 },
  { key: 'hipotecario', label: 'Créditos hipotecarios (UVA)', montoDefault: 60000000, plazoDefault: 240 },
]

function App() {
  const [tipo, setTipo] = useState<TipoPrestamo>('personal')
  const tabConfig = TABS.find((t) => t.key === tipo)!

  const [monto, setMonto] = useState(tabConfig.montoDefault)
  const [plazo, setPlazo] = useState(tabConfig.plazoDefault)

  function cambiarTab(next: TipoPrestamo) {
    const cfg = TABS.find((t) => t.key === next)!
    setTipo(next)
    setMonto(cfg.montoDefault)
    setPlazo(cfg.plazoDefault)
  }

  const ofertas = useMemo(() => {
    const base = TODOS_LOS_PRESTAMOS[tipo]
    const calculadas = base.map((o) => calcularOferta(o, monto, plazo))
    return rankearPorCFT(calculadas)
  }, [tipo, monto, plazo])

  const mejor = ofertas[0]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <BrandHeader />

      <header className="mb-8">
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🇦🇷 Comparador de préstamos
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
              min={tipo === 'hipotecario' ? 5000000 : tipo === 'prendario' ? 500000 : 100000}
              max={tipo === 'hipotecario' ? 200000000 : tipo === 'prendario' ? 60000000 : 40000000}
              step={tipo === 'hipotecario' ? 1000000 : 100000}
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
              min={tipo === 'hipotecario' ? 60 : 6}
              max={tipo === 'hipotecario' ? 360 : 60}
              step={tipo === 'hipotecario' ? 12 : 6}
              value={plazo}
              onChange={(e) => setPlazo(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-20 shrink-0 text-right font-semibold">{plazo} m</span>
          </div>
        </label>
      </section>

      {mejor && (
        <section className="mb-8">
          <BestOfferCard oferta={mejor} tipo={tipo} />
        </section>
      )}

      <WhatsAppBanner />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Ranking por Costo Financiero Total (CFT anual)
        </h2>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <RankingChart ofertas={ofertas} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Detalle de todas las ofertas
        </h2>
        <LoanTable ofertas={ofertas} tipo={tipo} />
      </section>

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
      </footer>

      <WhatsAppFloatingButton />
    </div>
  )
}

export default App
