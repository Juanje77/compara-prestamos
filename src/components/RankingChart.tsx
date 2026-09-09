import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { OfertaCalculada } from '../lib/finance'
import { formatoPorcentaje } from '../lib/finance'

interface Props {
  ofertas: OfertaCalculada[]
}

interface TooltipPayloadItem {
  payload: OfertaCalculada
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null
  const oferta = payload[0].payload
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <p className="font-semibold">{oferta.banco}</p>
      <p style={{ color: 'var(--text-secondary)' }}>
        CFT: <span className="tabular font-medium">{formatoPorcentaje(oferta.cft)}</span>
      </p>
      <p style={{ color: 'var(--text-secondary)' }}>
        TNA: <span className="tabular font-medium">{formatoPorcentaje(oferta.tna)}</span>
      </p>
    </div>
  )
}

export function RankingChart({ ofertas }: Props) {
  const data = [...ofertas].sort((a, b) => a.cft - b.cft)
  const mejorId = data[0]?.id

  const height = Math.max(220, data.length * 34 + 40)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 48, bottom: 8, left: 8 }} barCategoryGap={10}>
        <XAxis
          type="number"
          tickFormatter={(v) => `${v}%`}
          stroke="var(--axis)"
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--gridline)' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="banco"
          width={140}
          stroke="var(--axis)"
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--gridline)' }}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--gridline)', opacity: 0.4 }} />
        <Bar dataKey="cft" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((oferta) => (
            <Cell key={oferta.id} fill={oferta.id === mejorId ? 'var(--status-good)' : 'var(--series-blue)'} />
          ))}
          <LabelList
            dataKey="cft"
            position="right"
            formatter={(v: unknown) =>
              typeof v === 'number' ? `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%` : ''
            }
            style={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
