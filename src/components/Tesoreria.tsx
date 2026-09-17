import { useState } from 'react'
import { Check, FileUp, Landmark, Trash2 } from 'lucide-react'
import type { CuentaBancaria, MovimientoBancario, MovimientoTesoreria } from '../lib/cfo'
import { MARGEN_DIAS_CONCILIACION, calcularResumenConciliacion, calcularSaldoTotalBancos, deltaDeMovimientoTesoreria, resumenPorCuenta } from '../lib/cfo'
import { importarExtractoBancario } from '../lib/excelImport'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'
import { Card } from './Card'

interface Props {
  cuentas: CuentaBancaria[]
  movimientos: MovimientoTesoreria[]
  movimientosBancarios: MovimientoBancario[]
  onAgregarCuenta: (nombre: string, saldoInicial: number) => void
  onAjustarSaldo: (cuentaId: string, monto: number, fecha: string, concepto: string | undefined) => void
  onEliminarMovimiento: (id: string) => void
  onEliminarCuenta: (id: string) => void
  onImportarExtracto: (cuentaId: string, filas: Omit<MovimientoBancario, 'id' | 'cuentaId' | 'conciliado'>[]) => void
  onConciliarManual: (bancarioId: string, movimientoId: string) => void
  onDesconciliar: (bancarioId: string) => void
  onCrearAjusteDesdeBancario: (bancarioId: string) => void
  onEliminarMovimientoBancario: (id: string) => void
}

const ORIGEN_LABEL: Record<MovimientoTesoreria['origen'], string> = {
  factura: 'Factura',
  anticipo: 'Anticipo',
  cheque: 'Cheque',
  sueldo: 'Sueldos',
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
  movimientosBancarios,
  onAjustarSaldo,
  onEliminarMovimiento,
  onEliminarCuenta,
  onImportarExtracto,
  onConciliarManual,
  onDesconciliar,
  onCrearAjusteDesdeBancario,
  onEliminarMovimientoBancario,
}: {
  cuenta: CuentaBancaria
  movimientos: MovimientoTesoreria[]
  movimientosBancarios: MovimientoBancario[]
  onAjustarSaldo: Props['onAjustarSaldo']
  onEliminarMovimiento: Props['onEliminarMovimiento']
  onEliminarCuenta: Props['onEliminarCuenta']
  onImportarExtracto: Props['onImportarExtracto']
  onConciliarManual: Props['onConciliarManual']
  onDesconciliar: Props['onDesconciliar']
  onCrearAjusteDesdeBancario: Props['onCrearAjusteDesdeBancario']
  onEliminarMovimientoBancario: Props['onEliminarMovimientoBancario']
}) {
  const [expandido, setExpandido] = useState(false)
  const [conciliando, setConciliando] = useState(false)
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
            onClick={() => setConciliando((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            {conciliando ? 'Cerrar' : (<><Landmark size={14} aria-hidden="true" /> Conciliar</>)}
          </button>
          <IconButton
            icon={Trash2}
            onClick={() => {
              if (movimientos.length > 0 && !window.confirm(`"${cuenta.nombre}" tiene movimientos cargados. ¿Eliminarla igual? También se borra su historial.`)) return
              onEliminarCuenta(cuenta.id)
            }}
            label="Eliminar cuenta"
            className="shrink-0"
          />
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
                    <IconButton icon={Trash2} onClick={() => onEliminarMovimiento(m.id)} label="Eliminar movimiento" className="ml-auto shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {conciliando && (
        <PanelConciliacion
          cuenta={cuenta}
          movimientos={movimientos}
          movimientosBancarios={movimientosBancarios}
          onImportarExtracto={onImportarExtracto}
          onConciliarManual={onConciliarManual}
          onDesconciliar={onDesconciliar}
          onCrearAjusteDesdeBancario={onCrearAjusteDesdeBancario}
          onEliminarMovimientoBancario={onEliminarMovimientoBancario}
        />
      )}
    </div>
  )
}

