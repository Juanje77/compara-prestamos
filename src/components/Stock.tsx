import { useState } from 'react'
import { AlertTriangle, FileUp, Trash2 } from 'lucide-react'
import type { MovimientoStock, Producto, TipoMovimientoStock } from '../lib/cfo'
import { calcularValorInventario, listarProductosBajoMinimo } from '../lib/cfo'
import { importarProductosDesdeExcel } from '../lib/excelImport'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'
import { Card } from './Card'

interface Props {
  productos: Producto[]
  movimientos: MovimientoStock[]
  onAgregarProducto: (producto: Omit<Producto, 'id'>) => void
  onImportarProductos: (productos: Omit<Producto, 'id'>[]) => void
  onRegistrarMovimiento: (
    productoId: string,
    tipo: TipoMovimientoStock,
    cantidad: number,
    fecha: string,
    motivo: string | undefined,
    costoUnitario: number | undefined,
  ) => void
  onEliminarMovimiento: (id: string) => void
  onEliminarProducto: (id: string) => void
}

const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimientoStock, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function FormularioAlta({ onAgregarProducto }: { onAgregarProducto: Props['onAgregarProducto'] }) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [costoUnitario, setCostoUnitario] = useState(0)
  const [precioVenta, setPrecioVenta] = useState(0)
  const [stockActual, setStockActual] = useState(0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    onAgregarProducto({
      codigo: codigo.trim() || undefined,
      nombre: nombre.trim(),
      costoUnitario,
      precioVenta: precioVenta || undefined,
      stockActual,
    })
    setCodigo('')
    setNombre('')
    setCostoUnitario(0)
    setPrecioVenta(0)
    setStockActual(0)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
      <input
        type="text"
        placeholder="Código (opcional)"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        placeholder="Nombre del producto"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="min-w-[160px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      />
      <InputMoneda
        placeholder="Costo"
        value={costoUnitario}
        onChange={setCostoUnitario}
        className="tabular w-24 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      />
      <InputMoneda
        placeholder="Precio venta"
        value={precioVenta}
        onChange={setPrecioVenta}
        className="tabular w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
      />
      <InputMoneda
        placeholder="Stock inicial"
        value={stockActual}
        onChange={setStockActual}
        className="tabular w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
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
  )
}

function ImportarExcelButton({ onImportar }: { onImportar: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
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
      <FileUp size={14} aria-hidden="true" /> {importando ? 'Importando…' : 'Importar desde Excel'}
      <input type="file" accept=".xlsx,.xls" onChange={handleChange} className="hidden" disabled={importando} />
    </label>
  )
}

