import type { OfertaCalculada } from '../lib/finance'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import type { TipoPrestamo } from '../data/loans'

interface Props {
  oferta: OfertaCalculada
  tipo: TipoPrestamo
}

export function BestOfferCard({ oferta, tipo }: Props) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: 'var(--status-good)',
        background: 'color-mix(in srgb, var(--status-good) 6%, var(--surface-1))',
      }}
    >
      <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--status-good-text)' }}>
        ★ Opción más conveniente
      </p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {oferta.banco}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            CFT anual
          </p>
          <p className="tabular text-lg font-semibold">{formatoPorcentaje(oferta.cft)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            TNA
          </p>
          <p className="tabular text-lg font-semibold">{formatoPorcentaje(oferta.tna)}</p>
        </div>
        {tipo !== 'hipotecario' && (
          <>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Cuota mensual
              </p>
              <p className="tabular text-lg font-semibold">{formatoMoneda(oferta.cuotaMensual)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Costo total
              </p>
              <p className="tabular text-lg font-semibold">{formatoMoneda(oferta.costoTotal)}</p>
            </div>
          </>
        )}
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {oferta.requisitos}
      </p>
    </div>
  )
}