function FilaBancario({
  bancario,
  pendientesSistema,
  onConciliarManual,
  onCrearAjusteDesdeBancario,
  onEliminarMovimientoBancario,
}: {
  bancario: MovimientoBancario
  pendientesSistema: MovimientoTesoreria[]
  onConciliarManual: Props['onConciliarManual']
  onCrearAjusteDesdeBancario: Props['onCrearAjusteDesdeBancario']
  onEliminarMovimientoBancario: Props['onEliminarMovimientoBancario']
}) {
  const [elegido, setElegido] = useState('')

  return (
    <li className="flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--gridline)' }}>
      <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
        {new Date(`${bancario.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
      </span>
      <span
        className="tabular shrink-0 font-medium"
        style={{ color: bancario.monto < 0 ? 'var(--status-critical)' : 'var(--status-good-text)' }}
      >
        {bancario.monto >= 0 ? '+' : ''}
        {formatoMoneda(bancario.monto)}
      </span>
      {bancario.descripcion && (
        <span className="min-w-[100px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
          {bancario.descripcion}
        </span>
      )}
      <select
        value={elegido}
        onChange={(e) => setElegido(e.target.value)}
        className="min-w-[140px] shrink-0 rounded border px-1.5 py-0.5 text-xs"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      >
        <option value="">Vincular a…</option>
        {pendientesSistema.map((m) => (
          <option key={m.id} value={m.id}>
            {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ·{' '}
            {formatoMoneda(m.monto)} {m.concepto ?? ''}
          </option>
        ))}
      </select>
      <button
        onClick={() => elegido && onConciliarManual(bancario.id, elegido)}
        disabled={!elegido}
        className="shrink-0 rounded border px-2 py-0.5 text-xs font-semibold disabled:opacity-40"
        style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
      >
        Vincular
      </button>
      <button
        onClick={() => onCrearAjusteDesdeBancario(bancario.id)}
        className="shrink-0 rounded border px-2 py-0.5 text-xs font-semibold"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        title="No corresponde a nada cargado — crear un ajuste en Tesorería con este monto"
      >
        + Ajuste
      </button>
      <IconButton icon={Trash2} onClick={() => onEliminarMovimientoBancario(bancario.id)} label="Descartar fila del extracto" className="shrink-0" />
    </li>
  )
}

function ImportarExtractoButton({ onImportar }: { onImportar: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const [importando, setImportando] = useState(false)
  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportando(true)
    try {
      await onImportar(e)
    } finally {
      setImportando(false)
    }
  }
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
      style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
    >
      <FileUp size={14} aria-hidden="true" /> {importando ? 'Importando…' : 'Importar extracto'}
      <input type="file" accept=".xlsx,.xls" onChange={handleChange} className="hidden" disabled={importando} />
    </label>
  )
}

function PanelConciliacion({
  cuenta,
  movimientos,
  movimientosBancarios,
  onImportarExtracto,
  onConciliarManual,
  onDesconciliar,
  onCrearAjusteDesdeBancario,
  onEliminarMovimientoBancario,
}: {
  cuenta: CuentaBancaria
  movimientos: MovimientoTesoreria[]
  movimientosBancarios: MovimientoBancario[]
  onImportarExtracto: Props['onImportarExtracto']
  onConciliarManual: Props['onConciliarManual']
  onDesconciliar: Props['onDesconciliar']
  onCrearAjusteDesdeBancario: Props['onCrearAjusteDesdeBancario']
  onEliminarMovimientoBancario: Props['onEliminarMovimientoBancario']
}) {
  const [error, setError] = useState<string | null>(null)
  const resumen = calcularResumenConciliacion(cuenta, movimientosBancarios, movimientos)
  const conciliados = movimientosBancarios.filter((b) => b.cuentaId === cuenta.id && b.conciliado)

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    setError(null)
    try {
      const filas = await importarExtractoBancario(file)
      if (filas.length === 0) {
        setError('No se encontraron filas válidas en el archivo.')
      } else {
        onImportarExtracto(cuenta.id, filas)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      inputEl.value = ''
    }
  }

  return (
    <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Subí el extracto de esta cuenta (Excel) — se intenta emparejar solo contra lo cargado en Tesorería
          con el mismo monto y hasta {MARGEN_DIAS_CONCILIACION} días de diferencia. Lo que no matchea, lo
          resolvés a mano abajo.
        </p>
        <ImportarExtractoButton onImportar={handleImportar} />
      </div>

      {error && (
        <p className="mb-3 rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}>
          {error}
        </p>
      )}

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded border p-2" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Saldo según Tesorería
          </p>
          <p className="tabular text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(resumen.saldoSistema)}
          </p>
        </div>
        <div className="rounded border p-2" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Saldo según el extracto
          </p>
          <p className="tabular text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {resumen.saldoExtracto !== null ? formatoMoneda(resumen.saldoExtracto) : '—'}
          </p>
        </div>
        <div className="rounded border p-2" style={{ borderColor: resumen.diferencia ? 'var(--status-critical)' : 'var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Diferencia
          </p>
          <p className="tabular text-sm font-semibold" style={{ color: resumen.diferencia ? 'var(--status-critical)' : 'var(--status-good-text)' }}>
            {resumen.diferencia !== null ? formatoMoneda(resumen.diferencia) : '—'}
          </p>
        </div>
      </div>

      <p className="mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        Pendientes de conciliar del extracto ({resumen.bancariosPendientes.length})
      </p>
      {resumen.bancariosPendientes.length === 0 ? (
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {movimientosBancarios.some((b) => b.cuentaId === cuenta.id) ? 'Todo lo importado ya está conciliado.' : 'Todavía no importaste ningún extracto.'}
        </p>
      ) : (
        <ul className="mb-3 space-y-1">
          {resumen.bancariosPendientes.map((b) => (
            <FilaBancario
              key={b.id}
              bancario={b}
              pendientesSistema={resumen.movimientosPendientes}
              onConciliarManual={onConciliarManual}
              onCrearAjusteDesdeBancario={onCrearAjusteDesdeBancario}
              onEliminarMovimientoBancario={onEliminarMovimientoBancario}
            />
          ))}
        </ul>
      )}

      {resumen.movimientosPendientes.length > 0 && (
        <>
          <p className="mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Cargado en Tesorería y todavía no aparece en ningún extracto ({resumen.movimientosPendientes.length})
          </p>
          <ul className="mb-3 space-y-1">
            {resumen.movimientosPendientes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--gridline)' }}>
                <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span
                  className="tabular shrink-0 font-medium"
                  style={{ color: deltaDeMovimientoTesoreria(m) < 0 ? 'var(--status-critical)' : 'var(--status-good-text)' }}
                >
                  {deltaDeMovimientoTesoreria(m) >= 0 ? '+' : ''}
                  {formatoMoneda(deltaDeMovimientoTesoreria(m))}
                </span>
                {m.concepto && (
                  <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {m.concepto}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {conciliados.length > 0 && (
        <>
          <p className="mb-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Conciliados ({conciliados.length})
          </p>
          <ul className="space-y-1">
            {conciliados.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--gridline)' }}>
                <Check size={14} className="shrink-0" style={{ color: 'var(--status-good-text)' }} aria-hidden="true" />
                <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {new Date(`${b.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {formatoMoneda(b.monto)}
                </span>
                {b.descripcion && (
                  <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {b.descripcion}
                  </span>
                )}
                <button
                  onClick={() => onDesconciliar(b.id)}
                  className="ml-auto shrink-0 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                  title="Deshacer esta conciliación"
                >
                  Desvincular
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function Tesoreria({
  cuentas,
  movimientos,
  movimientosBancarios,
  onAgregarCuenta,
  onAjustarSaldo,
  onEliminarMovimiento,
  onEliminarCuenta,
  onImportarExtracto,
  onConciliarManual,
  onDesconciliar,
  onCrearAjusteDesdeBancario,
  onEliminarMovimientoBancario,
}: Props) {
  const resumen = resumenPorCuenta(cuentas, movimientos)
  const saldoTotal = calcularSaldoTotalBancos(cuentas)

  return (
    <div className="space-y-6">
      <Card as="section">
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
                movimientosBancarios={movimientosBancarios}
                onAjustarSaldo={onAjustarSaldo}
                onEliminarMovimiento={onEliminarMovimiento}
                onEliminarCuenta={onEliminarCuenta}
                onImportarExtracto={onImportarExtracto}
                onConciliarManual={onConciliarManual}
                onDesconciliar={onDesconciliar}
                onCrearAjusteDesdeBancario={onCrearAjusteDesdeBancario}
                onEliminarMovimientoBancario={onEliminarMovimientoBancario}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