function FilaProducto({
  producto,
  movimientos,
  onRegistrarMovimiento,
  onEliminarMovimiento,
  onEliminarProducto,
}: {
  producto: Producto
  movimientos: MovimientoStock[]
  onRegistrarMovimiento: Props['onRegistrarMovimiento']
  onEliminarMovimiento: Props['onEliminarMovimiento']
  onEliminarProducto: Props['onEliminarProducto']
}) {
  const [expandido, setExpandido] = useState(false)
  const [tipo, setTipo] = useState<TipoMovimientoStock>('entrada')
  const [cantidad, setCantidad] = useState(0)
  const [fecha, setFecha] = useState(hoyISO)
  const [motivo, setMotivo] = useState('')
  const [costoUnitario, setCostoUnitario] = useState(0)

  const bajoMinimo = producto.stockMinimo !== undefined && producto.stockActual <= producto.stockMinimo
  const movimientosDelProducto = movimientos
    .filter((m) => m.productoId === producto.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cantidad || cantidad <= 0) return
    onRegistrarMovimiento(
      producto.id,
      tipo,
      cantidad,
      fecha,
      motivo.trim() || undefined,
      tipo === 'entrada' ? costoUnitario || undefined : undefined,
    )
    setCantidad(0)
    setMotivo('')
  }

  return (
    <>
      <tr className="border-t" style={{ borderColor: 'var(--gridline)' }}>
        <td className="py-2 pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          {producto.codigo ?? '—'}
        </td>
        <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>
          {producto.nombre}
        </td>
        <td
          className="tabular py-2 pr-4 text-right font-semibold"
          style={{ color: bajoMinimo ? 'var(--status-critical)' : 'var(--text-primary)' }}
          title={bajoMinimo ? `Stock mínimo: ${producto.stockMinimo}` : undefined}
        >
          <span className="inline-flex items-center gap-1">
            {producto.stockActual}
            {bajoMinimo && <AlertTriangle size={12} aria-hidden="true" />}
          </span>
        </td>
        <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
          {formatoMoneda(producto.costoUnitario)}
        </td>
        <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
          {producto.precioVenta ? formatoMoneda(producto.precioVenta) : '—'}
        </td>
        <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-primary)' }}>
          {formatoMoneda(producto.stockActual * producto.costoUnitario)}
        </td>
        <td className="py-2 text-right">
          <button
            onClick={() => setExpandido((v) => !v)}
            className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            {expandido ? 'Cerrar' : '± Ajustar'}
          </button>
          <IconButton
            icon={Trash2}
            onClick={() => {
              if (movimientosDelProducto.length > 0 && !window.confirm(`"${producto.nombre}" tiene movimientos cargados. ¿Eliminarlo igual? También se borra su historial.`)) return
              onEliminarProducto(producto.id)
            }}
            label="Eliminar producto"
            className="ml-2"
          />
        </td>
      </tr>
      {expandido && (
        <tr className="border-t" style={{ borderColor: 'var(--gridline)' }}>
          <td colSpan={7} className="py-3">
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}>
              <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoMovimientoStock)}
                  className="shrink-0 rounded-lg border px-2 py-1 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                >
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                  <option value="ajuste">Ajuste (+/-)</option>
                </select>
                <InputMoneda
                  placeholder="Cantidad"
                  value={cantidad}
                  onChange={setCantidad}
                  className="tabular w-24 shrink-0 rounded-lg border px-2 py-1 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
                {tipo === 'entrada' && (
                  <InputMoneda
                    placeholder="Costo (opcional)"
                    value={costoUnitario}
                    onChange={setCostoUnitario}
                    className="tabular w-28 shrink-0 rounded-lg border px-2 py-1 text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                  />
                )}
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="tabular w-36 shrink-0 rounded-lg border px-2 py-1 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
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
              {tipo === 'ajuste' && (
                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Un ajuste suma la cantidad tal cual — poné un número negativo para restar.
                </p>
              )}

              {movimientosDelProducto.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {movimientosDelProducto.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
                      style={{ borderColor: 'var(--gridline)' }}
                    >
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: 'var(--gridline)',
                          color:
                            m.tipo === 'entrada'
                              ? 'var(--status-good-text)'
                              : m.tipo === 'salida'
                                ? 'var(--status-critical)'
                                : 'var(--text-secondary)',
                        }}
                      >
                        {TIPO_MOVIMIENTO_LABEL[m.tipo]}
                      </span>
                      <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {m.cantidad}
                      </span>
                      {m.motivo && (
                        <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                          {m.motivo}
                        </span>
                      )}
                      {!m.remitoId && (
                        <IconButton icon={Trash2} onClick={() => onEliminarMovimiento(m.id)} label="Eliminar movimiento" className="ml-auto shrink-0" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function Stock({
  productos,
  movimientos,
  onAgregarProducto,
  onImportarProductos,
  onRegistrarMovimiento,
  onEliminarMovimiento,
  onEliminarProducto,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)

  const valorInventario = calcularValorInventario(productos)
  const bajoMinimo = listarProductosBajoMinimo(productos)
  const texto = busqueda.trim().toLowerCase()
  const filtrados = texto
    ? productos.filter((p) => p.nombre.toLowerCase().includes(texto) || p.codigo?.toLowerCase().includes(texto))
    : productos

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    setError(null)
    try {
      const filas = await importarProductosDesdeExcel(file)
      if (filas.length === 0) {
        setError('No se encontraron filas válidas en el archivo.')
      } else {
        onImportarProductos(filas)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      inputEl.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <Card as="section">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Stock
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Cargá tu catálogo de productos y llevá el control de entradas y salidas. Al guardar un remito con
              líneas de producto, el stock se actualiza solo.
            </p>
          </div>
          <ImportarExcelButton onImportar={handleImportar} />
        </div>

        {error && (
          <p
            className="mb-4 rounded-lg border p-3 text-sm"
            style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
          >
            {error}
          </p>
        )}

        <FormularioAlta onAgregarProducto={onAgregarProducto} />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Productos
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {productos.length}
            </p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Valor del inventario (a costo)
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatoMoneda(valorInventario)}
            </p>
          </div>
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: bajoMinimo.length > 0 ? 'var(--status-critical)' : 'var(--border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Bajo stock mínimo
            </p>
            <p
              className="tabular text-lg font-semibold"
              style={{ color: bajoMinimo.length > 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}
            >
              {bajoMinimo.length}
            </p>
          </div>
        </div>

        {productos.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Todavía no cargaste productos: importá tu catálogo desde Excel o agregá uno a mano arriba.
          </p>
        ) : (
          <>
            {productos.length > 6 && (
              <input
                type="text"
                placeholder="Buscar por nombre o código…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="mb-3 w-full rounded-lg border px-3 py-1.5 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
            )}
            {filtrados.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay coincidencias.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                      <th className="pb-2 pr-4 font-medium">Código</th>
                      <th className="pb-2 pr-4 font-medium">Producto</th>
                      <th className="pb-2 pr-4 text-right font-medium">Stock</th>
                      <th className="pb-2 pr-4 text-right font-medium">Costo</th>
                      <th className="pb-2 pr-4 text-right font-medium">Precio venta</th>
                      <th className="pb-2 pr-4 text-right font-medium">Valor en stock</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((p) => (
                      <FilaProducto
                        key={p.id}
                        producto={p}
                        movimientos={movimientos}
                        onRegistrarMovimiento={onRegistrarMovimiento}
                        onEliminarMovimiento={onEliminarMovimiento}
                        onEliminarProducto={onEliminarProducto}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
