import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, ScanBarcode, Trash2 } from 'lucide-react'
import {
  MEDIOS_PAGO_LABEL,
  agregarProductoALineas,
  buscarProductoPorCodigo,
  calcularMontoDesdeLineas,
  type CuentaBancaria,
  type LineaProducto,
  type MedioPago,
  type Producto,
} from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { IconButton } from './IconButton'
import { Card } from './Card'

// Venta de mostrador con lector de código de barras. A diferencia de Comprobantes —pensado para
// cargar un comprobante a la vez, con todos sus datos— acá lo único que importa es la velocidad:
// el cursor vuelve siempre al campo de escaneo, la lista crece sola y el total se ve grande.
//
// Al cobrar no inventa nada nuevo: arma un comprobante normal (emitido, ya cobrado) con sus
// líneas, y de ahí en adelante el circuito de siempre descuenta el stock y mueve la caja.

export interface VentaMostrador {
  contraparte: string
  lineas: LineaProducto[]
  monto: number
  medioPago: MedioPago
  cuentaId?: string
  esInterna: boolean
}

interface Props {
  productos: Producto[]
  cuentas: CuentaBancaria[]
  onCobrar: (venta: VentaMostrador) => void
}

const CONTRAPARTE_POR_DEFECTO = 'Consumidor final'

