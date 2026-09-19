import { useState } from 'react'
import { AlertTriangle, FileUp, Trash2 } from 'lucide-react'
import type { MovimientoStock, Producto, TipoMovimientoStock } from '../lib/cfo'
import { calcularValorInventario, listarProductosBajoMinimo } from '../lib/cfo'
import { importarProductosDesdeExcel } from '../lib/excelImport'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'
import { Card } from './Card'
import { Button } from './Button'

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
  onEliminarProductos: (ids: string[]) => void
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
  const [esServicio, setEsServicio] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    onAgregarProducto({
      codigo: codigo.trim() || undefined,
      nombre: nombre.trim(),
      costoUnitario,
      precioVenta: precioVenta || undefined,
      stockActual: esServicio ? 0 : stockActual,
      esServicio: esServicio || undefined,
    })
    setCodigo('')
    setNombre('')
    setCostoUnitario(0)
    setPrecioVenta(0)
    setStockActual(0)
    setEsServicio(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-center gap-2">
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
        placeholder="Nombre del producto o servicio"
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
      {!esServicio && (
        <InputMoneda
          placeholder="Stock inicial"
          value={stockActual}
          onChange={setStockActual}
          className="tabular w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
      )}
      <label className="flex shrink-0 items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <input
          type="checkbox"
          checked={esServicio}
          onChange={(e) => setEsServicio(e.target.checked)}
          className="h-3.5 w-3.5 accent-current"
        />
        Es un servicio (sin stock)
      </label>
      <Button type="submit" variante="primario">
        Agregar
      </Button>
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
  seleccionado,
  onCambiarSeleccion,
  onRegistrarMovimiento,
  onEliminarMovimiento,
  onEliminarProducto,
}: {
  producto: Producto
  movimientos: MovimientoStock[]
  seleccionado: boolean
  onCambiarSeleccion: (id: string, valor: boolean) => void
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
        <td className="py-2 pr-2">
          <input
            type="checkbox"
            checked={seleccionado}
            onChange={(e) => onCambiarSeleccion(producto.id, e.target.checked)}
            className="h-3.5 w-3.5 accent-current"
            aria-label={`Seleccionar ${producto.nombre}`}
          />
        </td>
        <td className="py-2 pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          {producto.codigo ?? '—'}
        </td>
        <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>
          {producto.nombre}
          {producto.esServicio && (
            <span
              className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: 'var(--gridline)', color: 'var(--text-muted)' }}
            >
              Servicio
            </span>
          )}
        </td>
        <td
          className="tabular py-2 pr-4 text-right font-semibold"
          style={{ color: bajoMinimo ? 'var(--status-critical)' : 'var(--text-primary)' }}
          title={bajoMinimo ? `Stock mínimo: ${producto.stockMinimo}` : undefined}
        >
          {producto.esServicio ? (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              {producto.stockActual}
              {bajoMinimo && <AlertTriangle size={12} aria-hidden="true" />}
            </span>
          )}
        </td>
        <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
          {formatoMoneda(producto.costoUnitario)}
        </td>
        <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
          {producto.precioVenta ? formatoMoneda(producto.precioVenta) : '—'}
        </td>
        <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-primary)' }}>
          {producto.esServicio ? '—' : formatoMoneda(producto.stockActual * producto.costoUnitario)}
        </td>
        <td className="py-2 text-right">
          {!producto.esServicio && (
            <button
              onClick={() => setExpandido((v) => !v)}
              className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              {expandido ? 'Cerrar' : '± Ajustar'}
            </button>
          )}
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
      {expandido && !producto.esServicio && (
        <tr className="border-t" style={{ borderColor: 'var(--gridline)' }}>
          <td colSpan={8} className="py-3">
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
                <Button type="submit" variante="primario">
                  Registrar
                </Button>
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
                      {!m.remitoId && !m.facturaId && (
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
  onEliminarProductos,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  const valorInventario = calcularValorInventario(productos)
  const bajoMinimo = listarProductosBajoMinimo(productos)
  const texto = busqueda.trim().toLowerCase()
  const filtrados = texto
    ? productos.filter((p) => p.nombre.toLowerCase().includes(texto) || p.codigo?.toLowerCase().includes(texto))
    : productos
  const todosFiltradosSeleccionados = filtrados.length > 0 && filtrados.every((p) => seleccionados.has(p.id))

  function handleCambiarSeleccion(id: string, valor: boolean) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev)
      if (valor) siguiente.add(id)
      else siguiente.delete(id)
      return siguiente
    })
  }

  function handleSeleccionarTodos(valor: boolean) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev)
      for (const p of filtrados) {
        if (valor) siguiente.add(p.id)
        else siguiente.delete(p.id)
      }
      return siguiente
    })
  }

  function handleEliminarSeleccionados() {
    if (seleccionados.size === 0) return
    const conMovimientos = movimientos.some((m) => seleccionados.has(m.productoId))
    const advertencia = conMovimientos ? ' Algunos tienen movimientos cargados: también se borra su historial.' : ''
    if (!window.confirm(`¿Eliminar ${seleccionados.size} producto(s)/servicio(s)?${advertencia}`)) return
    onEliminarProductos([...seleccionados])
    setSeleccionados(new Set())
  }

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
              Cargá tu catálogo de productos y servicios — es tu lista de precios para armar líneas en Remitos y
              Comprobantes. Al guardar uno con líneas de producto, el stock se actualiza solo (un servicio nunca
              mueve stock).
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
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {productos.length > 6 && (
                <input
                  type="text"
                  placeholder="Buscar por nombre o código…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="min-w-[200px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
              )}
              {seleccionados.size > 0 && (
                <button
                  onClick={handleEliminarSeleccionados}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
                >
                  <Trash2 size={14} aria-hidden="true" /> Eliminar seleccionados ({seleccionados.size})
                </button>
              )}
            </div>
            {filtrados.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay coincidencias.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                      <th className="pb-2 pr-2">
                        <input
                          type="checkbox"
                          checked={todosFiltradosSeleccionados}
                          onChange={(e) => handleSeleccionarTodos(e.target.checked)}
                          className="h-3.5 w-3.5 accent-current"
                          aria-label="Seleccionar todos"
                        />
                      </th>
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
                        seleccionado={seleccionados.has(p.id)}
                        onCambiarSeleccion={handleCambiarSeleccion}
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
