import { useEffect } from 'react'
import { generarTablaAmortizacion, formatoMoneda } from '../lib/finance'
import type { OfertaCalculada } from '../lib/finance'

interface Props {
  oferta: OfertaCalculada
  monto: number
  plazo: number
  onCerrar: () => void
}

export function AmortizationModal({ oferta, monto, plazo, onCerrar }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCerrar])

  const filas = generarTablaAmortizacion(monto, oferta.tna, plazo)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-2xl rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Tabla de amortización — {oferta.banco}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatoMoneda(monto)} a {plazo} meses · TNA {oferta.tna}%
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {oferta.tipo === 'hipotecario' && (
          <p
            className="mb-3 rounded-lg border p-3 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Este crédito es UVA: la tabla está calculada en valores constantes (sin inflación). En la
            realidad, cada cuota se ajusta mes a mes por la variación de la UVA, así que el monto en pesos
            va a ser mayor a medida que pase el tiempo.
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0" style={{ background: 'var(--surface-1)' }}>
              <tr style={{ borderBottom: '1px solid var(--gridline)' }}>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Cuota</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Interés</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Capital</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.numero} style={{ borderBottom: '1px solid var(--gridline)' }}>
                  <td className="tabular px-3 py-1.5">
                    {f.numero} <span style={{ color: 'var(--text-muted)' }}>({formatoMoneda(f.cuota)})</span>
                  </td>
                  <td className="tabular px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(f.interes)}
                  </td>
                  <td className="tabular px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(f.capital)}
                  </td>
                  <td className="tabular px-3 py-1.5">{formatoMoneda(f.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
