import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TIPOS_BIEN_LABEL, type Bien, type TipoBien } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'

interface Props {
  bienes: Bien[]
  runwayExtendido: number
  onAgregar: (bien: Omit<Bien, 'id'>) => void
  onEliminar: (id: string) => void
}

export function Patrimonio({ bienes, runwayExtendido, onAgregar, onEliminar }: Props) {
  const [concepto, setConcepto] = useState('')
  const [tipo, setTipo] = useState<TipoBien>('inversion')
  const [valorEstimado, setValorEstimado] = useState(0)

  const total = bienes.reduce((s, b) => s + b.valorEstimado, 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!concepto.trim() || !valorEstimado || valorEstimado <= 0) return
    onAgregar({ concepto: concepto.trim(), tipo, valorEstimado })
    setConcepto('')
    setValorEstimado(0)
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Patrimonio / Bienes
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Inversiones, inmuebles, vehículos, maquinaria o stock excedente que no forman parte de tu
        caja del día a día, pero que podrías vender o liquidar ante un quiebre de caja. No se suman al
        runway principal (que refleja tu caja real) — son un colchón de referencia aparte.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Concepto (ej: Plazo fijo, Camioneta)"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoBien)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          {(Object.keys(TIPOS_BIEN_LABEL) as TipoBien[]).map((t) => (
            <option key={t} value={t}>
              {TIPOS_BIEN_LABEL[t]}
            </option>
          ))}
        </select>
        <InputMoneda
          placeholder="Valor estimado"
          value={valorEstimado}
          onChange={setValorEstimado}
          className="tabular w-36 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
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

      {bienes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ningún bien.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {bienes.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
              >
                {TIPOS_BIEN_LABEL[b.tipo]}
              </span>
              <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {b.concepto}
              </span>
              <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(b.valorEstimado)}
              </span>
              <IconButton icon={Trash2} onClick={() => onEliminar(b.id)} label="Eliminar bien" className="shrink-0" />
            </li>
          ))}
        </ul>
      )}

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"
        style={{ borderColor: 'var(--gridline)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Valor total estimado
        </span>
        <span className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatoMoneda(total)}
        </span>
      </div>
      {total > 0 && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Runway extendido (caja + este patrimonio + el valor de tu Stock, pagando solo gastos fijos):{' '}
          <span className="tabular font-medium">
            {runwayExtendido === Infinity ? 'sin límite' : `${runwayExtendido.toFixed(1)} meses`}
          </span>
        </p>
      )}
    </section>
  )
}
