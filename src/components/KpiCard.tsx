type Status = 'good' | 'warning' | 'critical'

const STATUS_COLOR: Record<Status, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-critical)',
}

interface Props {
  label: string
  value: string
  status: Status
  statusLabel: string
}

export function KpiCard({ label, value, status, statusLabel }: Props) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="tabular text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[status] }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}
