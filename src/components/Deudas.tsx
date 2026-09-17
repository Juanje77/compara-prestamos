import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Deuda } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'
import { Card } from './Card'

interface Props {
  deudas: Deuda[]
  onAgregar: (concepto: string, montoAdeudado: number, cuotaMensual: number, proximoVencimiento?: string) => void
  onEliminar: (id: string) => void
}

export function Deudas({ deudas, onAgregar, onEliminar }: Props) {
  const [concepto, setConcepto] = useState('')
  const [montoAdeudado, setMontoAdeudado] = useState(0)
  const [cuotaMensual, setCuotaMensual] = useState(0)
  const [proximoVencimiento, setProximoVencimiento] = useState('')

  const totalAdeudado = deudas.reduce((s, d) => s + d.montoAdeudado, 0)
  const totalCuota = deudas.reduce((s, d) => s + d.cuotaMensual, 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!concepto.trim() || !montoAdeudado || montoAdeudado <= 0) return
    onAgregar(concepto.trim(), montoAdeudado, cuotaMensual, proximoVencimiento || undefined)
    setConcepto('')
    setMontoAdeudado(0)
    setCuotaMensual(0)
    setProximoVencimiento('')
  }

  return (
    <Card as="section">
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
        <InputMoneda
          placeholder="Monto adeudado"
          value={montoAdeudado}
          onChange={setMontoAdeudado}
          className="tabular w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <InputMoneda
          placeholder="Cuota mensual"
          value={cuotaMensual}
          onChange={setCuotaMensual}
          className="tabular w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="date"
          title="Próximo vencimiento (opcional)"
          value={proximoVencimiento}
          onChange={(e) => setProximoVencimiento(e.target.value)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
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
              {d.proximoVencimiento && (
                <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  vence {new Date(d.proximoVencimiento).toLocaleDateString('es-AR')}
                </span>
              )}
              <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                cuota {formatoMoneda(d.cuotaMensual)}/mes
              </span>
              <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(d.montoAdeudado)}
              </span>
              <IconButton icon={Trash2} onClick={() => onEliminar(d.id)} label="Eliminar deuda" className="shrink-0" />
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
    </Card>
  )
}
