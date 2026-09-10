import { useMemo, useRef, useState } from 'react'
import {
  agregarMovimiento,
  agregarMovimientos,
  alternarCumplido,
  eliminarMovimiento,
  obtenerMovimientos,
  vaciarSemana,
  type Movimiento,
  type TipoMovimiento,
} from '../lib/movimientosSemana'
import { importarCuentasDesdeExcel } from '../lib/excelImport'
import { formatoMoneda } from '../lib/finance'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface ColumnaProps {
  titulo: string
  tipo: TipoMovimiento
  movimientos: Movimiento[]
  onAgregar: (concepto: string, monto: number, fecha: string) => void
  onToggle: (id: string) => void
  onEliminar: (id: string) => void
  extra?: React.ReactNode
}

function ColumnaMovimientos({ titulo, movimientos, onAgregar, onToggle, onEliminar, extra }: ColumnaProps) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())

  const pendientes = movimientos.filter((m) => !m.cumplido)
  const cumplidos = movimientos.filter((m) => m.cumplido)
  const totalPendiente = pendientes.reduce((s, m) => s + m.monto, 0)
  const totalCumplido = cumplidos.reduce((s, m) => s + m.monto, 0)
  const total = totalPendiente + totalCumplido
  const progresoPct = total > 0 ? (totalCumplido / total) * 100 : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoNum = Number(monto)
    if (!concepto.trim() || !montoNum || montoNum <= 0) return
    onAgregar(concepto.trim(), montoNum, fecha)
    setConcepto('')
    setMonto('')
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {titulo}
        </h3>
        {extra}
      </div>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Cliente / proveedor"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="number"
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="tabular w-24 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
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

      {movimientos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste nada para esta semana.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {movimientos.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', opacity: m.cumplido ? 0.55 : 1 }}
            >
              <input
                type="checkbox"
                checked={m.cumplido}
                onChange={() => onToggle(m.id)}
                className="h-4 w-4 shrink-0 accent-current"
                style={{ color: 'var(--series-blue)' }}
              />
              <span
                className="flex-1 truncate"
                style={{
                  color: 'var(--text-primary)',
                  textDecoration: m.cumplido ? 'line-through' : 'none',
                }}
              >
                {m.concepto}
              </span>
              <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
              </span>
              <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(m.monto)}
              </span>
              <button
                onClick={() => onEliminar(m.id)}
                aria-label="Eliminar"
                className="shrink-0 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>
            Cumplido: <span className="tabular font-semibold">{formatoMoneda(totalCumplido)}</span>
          </span>
          <span>
            Pendiente: <span className="tabular font-semibold">{formatoMoneda(totalPendiente)}</span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--gridline)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${progresoPct}%`, background: 'var(--status-good)' }}
          />
        </div>
      </div>
    </div>
  )
}

export function CobranzasPagosSemanal() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>(() => obtenerMovimientos())
  const [errorImport, setErrorImport] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const inputFileRef = useRef<HTMLInputElement>(null)

  function refrescar() {
    setMovimientos(obtenerMovimientos())
  }

  function handleAgregar(tipo: TipoMovimiento) {
    return (concepto: string, monto: number, fecha: string) => {
      agregarMovimiento(tipo, concepto, monto, fecha)
      refrescar()
    }
  }

  function handleToggle(id: string) {
    alternarCumplido(id)
    refrescar()
  }

  function handleEliminar(id: string) {
    eliminarMovimiento(id)
    refrescar()
  }

  function handleVaciar() {
    if (movimientos.length === 0) return
    if (!window.confirm('¿Vaciar todos los movimientos de esta semana? No se puede deshacer.')) return
    vaciarSemana()
    refrescar()
  }

  async function handleImportarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorImport(null)
    setImportando(true)
    try {
      const filas = await importarCuentasDesdeExcel(file)
      if (filas.length === 0) {
        setErrorImport('No se encontraron filas válidas en el archivo.')
      } else {
        agregarMovimientos('cobro', filas)
        refrescar()
      }
    } catch (err) {
      setErrorImport(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setImportando(false)
      if (inputFileRef.current) inputFileRef.current.value = ''
    }
  }

  const cobros = movimientos.filter((m) => m.tipo === 'cobro')
  const pagos = movimientos.filter((m) => m.tipo === 'pago')

  const resumen = useMemo(() => {
    const totalCobrar = cobros.reduce((s, m) => s + m.monto, 0)
    const totalPagar = pagos.reduce((s, m) => s + m.monto, 0)
    return { totalCobrar, totalPagar, saldoNeto: totalCobrar - totalPagar }
  }, [cobros, pagos])

  return (
    <>
      <section
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Total a cobrar esta semana
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatoMoneda(resumen.totalCobrar)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Total a pagar esta semana
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatoMoneda(resumen.totalPagar)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Saldo neto de la semana
            </p>
            <p
              className="tabular text-lg font-semibold"
              style={{ color: resumen.saldoNeto >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
            >
              {formatoMoneda(resumen.saldoNeto)}
            </p>
          </div>
        </div>
        <button
          onClick={handleVaciar}
          className="rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Vaciar semana
        </button>
      </section>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ColumnaMovimientos
          titulo="Cuentas a cobrar"
          tipo="cobro"
          movimientos={cobros}
          onAgregar={handleAgregar('cobro')}
          onToggle={handleToggle}
          onEliminar={handleEliminar}
          extra={
            <div>
              <label
                className="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
              >
                {importando ? 'Importando…' : '📄 Importar Excel'}
                <input
                  ref={inputFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportarExcel}
                  className="hidden"
                  disabled={importando}
                />
              </label>
            </div>
          }
        />
        <ColumnaMovimientos
          titulo="Gastos a pagar"
          tipo="pago"
          movimientos={pagos}
          onAgregar={handleAgregar('pago')}
          onToggle={handleToggle}
          onEliminar={handleEliminar}
        />
      </div>

      {errorImport && (
        <p className="mb-6 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}>
          {errorImport}
        </p>
      )}

      <p className="border-t pt-6 pb-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        El Excel de cuentas a cobrar debe tener una fila de encabezados con columnas como "Cliente", "Monto" y,
        opcionalmente, "Fecha". Estos datos se guardan solo en este navegador, no se suben a ningún servidor.
      </p>
    </>
  )
}
