import { useState } from 'react'
import type { EstadoFactura, Factura, TipoFactura } from '../lib/cfo'
import { calcularTotalesFacturas } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  facturas: Factura[]
  onAgregar: (factura: Omit<Factura, 'id' | 'estado'>) => void
  onCambiarEstado: (id: string, estado: EstadoFactura) => void
  onEliminar: (id: string) => void
}

const ESTADO_LABEL: Record<EstadoFactura, string> = {
  pendiente: 'Pendiente',
  cobrada: 'Cobrada',
  pagada: 'Pagada',
  vencida: 'Vencida',
}

function colorEstado(estado: EstadoFactura): string {
  if (estado === 'vencida') return 'var(--status-critical)'
  if (estado === 'pendiente') return 'var(--status-warning)'
  return 'var(--status-good-text)'
}

export function Facturas({ facturas, onAgregar, onCambiarEstado, onEliminar }: Props) {
  const [tipo, setTipo] = useState<TipoFactura>('emitida')
  const [contraparte, setContraparte] = useState('')
  const [monto, setMonto] = useState('')
  const fechaEmision = new Date().toISOString().slice(0, 10)
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [filtro, setFiltro] = useState<'todas' | TipoFactura>('todas')

  const totales = calcularTotalesFacturas(facturas)
  const listado = facturas
    .filter((f) => filtro === 'todas' || f.tipo === filtro)
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(monto)
    if (!contraparte.trim() || !m || m <= 0 || !fechaVencimiento) return
    onAgregar({ tipo, contraparte: contraparte.trim(), monto: m, fechaEmision, fechaVencimiento })
    setContraparte('')
    setMonto('')
    setFechaVencimiento('')
  }

  function marcarComoResuelta(f: Factura) {
    onCambiarEstado(f.id, f.tipo === 'emitida' ? 'cobrada' : 'pagada')
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Facturas y comprobantes
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Facturas emitidas (por cobrar) y recibidas (por pagar), con su estado y vencimiento.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Por cobrar
          </p>
          <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(totales.porCobrar)}
          </p>
          {totales.vencidasCobrar > 0 && (
            <p className="text-xs" style={{ color: 'var(--status-critical)' }}>
              {totales.vencidasCobrar} vencida(s)
            </p>
          )}
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Por pagar
          </p>
          <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(totales.porPagar)}
          </p>
          {totales.vencidasPagar > 0 && (
            <p className="text-xs" style={{ color: 'var(--status-critical)' }}>
              {totales.vencidasPagar} vencida(s)
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoFactura)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          <option value="emitida">Emitida (por cobrar)</option>
          <option value="recibida">Recibida (por pagar)</option>
        </select>
        <input
          type="text"
          placeholder="Cliente / proveedor"
          value={contraparte}
          onChange={(e) => setContraparte(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="number"
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="tabular w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
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

      <div className="mb-3 flex gap-2">
        {(['todas', 'emitida', 'recibida'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="rounded-full border px-3 py-1 text-xs font-medium"
            style={
              filtro === f
                ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
            }
          >
            {f === 'todas' ? 'Todas' : f === 'emitida' ? 'Emitidas' : 'Recibidas'}
          </button>
        ))}
      </div>

      {listado.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No hay facturas cargadas todavía.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {listado.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
              >
                {f.tipo === 'emitida' ? 'Cobrar' : 'Pagar'}
              </span>
              <span className="min-w-[100px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {f.contraparte}
              </span>
              <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                vence {new Date(f.fechaVencimiento).toLocaleDateString('es-AR')}
              </span>
              <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(f.monto)}
              </span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: colorEstado(f.estado) }}>
                {ESTADO_LABEL[f.estado]}
              </span>
              {(f.estado === 'pendiente' || f.estado === 'vencida') && (
                <button
                  onClick={() => marcarComoResuelta(f)}
                  className="shrink-0 rounded-full border px-2 py-1 text-xs font-medium"
                  style={{ borderColor: 'var(--status-good-text)', color: 'var(--status-good-text)' }}
                >
                  Marcar {f.tipo === 'emitida' ? 'cobrada' : 'pagada'}
                </button>
              )}
              <button
                onClick={() => onEliminar(f.id)}
                aria-label="Eliminar factura"
                className="shrink-0 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