export function PuntoDeVenta({ productos, cuentas, onCobrar }: Props) {
  const [lineas, setLineas] = useState<LineaProducto[]>([])
  const [codigo, setCodigo] = useState('')
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [contraparte, setContraparte] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago>('caja')
  const [cuentaId, setCuentaId] = useState('')
  const [esInterna, setEsInterna] = useState(false)
  const campoEscaneo = useRef<HTMLInputElement>(null)

  // El cursor tiene que estar siempre en el campo de escaneo: si se va, el próximo producto que
  // pasen por el lector se escribe en cualquier lado y la venta se traba.
  const volverAlEscaneo = () => campoEscaneo.current?.focus()
  useEffect(volverAlEscaneo, [])

  const total = calcularMontoDesdeLineas(lineas)
  const hayProductos = productos.length > 0

  function handleEscanear() {
    const buscado = codigo.trim()
    if (!buscado) return
    setCodigo('')
    const producto = buscarProductoPorCodigo(productos, buscado)
    if (!producto) {
      setAviso({ tipo: 'error', texto: `Ningún producto con el código ${buscado}.` })
      return
    }
    const precio = producto.precioVenta ?? 0
    setLineas((prev) => agregarProductoALineas(prev, producto, precio))
    setAviso(
      precio > 0
        ? { tipo: 'ok', texto: `${producto.nombre} — ${formatoMoneda(precio)}` }
        : { tipo: 'error', texto: `${producto.nombre} no tiene precio de venta cargado en Stock.` },
    )
  }

  function cambiarCantidad(productoId: string | undefined, delta: number) {
    setLineas((prev) =>
      prev.flatMap((l) => {
        if (l.productoId !== productoId) return [l]
        const cantidad = l.cantidad + delta
        return cantidad > 0 ? [{ ...l, cantidad }] : []
      }),
    )
    volverAlEscaneo()
  }

  function quitarLinea(productoId: string | undefined) {
    setLineas((prev) => prev.filter((l) => l.productoId !== productoId))
    volverAlEscaneo()
  }

  function handleCobrar() {
    if (lineas.length === 0) return
    onCobrar({
      contraparte: contraparte.trim() || CONTRAPARTE_POR_DEFECTO,
      lineas,
      monto: total,
      medioPago,
      cuentaId: cuentaId || undefined,
      esInterna,
    })
    setLineas([])
    setContraparte('')
    setAviso({ tipo: 'ok', texto: `Venta de ${formatoMoneda(total)} registrada.` })
    volverAlEscaneo()
  }

  const campo = { borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }

  return (
    <div className="space-y-4">
      <Card as="section">
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Punto de venta
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Para vender en el mostrador: pasá los productos con el lector y la lista se arma sola. Al cobrar
          queda registrado un comprobante emitido y ya cobrado, con el stock descontado y la plata entrando
          a la cuenta que elijas — lo mismo que si lo cargaras a mano desde Comprobantes, pero sin frenar
          la atención.
        </p>

        {!hayProductos ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Primero cargá tus productos en Stock, con su código de barras en el campo `Código`. Sin lista de
            precios no hay nada que escanear.
          </p>
        ) : (
          <>
            <div className="relative">
              <ScanBarcode
                size={20}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                style={{ color: 'var(--series-blue)' }}
                aria-hidden="true"
              />
              <input
                ref={campoEscaneo}
                type="text"
                placeholder="Pasá el producto por el lector"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => {
                  // El Enter lo manda el lector al terminar de "tipear" el código.
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  handleEscanear()
                }}
                className="w-full rounded-lg border-2 py-3 pr-4 pl-11 text-base"
                style={{ borderColor: 'var(--series-blue)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
            </div>
            {aviso && (
              <p
                className="mt-2 text-sm"
                style={{ color: aviso.tipo === 'ok' ? 'var(--status-good-text)' : 'var(--status-critical)' }}
              >
                {aviso.texto}
              </p>
            )}
          </>
        )}
      </Card>

      {lineas.length > 0 && (
        <Card as="section">
          <ul className="space-y-1.5">
            {lineas.map((l) => {
              const producto = productos.find((p) => p.id === l.productoId)
              return (
                <li
                  key={l.productoId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="min-w-[140px] flex-1 truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                    {producto?.nombre ?? l.productoId}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconButton icon={Minus} onClick={() => cambiarCantidad(l.productoId, -1)} label="Quitar una unidad" size={14} />
                    <span className="tabular w-8 text-center text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {l.cantidad}
                    </span>
                    <IconButton icon={Plus} onClick={() => cambiarCantidad(l.productoId, 1)} label="Sumar una unidad" size={14} />
                  </div>
                  <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    × {formatoMoneda(l.precioUnitario)}
                  </span>
                  <span className="tabular w-24 shrink-0 text-right text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatoMoneda(l.cantidad * l.precioUnitario)}
                  </span>
                  <IconButton icon={Trash2} onClick={() => quitarLinea(l.productoId)} label="Quitar el producto" className="shrink-0" />
                </li>
              )
            })}
          </ul>

          <div
            className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t pt-4"
            style={{ borderColor: 'var(--gridline)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Total
            </span>
            <span className="tabular text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatoMoneda(total)}
            </span>
          </div>
        </Card>
      )}

      {lineas.length > 0 && (
        <Card as="section">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder={CONTRAPARTE_POR_DEFECTO}
              value={contraparte}
              onChange={(e) => setContraparte(e.target.value)}
              title="A quién le vendés — si lo dejás vacío queda como consumidor final"
              className="min-w-[160px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            />
            <select
              value={esInterna ? 'interna' : 'arca'}
              onChange={(e) => setEsInterna(e.target.value === 'interna')}
              title="Para ARCA: comprobante fiscal. Interna: solo queda registrada acá, no tributa."
              className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            >
              <option value="arca">Para ARCA</option>
              <option value="interna">Interna (no tributa)</option>
            </select>
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as MedioPago)}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            >
              {(Object.keys(MEDIOS_PAGO_LABEL) as MedioPago[])
                // Un cheque en el mostrador no es una venta de paso: se carga desde Comprobantes,
                // donde se le puede poner fecha de cobro y seguimiento.
                .filter((m) => m !== 'cheque')
                .map((m) => (
                  <option key={m} value={m}>
                    {MEDIOS_PAGO_LABEL[m]}
                  </option>
                ))}
            </select>
            {cuentas.length > 0 && (
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                title="En qué caja o cuenta entra la plata"
                className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              >
                <option value="">Sin registrar en Tesorería</option>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleCobrar}
              className="ml-auto shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--series-blue)' }}
            >
              Cobrar {formatoMoneda(total)}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
