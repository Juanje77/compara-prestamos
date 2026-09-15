import { useState } from 'react'
import type { CuentaBancaria, MovimientoTesoreria } from '../lib/cfo'
import { calcularSaldoTotalBancos, resumenPorCuenta } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'

interface Props {
  cuentas: CuentaBancaria[]
  movimientos: MovimientoTesoreria[]
  onAgregarCuenta: (nombre: string, saldoInicial: number) => void
  onAjustarSaldo: (cuentaId: string, monto: number, fecha: string, concepto: string | undefined) => void
  onEliminarMovimiento: (id: string) => void
  onEliminarCuenta: (id: string) => void
}

const ORIGEN_LABEL: Record<MovimientoTesoreria['origen'], string> = {
  factura: 'Factura',
  anticipo: 'Anticipo',
  cheque: 'Cheque',
  manual: 'Ajuste',
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function FormularioAltaCuenta({ onAgregarCuenta }: { onAgregarCuenta: Props['onAgregarCuenta'] }) {
  const [nombre, setNombre] = useState('')
  const [saldoInicial, setSaldoInicial] = useState(0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    onAgregarCuenta(nombre.trim(), saldoInicial)
    setNombre('')
    setSaldoInicial(0)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
      <input
        type="text"
        placeholder="Nombre (ej: Caja, Banco Nación)"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="min-w-[180px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      />
      <InputMoneda
        placeholder="Saldo inicial"
        value={saldoInicial}
        onChange={setSaldoInicial}
        className="tabular w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--series-blue)' }}
      >
        Agregar cuenta
      </button>
    </form>
  )
}

function FilaCuenta({
  cuenta,
  movimientos,
  onAjustarSaldo,
  onEliminarMovimiento,
  onEliminarCuenta,
}: {
  cuenta: CuentaBancaria
  movimientos: MovimientoTesoreria[]
  onAjustarSaldo: Props['onAjustarSaldo']
  onEliminarMovimiento: Props['onEliminarMovimiento']
  onEliminarCuenta: Props['onEliminarCuenta']
}) {
  const [expandido, setExpandido] = useState(false)
  const [monto, setMonto] = useState(0)
  const [fecha, setFecha] = useState(hoyISO)
  const [concepto, setConcepto] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!monto) return
    onAjustarSaldo(cuenta.id, monto, fecha, concepto.trim() || undefined)
    setMonto(0)
    setConcepto('')
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: cuenta.saldo < 0 ? 'var(--status-critical)' : 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {cuenta.nombre}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <p className="tabular text-lg font-semibold" style={{ color: cuenta.saldo < 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}>
            {formatoMoneda(cuenta.saldo)}
          </p>
          <button
            onClick={() => setExpandido((v) => !v)}
            className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            {expandido ? 'Cerrar' : '± Ajustar'}
          </button>
          <button
            onClick={() => {
              if (movimientos.length > 0 && !window.confirm(`"${cuenta.nombre}" tiene movimientos cargados. ¿Eliminarla igual? También se borra su historial.`)) return
              onEliminarCuenta(cuenta.id)
            }}
            aria-label="Eliminar cuenta"
            className="shrink-0 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            🗑
          </button>
        </div>
      </div>

      {expandido && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
            <InputMoneda
              placeholder="Monto (± )"
              value={monto}
              onChange={setMonto}
              className="tabular w-32 shrink-0 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="tabular w-36 shrink-0 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              placeholder="Concepto (opcional)"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="min-w-[140px] flex-1 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg px-3 py-1 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--series-blue)' }}
            >
              Registrar
            </button>
          </form>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Un ajuste suma el monto tal cual — poné un número negativo para restar (ej: un gasto bancario, un
            retiro de caja).
          </p>

          {movimientos.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {movimientos.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
                  style={{ borderColor: 'var(--gridline)' }}
                >
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
                  >
                    {ORIGEN_LABEL[m.origen]}
                  </span>
                  <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span
                    className="tabular shrink-0 font-medium"
                    style={{ color: m.tipo === 'egreso' || (m.tipo === 'ajuste' && m.monto < 0) ? 'var(--status-critical)' : 'var(--status-good-text)' }}
                  >
                    {m.tipo === 'egreso' ? '-' : m.tipo === 'ingreso' ? '+' : m.monto >= 0 ? '+' : ''}
                    {formatoMoneda(Math.abs(m.monto))}
                  </span>
                  {m.concepto && (
                    <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {m.concepto}
                    </span>
                  )}
                  {m.origen === 'manual' && (
                    <button
                      onClick={() => onEliminarMovimiento(m.id)}
                      aria-label="Eliminar movimiento"
                      className="ml-auto shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      🗑
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function Tesoreria({ cuentas, movimientos, onAgregarCuenta, onAjustarSaldo, onEliminarMovimiento, onEliminarCuenta }: Props) {
  const resumen = resumenPorCuenta(cuentas, movimientos)
  const saldoTotal = calcularSaldoTotalBancos(cuentas)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Tesorería
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          El saldo de cada caja o cuenta bancaria se actualiza solo con lo que marqués como cobrado/pagado en
          Comprobantes, Cuentas corrientes, Cheques y Remitos. Usá "± Ajustar" solo para movimientos que no
          vienen de ahí (un gasto bancario, un retiro de caja, la carga inicial).
        </p>

        <FormularioAltaCuenta onAgregarCuenta={onAgregarCuenta} />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Cuentas
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {cuentas.length}
            </p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: saldoTotal < 0 ? 'var(--status-critical)' : 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Saldo total
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: saldoTotal < 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}>
              {formatoMoneda(saldoTotal)}
            </p>
          </div>
        </div>

        {cuentas.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Todavía no cargaste ninguna cuenta.
          </p>
        ) : (
          <div className="space-y-3">
            {resumen.map((r) => (
              <FilaCuenta
                key={r.cuenta.id}
                cuenta={r.cuenta}
                movimientos={r.movimientos}
                onAjustarSaldo={onAjustarSaldo}
                onEliminarMovimiento={onEliminarMovimiento}
                onEliminarCuenta={onEliminarCuenta}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
