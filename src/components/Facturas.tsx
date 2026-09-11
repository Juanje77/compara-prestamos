import { useState } from 'react'
import type { EstadoFactura, Factura, TipoFactura } from '../lib/cfo'
import { calcularTotalesFacturas } from '../lib/cfo'
import { importarComprobantesArca } from '../lib/arcaImport'
import { formatoMoneda } from '../lib/finance'

interface Props {
  facturas: Factura[]
  onAgregar: (factura: Omit<Factura, 'id' | 'estado'>) => void
  onImportarVarias: (facturas: Omit<Factura, 'id' | 'estado'>[]) => void
  onCambiarEstado: (id: string, estado: EstadoFactura) => void
  onEliminar: (id: string) => void
}

function sumarDias(fechaISO: string, dias: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00`)
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

const ESTADO_LABEL: Record<EstadoFactura, string> = {
  pendiente: 'Pendiente',
  cobrada: 'Cobrada',
  pagada: 'Pagada',
  vencida: 'Vencida',
}

function colorEstado(estado: EstadoFactura): string {
  if (estado === 'vencida') return 'var(--status-critical)'
  if (estado === 'pendiente') return 'var(--status-warning)'
  return 'var(--status-good-text)'
}

export function Facturas({ facturas, onAgregar, onImportarVarias, onCambiarEstado, onEliminar }: Props) {
  const [tipo, setTipo] = useState<TipoFactura>('emitida')
  const [contraparte, setContraparte] = useState('')
  const [monto, setMonto] = useState('')
  const fechaEmision = new Date().toISOString().slice(0, 10)
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [filtro, setFiltro] = useState<'todas' | TipoFactura>('todas')
  const [plazoDias, setPlazoDias] = useState(0)
  const [importando, setImportando] = useState(false)
  const [mensajeImport, setMensajeImport] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const totales = calcularTotalesFacturas(facturas)
  const listado = facturas
    .filter((f) => filtro === 'todas' || f.tipo === filtro)
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(monto)
    if (!contraparte.trim() || !m || m <= 0 || !fechaVencimiento) return
    onAgregar({ tipo, contraparte: contraparte.trim(), monto: m, fechaEmision, fechaVencimiento })
    setContraparte('')
    setMonto('')
    setFechaVencimiento('')
  }

  function marcarComoResuelta(f: Factura) {
    onCambiarEstado(f.id, f.tipo === 'emitida' ? 'cobrada' : 'pagada')
  }

  async function handleImportarArca(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    setMensajeImport(null)
    setImportando(true)
    try {
      const { facturas: importadas, omitidas } = await importarComprobantesArca(file)
      if (importadas.length === 0) {
        setMensajeImport({ tipo: 'error', texto: 'No se encontraron comprobantes válidos para importar en el archivo.' })
      } else {
        onImportarVarias(
          importadas.map((f) => ({
            tipo: f.tipo,
            contraparte: f.contraparte,
            monto: f.monto,
            fechaEmision: f.fechaEmision,
            fechaVencimiento: sumarDias(f.fechaEmision, plazoDias),
            numero: f.numero,
          })),
        )
        const detalleOmitidas = omitidas > 0 ? ` (se omitieron ${omitidas} nota(s) de crédito/débito o fila(s) inválida(s))` : ''
        setMensajeImport({ tipo: 'ok', texto: `Se importaron ${importadas.length} comprobante(s)${detalleOmitidas}.` })
      }
    } catch (err) {
      setMensajeImport({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo leer el archivo.' })
    } finally {
      setImportando(false)
      inputEl.value = ''
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Facturas y comprobantes
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Facturas emitidas (por cobrar) y recibidas (por pagar), con su estado y vencimiento.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Por cobrar
          </p>
          <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(totales.porCobrar)}
          </p>
          {totales.vencidasCobrar > 0 && (
            <p className="text-xs" style={{ color: 'var(--status-critical)' }}>
              {totales.vencidasCobrar} vencida(s)
            </p>
          )}
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Por pagar
          </p>
          <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(totales.porPagar)}
          </p>
          {totales.vencidasPagar > 0 && (
            <p className="text-xs" style={{ color: 'var(--status-critical)' }}>
              {totales.vencidasPagar} vencida(s)
            </p>
          )}
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border p-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <label
          className="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
        >
          {importando ? 'Importando…' : '📄 Importar desde ARCA'}
          <input type="file" accept=".xlsx,.xls" onChange={handleImportarArca} className="hidden" disabled={importando} />
        </label>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Vencimiento: emisión +
          <input
            type="number"
            min={0}
            value={plazoDias}
            onChange={(e) => setPlazoDias(Number(e.target.value))}
            className="tabular w-14 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          días
        </label>
      </div>

      {mensajeImport && (
        <p
          className="mb-4 rounded-lg border p-3 text-sm"
          style={{
            borderColor: mensajeImport.tipo === 'ok' ? 'var(--status-good-text)' : 'var(--status-critical)',
            color: mensajeImport.tipo === 'ok' ? 'var(--status-good-text)' : 'var(--status-critical)',
          }}
        >
          {mensajeImport.texto}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoFactura)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          <option value="emitida">Emitida (por cobrar)</option>
          <option value="recibida">Recibida (por pagar)</option>
        </select>
        <input
          type="text"
          placeholder="Cliente / proveedor"
          value={contraparte}
          onChange={(e) => setContraparte(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="number"
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="tabular w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
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

      <div className="mb-3 flex gap-2">
        {(['todas', 'emitida', 'recibida'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="rounded-full border px-3 py-1 text-xs font-medium"
            style={
              filtro === f
                ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
            }
          >
            {f === 'todas' ? 'Todas' : f === 'emitida' ? 'Emitidas' : 'Recibidas'}
          </button>
        ))}
      </div>

      {listado.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No hay facturas cargadas todavía.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {listado.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
              >
                {f.tipo === 'emitida' ? 'Cobrar' : 'Pagar'}
              </span>
              <span className="min-w-[100px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {f.contraparte}
                {f.numero && (
                  <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    ({f.numero})
                  </span>
                )}
              </span>
              <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                vence {new Date(f.fechaVencimiento).toLocaleDateString('es-AR')}
              </span>
              <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(f.monto)}
              </span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: colorEstado(f.estado) }}>
                {ESTADO_LABEL[f.estado]}
              </span>
              {(f.estado === 'pendiente' || f.estado === 'vencida') && (
                <button
                  onClick={() => marcarComoResuelta(f)}
                  className="shrink-0 rounded-full border px-2 py-1 text-xs font-medium"
                  style={{ borderColor: 'var(--status-good-text)', color: 'var(--status-good-text)' }}
                >
                  Marcar {f.tipo === 'emitida' ? 'cobrada' : 'pagada'}
                </button>
              )}
              <button
                onClick={() => onEliminar(f.id)}
                aria-label="Eliminar factura"
                className="shrink-0 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 border-t pt-3 text-xs" style={{ borderColor: 'var(--gridline)', color: 'var(--text-muted)' }}>
"Importar desde ARCA" acepta el Excel de "Mis Comprobantes Emitidos" o "Mis Comprobantes Recibidos" tal cual
        se descarga desde ARCA — detecta solo con el archivo si son facturas emitidas o recibidas. Las notas de
        crédito/débito se omiten. Como ARCA no informa la fecha de vencimiento, se calcula sumando los días
        indicados arriba a la fecha de emisión, y todos los comprobantes se importan como "Pendiente" — marcalos
        como cobrados/pagados a medida que corresponda.
      </p>
    </section>
  )
}

