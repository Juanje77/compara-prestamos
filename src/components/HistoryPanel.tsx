import type { SimulacionGuardada } from '../lib/history'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import { descargarPdfHistorial, descargarPdfSimulacion } from '../lib/pdf'

const NOMBRE_TIPO: Record<SimulacionGuardada['tipo'], string> = {
  personal: 'Personal',
  prendario: 'Prendario',
  hipotecario: 'Hipotecario UVA',
  jubilados: 'Jubilados/ANSES',
}

interface Props {
  historial: SimulacionGuardada[]
  onEliminar: (id: string) => void
}

export function HistoryPanel({ historial, onEliminar }: Props) {
  if (historial.length === 0) {
    return (
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Historial de simulaciones
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no guardaste ninguna simulación. Usá el botón "Guardar simulación" para armar tu historial y
          poder descargarlo en PDF.
        </p>
      </section>
    )
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Historial de simulaciones ({historial.length})
        </h2>
        <button
          onClick={() => descargarPdfHistorial(historial)}
          className="rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
        >
          Descargar todo el historial (PDF)
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gridline)' }}>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Fecha</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Tipo</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Monto</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Plazo</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Mejor opción</th>
              <th className="px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }} />
            </tr>
          </thead>
          <tbody>
            {historial.map((sim) => {
              const mejor = [...sim.ofertas].sort((a, b) => a.cft - b.cft)[0]
              return (
                <tr key={sim.id} style={{ borderBottom: '1px solid var(--gridline)' }}>
                  <td className="tabular px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(sim.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-xs">{NOMBRE_TIPO[sim.tipo]}</td>
                  <td className="tabular px-4 py-3">{formatoMoneda(sim.monto)}</td>
                  <td className="tabular px-4 py-3">{sim.plazo} m</td>
                  <td className="px-4 py-3">
                    {mejor ? (
                      <>
                        <span className="font-medium">{mejor.banco}</span>{' '}
                        <span className="tabular text-xs" style={{ color: 'var(--text-muted)' }}>
                          (CFT {formatoPorcentaje(mejor.cft)})
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => descargarPdfSimulacion(sim)}
                      className="mr-3 text-xs font-medium hover:underline"
                      style={{ color: 'var(--series-blue)' }}
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => onEliminar(sim.id)}
                      aria-label="Eliminar simulación"
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
