import { useState } from 'react'
import type { CuentaBancaria } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  cuentas: CuentaBancaria[]
  onAgregar: (nombre: string, saldo: number) => void
  onCambiarSaldo: (id: string, saldo: number) => void
  onEliminar: (id: string) => void
}

export function CuentasBancarias({ cuentas, onAgregar, onCambiarSaldo, onEliminar }: Props) {
  const [nombre, setNombre] = useState('')
  const [saldo, setSaldo] = useState('')

  const total = cuentas.reduce((s, c) => s + c.saldo, 0)
  const hayDescubierto = cuentas.some((c) => c.saldo < 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const saldoNum = Number(saldo)
    if (!nombre.trim() || saldo === '' || Number.isNaN(saldoNum)) return
    onAgregar(nombre.trim(), saldoNum)
    setNombre('')
    setSaldo('')
  }

  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Cuentas bancarias
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Cargá el saldo de cada cuenta. Si una cuenta está en descubierto, poné el saldo en negativo.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Banco / cuenta (ej: Banco Nación - Cta Cte)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="min-w-[180px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="number"
          placeholder="Saldo"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          className="tabular w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
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

      {cuentas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ninguna cuenta.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {cuentas.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: c.saldo < 0 ? 'var(--status-critical)' : 'var(--border)' }}
            >
              <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {c.nombre}
              </span>
              {c.saldo < 0 && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                  style={{ color: 'var(--status-critical)', background: 'var(--surface-2)' }}
                >
                  Descubierto
                </span>
              )}
              <input
                type="number"
                value={c.saldo}
                onChange={(e) => onCambiarSaldo(c.id, Number(e.target.value))}
                className="tabular w-32 shrink-0 rounded-lg border px-2 py-1 text-right font-medium"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface-1)',
                  color: c.saldo < 0 ? 'var(--status-critical)' : 'var(--text-primary)',
                }}
              />
              <button
                onClick={() => onEliminar(c.id)}
                aria-label="Eliminar cuenta"
                className="shrink-0 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className="mt-4 flex items-center justify-between border-t pt-3 text-sm"
        style={{ borderColor: 'var(--gridline)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Saldo total en bancos
        </span>
        <span
          className="tabular text-lg font-semibold"
          style={{ color: total >= 0 ? 'var(--text-primary)' : 'var(--status-critical)' }}
        >
          {formatoMoneda(total)}
        </span>
      </div>
      {hayDescubierto && (
        <p className="mt-1 text-xs" style={{ color: 'var(--status-critical)' }}>
          Tenés al menos una cuenta en descubierto.
        </p>
      )}
    </section>
  )
}
