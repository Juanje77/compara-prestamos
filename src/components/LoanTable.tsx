import { useState } from 'react'
import type { OfertaCalculada } from '../lib/finance'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import type { TipoPrestamo } from '../data/loans'

type Columna = 'cft' | 'tna' | 'cuotaMensual' | 'costoTotal' | 'banco'

interface Props {
  ofertas: OfertaCalculada[]
  tipo: TipoPrestamo
  seleccionados?: string[]
  onToggleSeleccion?: (id: string) => void
  maxSeleccion?: number
  onVerCuotas?: (id: string) => void
}

const HEADERS: { key: Columna; label: string }[] = [
  { key: 'banco', label: 'Banco' },
  { key: 'tna', label: 'TNA' },
  { key: 'cft', label: 'CFT' },
  { key: 'cuotaMensual', label: 'Cuota mensual' },
  { key: 'costoTotal', label: 'Costo total' },
]

export function LoanTable({
  ofertas,
  tipo,
  seleccionados = [],
  onToggleSeleccion,
  maxSeleccion = 3,
  onVerCuotas,
}: Props) {
  const [orden, setOrden] = useState<Columna>('cft')
  const [asc, setAsc] = useState(true)

  const cuotaLabel = tipo === 'hipotecario' ? 'Cuota inicial (aprox.)' : 'Cuota mensual'

  function toggleOrden(col: Columna) {
    if (col === orden) {
      setAsc(!asc)
    } else {
      setOrden(col)
      setAsc(true)
    }
  }

  const data = [...ofertas].sort((a, b) => {
    const dir = asc ? 1 : -1
    if (orden === 'banco') return a.banco.localeCompare(b.banco) * dir
    return (a[orden] - b[orden]) * dir
  })

  const mejorId = [...ofertas].sort((a, b) => a.cft - b.cft)[0]?.id

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--gridline)' }}>
            {onToggleSeleccion && <th className="w-10 px-4 py-3" aria-label="Comparar" />}
            {HEADERS.map((h) => (
              <th
                key={h.key}
                onClick={() => toggleOrden(h.key)}
                className="cursor-pointer select-none px-4 py-3 font-medium whitespace-nowrap"
                style={{ color: 'var(--text-muted)' }}
              >
                {h.label === 'Cuota mensual' ? cuotaLabel : h.label}
                {orden === h.key ? (asc ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
            <th className="px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
              Requisitos
            </th>
            {onVerCuotas && <th className="px-4 py-3" aria-label="Ver cuotas" />}
          </tr>
        </thead>
        <tbody>
          {data.map((o) => (
            <tr
              key={o.id}
              style={{
                borderBottom: '1px solid var(--gridline)',
                background: o.id === mejorId ? 'color-mix(in srgb, var(--status-good) 8%, transparent)' : undefined,
              }}
            >
              {onToggleSeleccion && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(o.id)}
                    disabled={!seleccionados.includes(o.id) && seleccionados.length >= maxSeleccion}
                    onChange={() => onToggleSeleccion(o.id)}
                    aria-label={`Comparar ${o.banco}`}
                    className="h-4 w-4 accent-current"
                    style={{ color: 'var(--series-blue)' }}
                  />
                </td>
              )}
              <td className="px-4 py-3 font-medium whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {o.id === mejorId && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'var(--status-good)', color: 'white' }}
                    >
                      ★ MEJOR
                    </span>
                  )}
                  <a href={o.sitioWeb} target="_blank" rel="noreferrer" className="hover:underline">
                    {o.banco}
                  </a>
                  {!o.verificado && (
                    <span title={o.nota} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      (estimado)
                    </span>
                  )}
                </div>
              </td>
              <td className="tabular px-4 py-3">{formatoPorcentaje(o.tna)}</td>
              <td className="tabular px-4 py-3 font-semibold">{formatoPorcentaje(o.cft)}</td>
              <td className="tabular px-4 py-3">
                {tipo === 'hipotecario' ? '—' : formatoMoneda(o.cuotaMensual)}
                {!o.dentroDeRango && (
                  <span className="ml-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    fuera de rango
                  </span>
                )}
              </td>
              <td className="tabular px-4 py-3">{tipo === 'hipotecario' ? '—' : formatoMoneda(o.costoTotal)}</td>
              <td className="max-w-[280px] px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {o.requisitos}
              </td>
              {onVerCuotas && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => onVerCuotas(o.id)}
                    className="text-xs font-medium hover:underline"
                    style={{ color: 'var(--series-blue)' }}
                  >
                    Ver cuotas
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
