import { useMemo, useState } from 'react'
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
import { agruparPorSemana, indiceDeSemana, type RangoSemana } from '../lib/semanas'
import { importarMovimientosDesdeExcel } from '../lib/excelImport'
import { formatoMoneda } from '../lib/finance'
import { descargarPdfCobranzasSemanal } from '../lib/pdf'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function etiquetaSemana(fechaISO: string, semanas: RangoSemana[]): { texto: string; color: string } {
  const idx = indiceDeSemana(fechaISO, semanas)
  if (idx !== null) return { texto: semanas[idx].labelCorto, color: 'var(--text-muted)' }
  const fecha = new Date(`${fechaISO}T00:00:00`)
  if (fecha < semanas[0].inicio) return { texto: 'Vencido', color: 'var(--status-critical)' }
  return { texto: 'Más adelante', color: 'var(--text-muted)' }
}

function ImportarExcelButton({
  activo,
  onImportar,
}: {
  activo: boolean
  onImportar: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label
      className="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium"
      style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
    >
      {activo ? 'Importando…' : '📄 Importar Excel'}
      <input type="file" accept=".xlsx,.xls" onChange={onImportar} className="hidden" disabled={activo} />
    </label>
  )
}

interface ColumnaProps {
  titulo: string
  movimientos: Movimiento[]
  semanas: RangoSemana[]
  onAgregar: (concepto: string, monto: number, fecha: string) => void
  onToggle: (id: string) => void
  onEliminar: (id: string) => void
  extra?: React.ReactNode
}

function ColumnaMovimientos({ titulo, movimientos, semanas, onAgregar, onToggle, onEliminar, extra }: ColumnaProps) {
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
          Todavía no cargaste nada.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {movimientos.map((m) => {
            const etiqueta = etiquetaSemana(m.fecha, semanas)
            return (
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
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                  style={{ color: etiqueta.color, background: 'var(--surface-2)' }}
                >
                  {etiqueta.texto}
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
            )
          })}
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
  const [importandoTipo, setImportandoTipo] = useState<TipoMovimiento | null>(null)

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
    if (!window.confirm('¿Vaciar todos los movimientos cargados? No se puede deshacer.')) return
    vaciarSemana()
    refrescar()
  }

  function handleImportarExcel(tipo: TipoMovimiento) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const inputEl = e.target
      if (!file) return
      setErrorImport(null)
      setImportandoTipo(tipo)
      try {
        const filas = await importarMovimientosDesdeExcel(file)
        if (filas.length === 0) {
          setErrorImport('No se encontraron filas válidas en el archivo.')
        } else {
          agregarMovimientos(tipo, filas)
          refrescar()
        }
      } catch (err) {
        setErrorImport(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
      } finally {
        setImportandoTipo(null)
        inputEl.value = ''
      }
    }
  }

  const cobros = movimientos.filter((m) => m.tipo === 'cobro')
  const pagos = movimientos.filter((m) => m.tipo === 'pago')

  const agrupacion = useMemo(() => agruparPorSemana(movimientos, 4), [movimientos])
  const totalVencidos = agrupacion.vencidos.reduce(
    (s, m) => s + (m.tipo === 'cobro' ? m.monto : -m.monto),
    0,
  )
  const totalAFuturo = agrupacion.aFuturo.reduce((s, m) => s + m.monto, 0)

  return (
    <>
      <section
        className="mb-6 rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Resumen semanal — ingresos y gastos por semana
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => descargarPdfCobranzasSemanal(agrupacion, movimientos)}
              className="rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              📄 Descargar / Imprimir PDF
            </button>
            <button
              onClick={handleVaciar}
              className="rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Vaciar todo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agrupacion.semanas.map((semana, i) => {
            const t = agrupacion.totalesPorSemana[i]
            return (
              <div key={semana.labelCorto} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {semana.label}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Cobros</span>
                    <span className="tabular font-medium" style={{ color: 'var(--status-good-text)' }}>
                      {formatoMoneda(t.cobros)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Pagos</span>
                    <span className="tabular font-medium" style={{ color: 'var(--status-critical)' }}>
                      {formatoMoneda(t.pagos)}
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between border-t pt-1"
                    style={{ borderColor: 'var(--gridline)' }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Saldo
                    </span>
                    <span
                      className="tabular font-semibold"
                      style={{ color: t.saldo >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
                    >
                      {formatoMoneda(t.saldo)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {(agrupacion.vencidos.length > 0 || agrupacion.aFuturo.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {agrupacion.vencidos.length > 0 && (
              <span>
                ⚠️ Vencido (antes de esta semana):{' '}
                <span className="tabular font-semibold" style={{ color: 'var(--status-critical)' }}>
                  {formatoMoneda(totalVencidos)}
                </span>{' '}
                netos en {agrupacion.vencidos.length} movimiento(s)
              </span>
            )}
            {agrupacion.aFuturo.length > 0 && (
              <span>
                Más allá de 4 semanas:{' '}
                <span className="tabular font-semibold">{formatoMoneda(totalAFuturo)}</span> en{' '}
                {agrupacion.aFuturo.length} movimiento(s)
              </span>
            )}
          </div>
        )}
      </section>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ColumnaMovimientos
          titulo="Cuentas a cobrar"
          movimientos={cobros}
          semanas={agrupacion.semanas}
          onAgregar={handleAgregar('cobro')}
          onToggle={handleToggle}
          onEliminar={handleEliminar}
          extra={
            <ImportarExcelButton activo={importandoTipo === 'cobro'} onImportar={handleImportarExcel('cobro')} />
          }
        />
        <ColumnaMovimientos
          titulo="Gastos a pagar"
          movimientos={pagos}
          semanas={agrupacion.semanas}
          onAgregar={handleAgregar('pago')}
          onToggle={handleToggle}
          onEliminar={handleEliminar}
          extra={
            <ImportarExcelButton activo={importandoTipo === 'pago'} onImportar={handleImportarExcel('pago')} />
          }
        />
      </div>

      {errorImport && (
        <p
          className="mb-6 rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
        >
          {errorImport}
        </p>
      )}

      <p className="border-t pt-6 pb-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        Las semanas se arman según la fecha que le pusiste a cada cobro o pago (lunes a domingo), empezando por
        la semana actual. El Excel a importar (tanto en cobros como en pagos) debe tener una fila de
        encabezados con columnas como "Cliente" o "Proveedor", "Monto" y, opcionalmente, "Fecha". Estos datos se
        guardan solo en este navegador, no se suben a ningún servidor.
      </p>
    </>
  )
}
