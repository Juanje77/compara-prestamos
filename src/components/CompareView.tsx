import type { OfertaCalculada } from '../lib/finance'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import type { TipoPrestamo } from '../data/loans'

interface Props {
  ofertas: OfertaCalculada[]
  tipo: TipoPrestamo
  onQuitar: (id: string) => void
  onCerrar: () => void
}

interface Fila {
  label: string
  render: (o: OfertaCalculada) => React.ReactNode
  destacar?: 'menor' | 'mayor'
  valor?: (o: OfertaCalculada) => number
}

export function CompareView({ ofertas, tipo, onQuitar, onCerrar }: Props) {
  if (ofertas.length === 0) return null

  const filas: Fila[] = [
    { label: 'TNA', render: (o) => formatoPorcentaje(o.tna), valor: (o) => o.tna, destacar: 'menor' },
    { label: 'CFT anual', render: (o) => formatoPorcentaje(o.cft), valor: (o) => o.cft, destacar: 'menor' },
    ...(tipo !== 'hipotecario'
      ? ([
          {
            label: 'Cuota mensual',
            render: (o: OfertaCalculada) => formatoMoneda(o.cuotaMensual),
            valor: (o: OfertaCalculada) => o.cuotaMensual,
            destacar: 'menor' as const,
          },
          {
            label: 'Costo total',
            render: (o: OfertaCalculada) => formatoMoneda(o.costoTotal),
            valor: (o: OfertaCalculada) => o.costoTotal,
            destacar: 'menor' as const,
          },
          {
            label: 'Interés total',
            render: (o: OfertaCalculada) => formatoMoneda(o.interesTotal),
            valor: (o: OfertaCalculada) => o.interesTotal,
            destacar: 'menor' as const,
          },
        ] satisfies Fila[])
      : []),
    { label: 'Monto máximo', render: (o) => formatoMoneda(o.montoMax) },
    { label: 'Plazo máximo', render: (o) => `${o.plazoMaxMeses} meses` },
    { label: 'Requisitos', render: (o) => o.requisitos },
  ]

  function esMejor(fila: Fila, o: OfertaCalculada) {
    if (!fila.valor || !fila.destacar) return false
    const valores = ofertas.map(fila.valor)
    const objetivo = fila.destacar === 'menor' ? Math.min(...valores) : Math.max(...valores)
    return fila.valor(o) === objetivo
  }

  return (
    <section
      className="mb-8 rounded-xl border p-5"
      style={{ borderColor: 'var(--series-blue)', background: 'var(--surface-1)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Comparando {ofertas.length} {ofertas.length === 1 ? 'oferta' : 'ofertas'}
        </h2>
        <button
          onClick={onCerrar}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          Cerrar comparación
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gridline)' }}>
              <th className="w-40 px-3 py-2" />
              {ofertas.map((o) => (
                <th key={o.id} className="px-3 py-2 align-top">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {o.banco}
                    </span>
                    <button
                      onClick={() => onQuitar(o.id)}
                      aria-label={`Quitar ${o.banco} de la comparación`}
                      className="shrink-0 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.label} style={{ borderBottom: '1px solid var(--gridline)' }}>
                <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                  {fila.label}
                </td>
                {ofertas.map((o) => (
                  <td
                    key={o.id}
                    className="tabular max-w-[220px] px-3 py-2"
                    style={
                      esMejor(fila, o)
                        ? { color: 'var(--status-good-text)', fontWeight: 600 }
                        : { color: 'var(--text-secondary)' }
                    }
                  >
                    {fila.render(o)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
