import { AlertTriangle, DollarSign, RefreshCw } from 'lucide-react'
import { NOMBRE_CASA } from '../lib/cotizaciones'
import type { EstadoCotizaciones } from '../lib/useCotizaciones'

// La cotización del día, en el encabezado.
//
// Está a la vista y no escondida en una configuración porque es el número con el que el sistema
// está convirtiendo TODO lo que esté en dólares. Si está desactualizado o mal, la persona tiene
// que poder darse cuenta sin ir a buscarlo.

function soloFecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export function IndicadorDolar({ estado, onConfigurar }: { estado: EstadoCotizaciones; onConfigurar?: () => void }) {
  const { actual, casa, dia, manual, cargando, error } = estado

  if (!actual) {
    return (
      <button
        type="button"
        onClick={onConfigurar}
        className="hidden items-center gap-1 text-xs sm:inline-flex"
        style={{ color: 'var(--text-muted)' }}
        title={error ?? 'Todavía no se pudo traer la cotización del dólar.'}
      >
        {cargando ? <RefreshCw size={12} className="animate-spin" aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
        {cargando ? 'Dólar…' : 'Sin cotización'}
      </button>
    )
  }

  const desactualizada = !manual && dia !== null && dia !== new Date().toISOString().slice(0, 10)

  return (
    <button
      type="button"
      onClick={onConfigurar}
      className="hidden items-center gap-1 text-xs tabular sm:inline-flex"
      style={{ color: desactualizada ? 'var(--status-warning)' : 'var(--text-secondary)' }}
      title={
        manual
          ? `Tipo de cambio fijado a mano: compra ${actual.compra}, venta ${actual.venta}. Tocá para cambiarlo.`
          : `${NOMBRE_CASA[casa]} — compra ${actual.compra}, venta ${actual.venta}${desactualizada ? `, del ${soloFecha(dia)}` : ''}. Tocá para cambiar cuál se usa.`
      }
    >
      <DollarSign size={12} aria-hidden="true" />
      {NOMBRE_CASA[casa]} {Math.round(actual.venta).toLocaleString('es-AR')}
      {manual && <span style={{ color: 'var(--text-muted)' }}>(fijo)</span>}
      {desactualizada && <AlertTriangle size={11} aria-hidden="true" />}
    </button>
  )
}
