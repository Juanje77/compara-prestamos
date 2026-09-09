import { useState } from 'react'
import { esCuitValido, formatearCuit, limpiarCuit } from '../lib/cuit'

interface EntidadDeuda {
  entidad?: string
  situacion?: number
  monto?: number
  diasAtrasoPago?: number
  [key: string]: unknown
}

interface PeriodoDeuda {
  periodo?: string
  entidades?: EntidadDeuda[]
  [key: string]: unknown
}

interface RespuestaBcra {
  status?: number
  results?: {
    identificacion?: number | string
    denominacion?: string
    periodos?: PeriodoDeuda[]
    [key: string]: unknown
  }
  sinRegistros?: boolean
  error?: string
  [key: string]: unknown
}

const SITUACIONES: Record<number, { label: string; desc: string; color: string }> = {
  1: { label: 'Situación 1 — Normal', desc: 'Sin atrasos significativos registrados.', color: 'var(--status-good)' },
  2: { label: 'Situación 2 — Riesgo bajo', desc: 'Atraso leve en el pago.', color: '#c98500' },
  3: { label: 'Situación 3 — Riesgo medio', desc: 'Atraso importante o problemas de pago.', color: '#ec835a' },
  4: { label: 'Situación 4 — Riesgo alto', desc: 'Alto riesgo de insolvencia.', color: '#d03b3b' },
  5: { label: 'Situación 5 — Irrecuperable', desc: 'La entidad considera la deuda incobrable.', color: '#d03b3b' },
  6: { label: 'Situación 6 — Irrecuperable (disposición técnica)', desc: '', color: '#d03b3b' },
}

function extraerUltimoPeriodo(resultado: RespuestaBcra): PeriodoDeuda | null {
  const periodos = resultado.results?.periodos
  if (!Array.isArray(periodos) || periodos.length === 0) return null
  return [...periodos].sort((a, b) => String(b.periodo ?? '').localeCompare(String(a.periodo ?? '')))[0]
}

export function SituacionCrediticia() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<RespuestaBcra | null>(null)

  async function consultar() {
    setError(null)
    setResultado(null)
    const limpio = limpiarCuit(input)
    if (!esCuitValido(limpio)) {
      setError('Ingresá un CUIT/CUIL válido de 11 dígitos.')
      return
    }
    setLoading(true)
    try {
      const resp = await fetch(`/api/situacion-crediticia?cuit=${limpio}`)
      const data: RespuestaBcra = await resp.json()
      if (!resp.ok) {
        setError(data.error ?? 'No se pudo completar la consulta.')
      } else {
        setResultado(data)
      }
    } catch {
      setError('No se pudo conectar con el servicio. Probá de nuevo en unos minutos.')
    } finally {
      setLoading(false)
    }
  }

  const ultimoPeriodo = resultado ? extraerUltimoPeriodo(resultado) : null
  const entidades = ultimoPeriodo?.entidades?.filter((e) => typeof e.situacion === 'number') ?? []
  const peorSituacion = entidades.length > 0 ? Math.max(...entidades.map((e) => e.situacion as number)) : null
  const formaReconocida = resultado != null && (resultado.sinRegistros || ultimoPeriodo != null)

  return (
    <section
      className="mb-10 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        ¿Podés acceder a un préstamo? Consultá tu situación crediticia
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Consulta gratuita y pública a la Central de Deudores del BCRA con tu CUIT/CUIL. No almacenamos tu
        número ni el resultado — se consulta directo al BCRA en el momento.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder="20-12345678-9"
          value={formatearCuit(input)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && consultar()}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={consultar}
          disabled={loading}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--series-blue)' }}
        >
          {loading ? 'Consultando…' : 'Consultar'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm font-medium" style={{ color: '#d03b3b' }}>
          {error}
        </p>
      )}

      {resultado?.sinRegistros && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--status-good)', background: 'color-mix(in srgb, var(--status-good) 6%, var(--surface-1))' }}>
          <p className="font-semibold" style={{ color: 'var(--status-good-text)' }}>
            No se encontraron registros de deudas en el sistema financiero.
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Esto suele ser una buena señal, aunque también puede significar que todavía no accediste a
            financiamiento formal. La decisión final siempre depende de la evaluación particular de cada banco.
          </p>
        </div>
      )}

      {resultado && !resultado.sinRegistros && entidades.length > 0 && peorSituacion != null && (
        <div className="mt-4">
          <div
            className="mb-3 rounded-lg border p-4"
            style={{ borderColor: SITUACIONES[peorSituacion]?.color ?? 'var(--border)' }}
          >
            <p className="font-semibold" style={{ color: SITUACIONES[peorSituacion]?.color ?? 'var(--text-primary)' }}>
              {SITUACIONES[peorSituacion]?.label ?? `Situación ${peorSituacion}`}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {peorSituacion <= 2
                ? 'Es probable que puedas acceder a un préstamo, sujeto a la evaluación particular de cada banco.'
                : peorSituacion === 3
                  ? 'Podrías tener dificultades para acceder a un préstamo. Te conviene consultar con un asesor antes de aplicar.'
                  : 'Es probable que la mayoría de los bancos no otorguen un préstamo en esta situación. Consultanos para ver alternativas.'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gridline)' }}>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Entidad</th>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Situación</th>
                  <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Monto (miles $)</th>
                </tr>
              </thead>
              <tbody>
                {entidades.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--gridline)' }}>
                    <td className="px-3 py-2">{String(e.entidad ?? '—')}</td>
                    <td className="px-3 py-2" style={{ color: SITUACIONES[e.situacion as number]?.color }}>
                      {SITUACIONES[e.situacion as number]?.label ?? e.situacion}
                    </td>
                    <td className="tabular px-3 py-2">{typeof e.monto === 'number' ? e.monto.toLocaleString('es-AR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Período informado: {ultimoPeriodo?.periodo ?? '—'}. Fuente: Central de Deudores del BCRA.
          </p>
        </div>
      )}

      {resultado && !resultado.sinRegistros && !formaReconocida && (
        <div className="mt-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Recibimos una respuesta del BCRA pero no pudimos interpretarla con el formato esperado. Podés ver
            el resultado tal cual abajo, o probar de nuevo más tarde.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>
              Ver respuesta cruda
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
              {JSON.stringify(resultado, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  )
}
