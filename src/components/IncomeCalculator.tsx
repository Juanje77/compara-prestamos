import { useMemo, useState } from 'react'
import type { LoanOffer } from '../data/loans'
import { montoMaximoPorCuota, formatoMoneda } from '../lib/finance'

interface Props {
  ofertasBase: LoanOffer[]
  plazo: number
  ingreso: number
  onCambiarIngreso: (ingreso: number) => void
  onAplicarMonto: (monto: number) => void
}

export function IncomeCalculator({ ofertasBase, plazo, ingreso, onCambiarIngreso, onAplicarMonto }: Props) {
  const [porcentaje, setPorcentaje] = useState(30)

  const cuotaMaxima = ingreso * (porcentaje / 100)

  const resultados = useMemo(() => {
    return ofertasBase
      .map((o) => {
        const montoPorIngreso = montoMaximoPorCuota(cuotaMaxima, o.tna, plazo)
        const montoFinal = Math.min(montoPorIngreso, o.montoMax)
        return { banco: o.id, nombre: o.banco, monto: montoFinal }
      })
      .sort((a, b) => b.monto - a.monto)
  }, [ofertasBase, cuotaMaxima, plazo])

  const montoSugerido = resultados.length > 0 ? Math.min(...resultados.map((r) => r.monto)) : 0

  if (ofertasBase.length === 0) return null

  return (
    <section
      className="mb-8 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        ¿No sabés cuánto pedir? Calculalo según tu ingreso
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Los bancos suelen exigir que la cuota no supere un porcentaje de tu ingreso mensual. Ingresá tu
        ingreso neto y te mostramos el monto máximo estimado por banco al plazo elegido ({plazo} meses).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Ingreso mensual neto
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={200000}
              max={20000000}
              step={50000}
              value={ingreso}
              onChange={(e) => onCambiarIngreso(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-32 shrink-0 text-right font-semibold">{formatoMoneda(ingreso)}</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            % del ingreso destinado a la cuota
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={15}
              max={40}
              step={1}
              value={porcentaje}
              onChange={(e) => setPorcentaje(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-16 shrink-0 text-right font-semibold">{porcentaje}%</span>
          </div>
        </label>
      </div>

      <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Cuota máxima estimada: <span className="tabular font-semibold">{formatoMoneda(cuotaMaxima)}</span> por
        mes.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gridline)' }}>
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Banco</th>
              <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Monto máximo estimado</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.banco} style={{ borderBottom: '1px solid var(--gridline)' }}>
                <td className="px-3 py-2">{r.nombre}</td>
                <td className="tabular px-3 py-2 font-medium">{formatoMoneda(r.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onAplicarMonto(Math.max(100000, Math.round(montoSugerido / 10000) * 10000))}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--series-blue)' }}
        >
          Usar {formatoMoneda(montoSugerido)} en la comparación
        </button>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Es el monto más conservador: el que aprobarían todos los bancos de la lista con tu ingreso.
        </p>
      </div>
    </section>
  )
}
