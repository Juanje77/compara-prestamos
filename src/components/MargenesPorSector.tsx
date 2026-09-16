import { useState } from 'react'
import type { MargenSector } from '../lib/cfo'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'

interface Props {
  sectores: { id: string; nombre: string }[]
  margenes: MargenSector[]
  onAgregarSector: (nombre: string) => void
  onEliminarSector: (id: string) => void
}

function TarjetaMargen({ margen }: { margen: MargenSector }) {
  const positivo = margen.ganancia >= 0
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {margen.sector.nombre}
      </p>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {margen.cantidadRemitos} remito{margen.cantidadRemitos === 1 ? '' : 's'} asignado{margen.cantidadRemitos === 1 ? '' : 's'}
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Ingreso
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(margen.ingreso)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Costo de compras
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(margen.costoCompras)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Costo de líneas
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(margen.costoLineas)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Costo total
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(margen.costoTotal)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3" style={{ borderColor: 'var(--gridline)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Ganancia
          </p>
          <p
            className="tabular text-lg font-semibold"
            style={{ color: positivo ? 'var(--status-good-text)' : 'var(--status-critical)' }}
          >
            {formatoMoneda(margen.ganancia)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Margen
          </p>
          <p
            className="tabular text-lg font-semibold"
            style={{ color: positivo ? 'var(--status-good-text)' : 'var(--status-critical)' }}
          >
            {formatoPorcentaje(margen.margenPct)}
          </p>
        </div>
      </div>

      {margen.remitosSinLineas > 0 && (
        <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          ⚠️ {margen.remitosSinLineas} remito{margen.remitosSinLineas === 1 ? '' : 's'} emitido
          {margen.remitosSinLineas === 1 ? '' : 's'} de este sector no tiene{margen.remitosSinLineas === 1 ? '' : 'n'} líneas
          cargadas: su ganancia queda sobrestimada acá porque no hay forma de separar su costo del monto facturado.
        </p>
      )}
    </div>
  )
}

export function MargenesPorSector({ sectores, margenes, onAgregarSector, onEliminarSector }: Props) {
  const [nombreNuevo, setNombreNuevo] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombreNuevo.trim()) return
    onAgregarSector(nombreNuevo.trim())
    setNombreNuevo('')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Márgenes por sector
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Creá un sector por cada división o centro de costo del negocio y asignalo a tus remitos (en la solapa
          Remitos y presupuestos) para ver cuánto factura, cuánto cuesta y cuánto deja de ganancia cada uno. Solo
          se cuentan remitos (no presupuestos): un presupuesto todavía no es un compromiso real.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nombre del sector (ej: Metalúrgica, Instalaciones)"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--series-blue)' }}
          >
            Agregar sector
          </button>
        </form>

        {sectores.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {sectores.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                {s.nombre}
                <button
                  onClick={() => onEliminarSector(s.id)}
                  aria-label={`Eliminar sector ${s.nombre}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sectores.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no creaste ningún sector.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {margenes.map((m) => (
            <TarjetaMargen key={m.sector.id} margen={m} />
          ))}
        </div>
      )}
    </div>
  )
}
