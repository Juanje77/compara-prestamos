import type { OfertaCalculada } from '../lib/finance'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import type { TipoPrestamo } from '../data/loans'
import { buildWhatsAppLink } from './WhatsAppContact'

interface Props {
  oferta: OfertaCalculada
  ofertasComparables: OfertaCalculada[]
  monto: number
  tipo: TipoPrestamo
  ingreso: number
}

type Nivel = 'bueno' | 'ajustado' | 'riesgoso'

const NIVEL_INFO: Record<Nivel, { color: string; bg: string; label: string }> = {
  bueno: { color: 'var(--status-good-text)', bg: 'var(--status-good)', label: 'Endeudamiento saludable' },
  ajustado: { color: '#8a6100', bg: '#eda100', label: 'Endeudamiento ajustado' },
  riesgoso: { color: '#a02020', bg: '#d03b3b', label: 'Endeudamiento riesgoso' },
}

export function VeredictoCredito({ oferta, ofertasComparables, monto, tipo, ingreso }: Props) {
  const esHipotecario = tipo === 'hipotecario'
  const ratioCuotaIngreso = ingreso > 0 ? oferta.cuotaMensual / ingreso : 0

  let nivel: Nivel = 'bueno'
  if (ratioCuotaIngreso > 0.35) nivel = 'riesgoso'
  else if (ratioCuotaIngreso > 0.25) nivel = 'ajustado'

  const cftPromedio = ofertasComparables.reduce((s, o) => s + o.cft, 0) / (ofertasComparables.length || 1)
  const diferenciaVsPromedio = cftPromedio > 0 ? ((oferta.cft - cftPromedio) / cftPromedio) * 100 : 0
  const estaPorDebajoDelPromedio = diferenciaVsPromedio < 0

  const mesesParaAhorrar = oferta.cuotaMensual > 0 ? Math.ceil(monto / oferta.cuotaMensual) : 0

  const info = NIVEL_INFO[nivel]

  return (
    <section
      className="mb-8 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        ¿Te conviene tomar este crédito?
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Un vistazo más allá de "cuál banco es más barato": si esta deuda es manejable para tu bolsillo y si
        vale la pena financiar en vez de esperar.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {!esHipotecario && (
          <div className="rounded-lg border p-3" style={{ borderColor: info.bg }}>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: info.bg }} />
              <span className="text-xs font-semibold" style={{ color: info.color }}>
                {info.label}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              La cuota representa el{' '}
              <span className="tabular font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoPorcentaje(ratioCuotaIngreso * 100)}
              </span>{' '}
              de tu ingreso mensual.
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {nivel === 'bueno' && 'Menos del 25% se considera manejable sin apretar el presupuesto.'}
              {nivel === 'ajustado' && 'Entre 25% y 35% empieza a ajustar el mes a mes — revisá otros gastos.'}
              {nivel === 'riesgoso' && 'Más del 35% suele considerarse sobreendeudamiento — hay riesgo de no llegar a fin de mes.'}
            </p>
          </div>
        )}

        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Tasa vs. mercado
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Esta oferta está{' '}
            <span
              className="tabular font-semibold"
              style={{ color: estaPorDebajoDelPromedio ? 'var(--status-good-text)' : '#a02020' }}
            >
              {Math.abs(diferenciaVsPromedio).toFixed(0)}% {estaPorDebajoDelPromedio ? 'por debajo' : 'por encima'}
            </span>{' '}
            del CFT promedio ({formatoPorcentaje(cftPromedio)}) de las opciones comparadas.
          </p>
        </div>

        {!esHipotecario && (
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Financiar vs. ahorrar
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Ahorrando lo mismo que pagarías de cuota ({formatoMoneda(oferta.cuotaMensual)}/mes), juntarías{' '}
              {formatoMoneda(monto)} en aproximadamente{' '}
              <span className="tabular font-semibold" style={{ color: 'var(--text-primary)' }}>
                {mesesParaAhorrar} {mesesParaAhorrar === 1 ? 'mes' : 'meses'}
              </span>
              , sin pagar los {formatoMoneda(oferta.interesTotal)} de interés que suma este crédito.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Esto es una guía orientativa, no un consejo financiero personalizado — tu situación puede tener
        matices que esto no contempla (otras deudas, gastos fijos, urgencia de la compra). Para algo más a
        medida, {' '}
        <a
          href={buildWhatsAppLink()}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
          style={{ color: 'var(--series-blue)' }}
        >
          consultanos por WhatsApp
        </a>
        .
      </p>
    </section>
  )
}
