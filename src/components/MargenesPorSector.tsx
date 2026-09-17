import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import type { MargenSector } from '../lib/cfo'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import { IconButton } from './IconButton'
import { Card } from './Card'
import { Button } from './Button'

interface Props {
  sectores: { id: string; nombre: string }[]
  margenes: MargenSector[]
  mes: string
  onCambiarMes: (mes: string) => void
  onAgregarSector: (nombre: string) => void
  onEliminarSector: (id: string) => void
}

function etiquetaMes(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number)
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function TarjetaMargen({ margen }: { margen: MargenSector }) {
  const positivo = margen.ganancia >= 0
  return (
    <Card>
      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {margen.sector.nombre}
      </p>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {margen.cantidadRemitos} remito{margen.cantidadRemitos === 1 ? '' : 's'} asignado{margen.cantidadRemitos === 1 ? '' : 's'}
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
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
            Costo de nómina
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(margen.costoNomina)}
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
            {margen.ingreso > 0 ? formatoPorcentaje(margen.margenPct) : '—'}
          </p>
        </div>
      </div>

      {margen.remitosSinLineas > 0 && (
        <p className="mt-3 inline-flex items-start gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {margen.remitosSinLineas} remito{margen.remitosSinLineas === 1 ? '' : 's'} emitido
          {margen.remitosSinLineas === 1 ? '' : 's'} de este sector no tiene{margen.remitosSinLineas === 1 ? '' : 'n'} líneas
          cargadas: su ganancia queda sobrestimada acá porque no hay forma de separar su costo del monto facturado.
        </p>
      )}
    </Card>
  )
}

export function MargenesPorSector({ sectores, margenes, mes, onCambiarMes, onAgregarSector, onEliminarSector }: Props) {
  const [nombreNuevo, setNombreNuevo] = useState('')

  function sumarMeses(delta: number) {
    const [anio, m] = mes.split('-').map(Number)
    const fecha = new Date(anio, m - 1 + delta, 1)
    onCambiarMes(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombreNuevo.trim()) return
    onAgregarSector(nombreNuevo.trim())
    setNombreNuevo('')
  }

  return (
    <div className="space-y-6">
      <Card as="section">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Márgenes por sector
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sumarMeses(-1)}
              aria-label="Mes anterior"
              className="rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              ←
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {etiquetaMes(mes)}
            </span>
            <button
              onClick={() => sumarMeses(1)}
              aria-label="Mes siguiente"
              className="rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              →
            </button>
          </div>
        </div>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Creá un sector por cada división o centro de costo del negocio y asignalo a tus remitos (en la solapa
          Remitos y presupuestos) para ver cuánto factura, cuánto cuesta y cuánto deja de ganancia cada uno. Solo
          se cuentan remitos (no presupuestos): un presupuesto todavía no es un compromiso real. Se mira un mes por
          vez, porque el costo de la nómina asignada a cada sector (desde Sueldos) es mensual.
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
          <Button type="submit" variante="primario">
            Agregar sector
          </Button>
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
                <IconButton icon={Trash2} onClick={() => onEliminarSector(s.id)} label={`Eliminar sector ${s.nombre}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

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
