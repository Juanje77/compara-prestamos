import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { formatoPorcentaje } from '../lib/finance'
import { InfoTooltip } from './InfoTooltip'

type Status = 'good' | 'warning' | 'critical'

const STATUS_COLOR: Record<Status, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
}

/** La comparación contra la foto del mes anterior — ver historialMensual.ts. */
export interface ComparacionKpi {
  /** El valor de aquel mes, ya formateado para mostrar. */
  valorAnterior: string
  /** El cambio porcentual, o null si no se puede calcular (venía de cero o de un negativo). */
  porcentaje: number | null
  /** Hacia dónde se movió. */
  direccion: 'sube' | 'baja' | 'igual'
  /** De qué lado está lo deseable. Que suba el runway es bueno y que suba el endeudamiento no,
   * así que el color no puede salir del signo. */
  bueno: 'sube' | 'baja'
  /** El mes con el que se compara, escrito para mostrar. No siempre es el mes inmediato
   * anterior: si nadie abrió la app en marzo, abril se compara contra febrero, y decir "vs. mes
   * pasado" ahí sería mentira. */
  mes: string
}

interface Props {
  label: string
  value: string
  status: Status
  statusLabel: string
  info?: string
  comparacion?: ComparacionKpi
}

function Comparacion({ c }: { c: ComparacionKpi }) {
  if (c.direccion === 'igual') {
    return (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        igual que en {c.mes}
      </span>
    )
  }
  const Icono = c.direccion === 'sube' ? ArrowUpRight : ArrowDownRight
  const favorable = c.direccion === c.bueno
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium"
      style={{ color: favorable ? 'var(--status-good-text)' : 'var(--status-critical)' }}
      title={`En ${c.mes} era ${c.valorAnterior}`}
    >
      <Icono size={12} aria-hidden="true" />
      {/* Sin porcentaje —el mes anterior era cero o negativo— se muestra de dónde viene. Poner
          ahí el valor anterior a secas se lee como si FUERA la variación: "-50% vs. ago" cuando
          en realidad subió desde -50%. */}
      {c.porcentaje === null ? `desde ${c.valorAnterior}` : formatoPorcentaje(Math.abs(c.porcentaje))}
      <span style={{ color: 'var(--text-muted)' }}> vs. {c.mes}</span>
    </span>
  )
}

export function KpiCard({ label, value, status, statusLabel, info, comparacion }: Props) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        {label}
        {info && <InfoTooltip texto={info} />}
      </p>
      <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      {comparacion && (
        <p className="mt-0.5">
          <Comparacion c={comparacion} />
        </p>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[status] }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}
