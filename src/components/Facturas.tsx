import { useMemo, useState } from 'react'
import type { Factura, TipoComprobante, TipoFactura } from '../lib/cfo'
import { calcularPesoNotas, calcularRanking, calcularResumenMensual, montoConSigno } from '../lib/cfo'
import { importarComprobantesArca } from '../lib/arcaImport'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'

interface Props {
  facturas: Factura[]
  onAgregar: (factura: Omit<Factura, 'id'>) => void
  onImportarVarias: (facturas: Omit<Factura, 'id'>[]) => void
  onEliminar: (id: string) => void
}

const TIPO_COMPROBANTE_LABEL: Record<TipoComprobante, string> = {
  factura: 'Factura',
  nota_credito: 'Nota de Crédito',
  nota_debito: 'Nota de Débito',
}

function mesLegible(mes: string): string {
  const [anio, m] = mes.split('-')
  const fecha = new Date(Number(anio), Number(m) - 1, 1)
  return fecha.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
}

export function Facturas({ facturas, onAgregar, onImportarVarias, onEliminar }: Props) {
  const [tipo, setTipo] = useState<TipoFactura>('emitida')
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('factura')
  const [contraparte, setContraparte] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [filtro, setFiltro] = useState<'todas' | TipoFactura>('todas')
  const [importando, setImportando] = useState(false)
  const [mensajeImport, setMensajeImport] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const resumenMensual = useMemo(() => calcularResumenMensual(facturas), [facturas])
  const rankingClientes = useMemo(() => calcularRanking(facturas, 'emitida'), [facturas])
  const rankingProveedores = useMemo(() => calcularRanking(facturas, 'recibida'), [facturas])
  const pesoNotas = useMemo(() => calcularPesoNotas(facturas), [facturas])
  const ultimoMes = resumenMensual[resumenMensual.length - 1]

  const listado = facturas
    .filter((f) => filtro === 'todas' || f.tipo === filtro)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(monto)
    if (!contraparte.trim() || !m || m <= 0 || !fecha) return
    onAgregar({ tipo, tipoComprobante, contraparte: contraparte.trim(), monto: m, fecha })
    setContraparte('')
    setMonto('')
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
        onImportarVarias(importadas)
        const detalleOmitidas = omitidas > 0 ? ` (se omitieron ${omitidas} fila(s) con datos inválidos o tipo no reconocido)` : ''
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
    <div className="space-y-6">
      <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Salud financiera con tus comprobantes
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ventas y compras netas, margen bruto y calidad de tu facturación a partir de facturas, notas de
          crédito y notas de débito. Para saber qué te falta cobrar o pagar, usá "Cobranzas y pagos".
        </p>

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
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Aceptá el Excel de "Mis Comprobantes Emitidos" o "Recibidos" tal cual se descarga de ARCA.
          </span>
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

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoFactura)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="emitida">Emitida (venta)</option>
            <option value="recibida">Recibida (compra)</option>
          </select>
          <select
            value={tipoComprobante}
            onChange={(e) => setTipoComprobante(e.target.value as TipoComprobante)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="factura">Factura</option>
            <option value="nota_credito">Nota de Crédito</option>
            <option value="nota_debito">Nota de Débito</option>
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
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
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
      </section>

      {facturas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ni importaste comprobantes.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Ventas netas {ultimoMes ? `(${mesLegible(ultimoMes.mes)})` : ''}
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(ultimoMes?.ventasNetas ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Compras netas {ultimoMes ? `(${mesLegible(ultimoMes.mes)})` : ''}
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(ultimoMes?.comprasNetas ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Margen bruto {ultimoMes ? `(${mesLegible(ultimoMes.mes)})` : ''}
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: (ultimoMes?.margenBruto ?? 0) >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
              >
                {formatoMoneda(ultimoMes?.margenBruto ?? 0)} ({formatoPorcentaje(ultimoMes?.margenBrutoPct ?? 0)})
              </p>
            </div>
          </section>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ventas y compras netas por mes
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                    <th className="pb-2 font-medium">Mes</th>
                    <th className="pb-2 text-right font-medium">Ventas netas</th>
                    <th className="pb-2 text-right font-medium">Compras netas</th>
                    <th className="pb-2 text-right font-medium">Margen bruto</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenMensual.map((r) => (
                    <tr key={r.mes} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                      <td className="py-2 capitalize" style={{ color: 'var(--text-primary)' }}>
                        {mesLegible(r.mes)}
                      </td>
                      <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                        {formatoMoneda(r.ventasNetas)}
                      </td>
                      <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                        {formatoMoneda(r.comprasNetas)}
                      </td>
                      <td
                        className="tabular py-2 text-right font-medium"
                        style={{ color: r.margenBruto >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
                      >
                        {formatoMoneda(r.margenBruto)} ({formatoPorcentaje(r.margenBrutoPct)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Top clientes
              </h3>
              {rankingClientes.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Sin ventas cargadas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rankingClientes.map((r) => (
                    <li key={r.contraparte} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" style={{ color: 'var(--text-primary)' }}>
                        {r.contraparte}
                      </span>
                      <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatoMoneda(r.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Top proveedores
              </h3>
              {rankingProveedores.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Sin compras cargadas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rankingProveedores.map((r) => (
                    <li key={r.contraparte} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate" style={{ color: 'var(--text-primary)' }}>
                        {r.contraparte}
                      </span>
                      <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatoMoneda(r.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Peso de notas de crédito/débito
            </h3>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Cuánto de lo facturado en bruto se ajusta después con notas de crédito (ventas anuladas o
              compras devueltas) o de débito (recargos).
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sobre ventas emitidas
                </p>
                <p
                  className="tabular text-lg font-semibold"
                  style={{ color: pesoNotas.pctNotasEmitidas > 15 ? 'var(--status-critical)' : 'var(--text-primary)' }}
                >
                  {formatoPorcentaje(pesoNotas.pctNotasEmitidas)}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  NC: {formatoMoneda(pesoNotas.totalNotaCreditoEmitida)} · ND: {formatoMoneda(pesoNotas.totalNotaDebitoEmitida)}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sobre compras recibidas
                </p>
                <p
                  className="tabular text-lg font-semibold"
                  style={{ color: pesoNotas.pctNotasRecibidas > 15 ? 'var(--status-warning)' : 'var(--text-primary)' }}
                >
                  {formatoPorcentaje(pesoNotas.pctNotasRecibidas)}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  NC: {formatoMoneda(pesoNotas.totalNotaCreditoRecibida)} · ND: {formatoMoneda(pesoNotas.totalNotaDebitoRecibida)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Comprobantes cargados
              </h3>
              <div className="flex gap-2">
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
            </div>

            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
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
                    {f.tipo === 'emitida' ? 'Venta' : 'Compra'}
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {TIPO_COMPROBANTE_LABEL[f.tipoComprobante]}
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
                    {new Date(`${f.fecha}T00:00:00`).toLocaleDateString('es-AR')}
                  </span>
                  <span
                    className="tabular shrink-0 font-medium"
                    style={{ color: f.tipoComprobante === 'nota_credito' ? 'var(--status-critical)' : 'var(--text-primary)' }}
                  >
                    {formatoMoneda(montoConSigno(f))}
                  </span>
                  <button
                    onClick={() => onEliminar(f.id)}
                    aria-label="Eliminar comprobante"
                    className="shrink-0 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
