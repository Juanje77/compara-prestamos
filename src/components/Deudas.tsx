import { useState } from 'react'
import type { Deuda } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  deudas: Deuda[]
  onAgregar: (concepto: string, montoAdeudado: number, cuotaMensual: number) => void
  onEliminar: (id: string) => void
}

export function Deudas({ deudas, onAgregar, onEliminar }: Props) {
  const [concepto, setConcepto] = useState('')
  const [montoAdeudado, setMontoAdeudado] = useState('')
  const [cuotaMensual, setCuotaMensual] = useState('')

  const totalAdeudado = deudas.reduce((s, d) => s + d.montoAdeudado, 0)
  const totalCuota = deudas.reduce((s, d) => s + d.cuotaMensual, 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const monto = Number(montoAdeudado)
    const cuota = Number(cuotaMensual || 0)
    if (!concepto.trim() || !monto || monto <= 0) return
    onAgregar(concepto.trim(), monto, cuota)
    setConcepto('')
    setMontoAdeudado('')
    setCuotaMensual('')
  }

  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Deudas
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Préstamos, tarjetas u otras deudas pendientes del negocio.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Concepto (ej: Préstamo Banco Nación)"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="number"
          placeholder="Monto adeudado"
          value={montoAdeudado}
          onChange={(e) => setMontoAdeudado(e.target.value)}
          className="tabular w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="number"
          placeholder="Cuota mensual"
          value={cuotaMensual}
          onChange={(e) => setCuotaMensual(e.target.value)}
          className="tabular w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--series-blue)' }}
        >
          Agregar
        </button>
      </form>

      {deudas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ninguna deuda.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {deudas.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {d.concepto}
              </span>
              <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                cuota {formatoMoneda(d.cuotaMensual)}/mes
              </span>
              <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(d.montoAdeudado)}
              </span>
              <button
                onClick={() => onEliminar(d.id)}
                aria-label="Eliminar deuda"
                className="shrink-0 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"
        style={{ borderColor: 'var(--gridline)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Deuda total
        </span>
        <span className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatoMoneda(totalAdeudado)}
        </span>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        Cuota mensual total: <span className="tabular font-medium">{formatoMoneda(totalCuota)}</span>. Si ya la
        estás pagando, acordate de incluirla dentro de tus gastos fijos para que se refleje en el flujo de caja.
      </p>
    </section>
  )
}
