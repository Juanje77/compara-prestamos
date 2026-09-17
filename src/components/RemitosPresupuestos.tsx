import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { CuentaBancaria, Factura, LineaProducto, MedioPago, Producto, RemitoConSaldo, Sector, TipoDocumentoAnticipo, TipoFactura } from '../lib/cfo'
import { MEDIOS_PAGO_LABEL, calcularMontoDesdeLineas } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'
import { Card } from './Card'
import { Button } from './Button'

interface Props {
  remitosCobrar: RemitoConSaldo[]
  remitosPagar: RemitoConSaldo[]
  facturas: Factura[]
  productos: Producto[]
  /** Sectores (divisiones/centros de costo) creados en Márgenes por sector, para asignar cada
   * remito a uno al cargarlo — ver calcularMargenPorSector. */
  sectores: Sector[]
  /** Clientes y proveedores ya cargados en Comprobantes, para sugerir mientras se escribe y usar
   * siempre el mismo nombre exacto — así la cuenta corriente y la vinculación a factura los
   * reconocen sin depender de tipeo. */
  contrapartesClientes: string[]
  contrapartesProveedores: string[]
  /** Cuentas bancarias/caja (plan Full) para elegir por dónde entró/salió cada anticipo. */
  cuentasBancarias?: CuentaBancaria[]
  onAgregar: (remito: {
    tipo: TipoFactura
    tipoDocumento: TipoDocumentoAnticipo
    contraparte: string
    monto: number
    fecha: string
    numero?: string
    lineas?: LineaProducto[]
    sectorId?: string
  }) => void
  onRegistrarAnticipo: (
    remitoId: string,
    monto: number,
    fecha: string,
    medioPago: MedioPago | undefined,
    cuentaId?: string,
  ) => void
  onVincularFactura: (remitoId: string, facturaId: string) => void
  onEliminar: (id: string) => void
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const DOCUMENTO_LABEL: Record<TipoDocumentoAnticipo, string> = {
  remito: 'Remito',
  presupuesto: 'Presupuesto',
}

function TarjetaRemito({
  remito,
  facturasDisponibles,
  cuentasBancarias,
  nombreSector,
  onRegistrarAnticipo,
  onVincularFactura,
  onEliminar,
}: {
  remito: RemitoConSaldo
  facturasDisponibles: Factura[]
  cuentasBancarias?: CuentaBancaria[]
  nombreSector?: string
  onRegistrarAnticipo: Props['onRegistrarAnticipo']
  onVincularFactura: Props['onVincularFactura']
  onEliminar: Props['onEliminar']
}) {
  const [monto, setMonto] = useState(0)
  const [fecha, setFecha] = useState(hoyISO)
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [cuentaId, setCuentaId] = useState('')
  const [facturaElegida, setFacturaElegida] = useState('')

  function handleSubmitAnticipo(e: React.FormEvent) {
    e.preventDefault()
    if (!monto || monto <= 0) return
    onRegistrarAnticipo(remito.id, monto, fecha, medioPago || undefined, cuentaId || undefined)
    setMonto(0)
  }

  function handleVincular() {
    if (!facturaElegida) return
    onVincularFactura(remito.id, facturaElegida)
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          <span
            className="mr-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
          >
            {DOCUMENTO_LABEL[remito.tipoDocumento]}
          </span>
          {remito.contraparte}
          {remito.numero && (
            <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              ({remito.numero})
            </span>
          )}
          {nombreSector && (
            <span
              className="ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'color-mix(in srgb, var(--series-blue) 14%, transparent)', color: 'var(--series-blue)' }}
            >
              {nombreSector}
            </span>
          )}
        </p>
        <IconButton icon={Trash2} onClick={() => onEliminar(remito.id)} label="Eliminar" className="shrink-0" />
      </div>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        {new Date(`${remito.fecha}T00:00:00`).toLocaleDateString('es-AR')} · Total {formatoMoneda(remito.monto)} · Anticipado{' '}
        {formatoMoneda(remito.montoAnticipado)}
        {remito.lineas && remito.lineas.length > 0 && ` · ${remito.lineas.length} ítem(s)`}
      </p>
      <p className="tabular mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {formatoMoneda(remito.saldo)} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>saldo sin anticipar</span>
      </p>

      <form onSubmit={handleSubmitAnticipo} className="mt-3 flex flex-wrap gap-2">
        <InputMoneda
          placeholder="Monto del anticipo"
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
        <select
          value={medioPago}
          onChange={(e) => setMedioPago(e.target.value as MedioPago | '')}
          className="shrink-0 rounded-lg border px-2 py-1 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          <option value="">Medio…</option>
          {(Object.keys(MEDIOS_PAGO_LABEL) as MedioPago[]).map((m) => (
            <option key={m} value={m}>
              {MEDIOS_PAGO_LABEL[m]}
            </option>
          ))}
        </select>
        {medioPago && medioPago !== 'cheque' && cuentasBancarias && cuentasBancarias.length > 0 && (
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="shrink-0 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="">Cuenta…</option>
            {cuentasBancarias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" variante="primario">
          Registrar anticipo
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--gridline)' }}>
        <select
          value={facturaElegida}
          onChange={(e) => setFacturaElegida(e.target.value)}
          className="min-w-[180px] flex-1 rounded-lg border px-2 py-1 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          <option value="">
            {facturasDisponibles.length === 0 ? 'Todavía no hay factura de este cliente/proveedor' : 'Vincular a la factura final…'}
          </option>
          {facturasDisponibles.map((f) => (
            <option key={f.id} value={f.id}>
              {f.numero ? `${f.numero} · ` : ''}
              {formatoMoneda(f.monto)} ({new Date(`${f.fecha}T00:00:00`).toLocaleDateString('es-AR')})
            </option>
          ))}
        </select>
        <button
          onClick={handleVincular}
          disabled={!facturaElegida}
          className="shrink-0 rounded-lg border px-3 py-1 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
        >
          Vincular
        </button>
      </div>
      {remito.montoAnticipado > 0 && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Al vincular, los {formatoMoneda(remito.montoAnticipado)} ya anticipados pasan a ser pago de esa factura.
        </p>
      )}
    </Card>
  )
}

function Columna({
  titulo,
  remitos,
  facturas,
  cuentasBancarias,
  sectores,
  onRegistrarAnticipo,
  onVincularFactura,
  onEliminar,
}: {
  titulo: string
  remitos: RemitoConSaldo[]
  facturas: Factura[]
  cuentasBancarias?: CuentaBancaria[]
  sectores: Sector[]
  onRegistrarAnticipo: Props['onRegistrarAnticipo']
  onVincularFactura: Props['onVincularFactura']
  onEliminar: Props['onEliminar']
}) {
  if (remitos.length === 0) {
    return (
      <Card>
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {titulo}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No hay remitos ni presupuestos cargados.
        </p>
      </Card>
    )
  }
  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        {titulo}
      </h3>
      <div className="max-h-[36rem] space-y-3 overflow-y-auto">
        {remitos.map((r) => (
          <TarjetaRemito
            key={r.id}
            remito={r}
            facturasDisponibles={facturas.filter((f) => f.contraparte === r.contraparte && f.tipo === r.tipo && f.tipoComprobante === 'factura')}
            cuentasBancarias={cuentasBancarias}
            nombreSector={sectores.find((s) => s.id === r.sectorId)?.nombre}
            onRegistrarAnticipo={onRegistrarAnticipo}
            onVincularFactura={onVincularFactura}
            onEliminar={onEliminar}
          />
        ))}
      </div>
    </Card>
  )
}

export function RemitosPresupuestos({
  remitosCobrar,
  remitosPagar,
  facturas,
  productos,
  sectores,
  contrapartesClientes,
  contrapartesProveedores,
  cuentasBancarias,
  onAgregar,
  onRegistrarAnticipo,
  onVincularFactura,
  onEliminar,
}: Props) {
  const [tipo, setTipo] = useState<TipoFactura>('emitida')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoAnticipo>('remito')
  const [contraparte, setContraparte] = useState('')
  const [numero, setNumero] = useState('')
  const [monto, setMonto] = useState(0)
  const [fecha, setFecha] = useState(hoyISO)
  const [sectorId, setSectorId] = useState('')
  const [lineas, setLineas] = useState<LineaProducto[]>([])
  const [tipoLinea, setTipoLinea] = useState<'producto' | 'otro'>('producto')
  const [productoElegido, setProductoElegido] = useState('')
  const [descripcionLinea, setDescripcionLinea] = useState('')
  const [cantidadLinea, setCantidadLinea] = useState(0)
  const [precioLinea, setPrecioLinea] = useState(0)

  const usaLineas = tipoDocumento === 'remito'
  const puedeElegirProducto = productos.length > 0
  const montoDesdeLineas = lineas.length > 0 ? calcularMontoDesdeLineas(lineas) : null

  function handleTipoDocumentoChange(nuevo: TipoDocumentoAnticipo) {
    setTipoDocumento(nuevo)
    if (nuevo !== 'remito') setLineas([])
  }

  function handleElegirProducto(id: string) {
    setProductoElegido(id)
    const producto = productos.find((p) => p.id === id)
    if (producto) setPrecioLinea((tipo === 'emitida' ? producto.precioVenta : producto.costoUnitario) ?? 0)
  }

  function limpiarFormularioLinea() {
    setProductoElegido('')
    setDescripcionLinea('')
    setCantidadLinea(0)
    setPrecioLinea(0)
  }

  function handleAgregarLinea() {
    if (cantidadLinea <= 0) return
    if (tipoLinea === 'producto' && puedeElegirProducto) {
      if (!productoElegido) return
      setLineas((prev) => [...prev, { productoId: productoElegido, cantidad: cantidadLinea, precioUnitario: precioLinea }])
    } else {
      if (!descripcionLinea.trim()) return
      setLineas((prev) => [...prev, { descripcion: descripcionLinea.trim(), cantidad: cantidadLinea, precioUnitario: precioLinea }])
    }
    limpiarFormularioLinea()
  }

  function handleEliminarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const montoFinal = montoDesdeLineas ?? monto
    if (!contraparte.trim() || !montoFinal || montoFinal <= 0 || !fecha) return
    onAgregar({
      tipo,
      tipoDocumento,
      contraparte: contraparte.trim(),
      monto: montoFinal,
      fecha,
      numero: numero.trim() || undefined,
      lineas: lineas.length > 0 ? lineas : undefined,
      sectorId: sectorId || undefined,
    })
    setContraparte('')
    setNumero('')
    setMonto(0)
    setLineas([])
    setSectorId('')
  }

  return (
    <div className="space-y-6">
      <Card as="section">
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Remitos y presupuestos
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Para trabajos largos donde primero entregás un remito o pasás un presupuesto, cobrás un anticipo, y
          facturás todo junto al terminar. No suman a ventas/compras ni a IVA — son solo un seguimiento hasta
          que los vinculás a la factura real, momento en el que el anticipo ya cobrado pasa a ser pago de esa
          factura.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoFactura)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="emitida">A un cliente (voy a cobrar)</option>
            <option value="recibida">De un proveedor (voy a pagar)</option>
          </select>
          <select
            value={tipoDocumento}
            onChange={(e) => handleTipoDocumentoChange(e.target.value as TipoDocumentoAnticipo)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="remito">Remito</option>
            <option value="presupuesto">Presupuesto</option>
          </select>
          <input
            type="text"
            placeholder="Número (opcional)"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            list="remitos-contrapartes"
            placeholder="Cliente / proveedor"
            value={contraparte}
            onChange={(e) => setContraparte(e.target.value)}
            className="min-w-[140px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <datalist id="remitos-contrapartes">
            {(tipo === 'emitida' ? contrapartesClientes : contrapartesProveedores).map((nombre) => (
              <option key={nombre} value={nombre} />
            ))}
          </datalist>
          {sectores.length > 0 && (
            <select
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            >
              <option value="">Sin sector</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
          {montoDesdeLineas !== null ? (
            <div
              className="tabular flex w-32 shrink-0 items-center rounded-lg border px-3 py-1.5 text-sm font-semibold"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
              title="Se calcula solo a partir de las líneas de producto"
            >
              {formatoMoneda(montoDesdeLineas)}
            </div>
          ) : (
            <InputMoneda
              placeholder="Monto total"
              value={monto}
              onChange={setMonto}
              className="tabular w-32 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
          )}
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="tabular w-36 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <Button type="submit" variante="primario">
            Agregar
          </Button>
        </form>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Al tipear "Cliente / proveedor" te sugiere los que ya tenés cargados en Comprobantes — elegí uno de
          la lista para que la cuenta corriente lo reconozca, o escribí uno nuevo si todavía no facturaste con
          esta contraparte.
        </p>

        {usaLineas && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--gridline)' }}>
            <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Líneas del remito <span style={{ color: 'var(--text-secondary)' }}>(opcional)</span> — productos,
              mano de obra o cualquier otro costo del trabajo. Solo los productos {tipo === 'emitida' ? 'descuentan' : 'suman'} stock al
              guardarse; el resto suma al monto sin tocar el inventario.
            </p>
            <div className="flex flex-wrap gap-2">
              {puedeElegirProducto && (
                <select
                  value={tipoLinea}
                  onChange={(e) => {
                    setTipoLinea(e.target.value as 'producto' | 'otro')
                    limpiarFormularioLinea()
                  }}
                  className="shrink-0 rounded-lg border px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                >
                  <option value="producto">Producto</option>
                  <option value="otro">Mano de obra / otro costo</option>
                </select>
              )}
              {tipoLinea === 'producto' && puedeElegirProducto ? (
                <select
                  value={productoElegido}
                  onChange={(e) => handleElegirProducto(e.target.value)}
                  className="min-w-[160px] flex-1 rounded-lg border px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                >
                  <option value="">Elegir producto…</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (stock: {p.stockActual})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Descripción (ej: Mano de obra, Flete, Alquiler de equipo)"
                  value={descripcionLinea}
                  onChange={(e) => setDescripcionLinea(e.target.value)}
                  className="min-w-[160px] flex-1 rounded-lg border px-2 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
              )}
              <InputMoneda
                placeholder="Cantidad"
                value={cantidadLinea}
                onChange={setCantidadLinea}
                className="tabular w-24 shrink-0 rounded-lg border px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
              <InputMoneda
                placeholder="Precio unitario"
                value={precioLinea}
                onChange={setPrecioLinea}
                className="tabular w-32 shrink-0 rounded-lg border px-2 py-1.5 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={handleAgregarLinea}
                className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
              >
                Agregar línea
              </button>
            </div>

            {lineas.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {lineas.map((l, i) => {
                  const producto = l.productoId ? productos.find((p) => p.id === l.productoId) : undefined
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-lg border px-2 py-1"
                      style={{ borderColor: 'var(--gridline)' }}
                    >
                      <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                        {producto?.nombre ?? l.descripcion ?? l.productoId}
                        {!l.productoId && (
                          <span
                            className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ background: 'var(--gridline)', color: 'var(--text-muted)' }}
                          >
                            no mueve stock
                          </span>
                        )}
                      </span>
                      <span className="tabular shrink-0" style={{ color: 'var(--text-secondary)' }}>
                        {l.cantidad} × {formatoMoneda(l.precioUnitario)}
                      </span>
                      <span className="tabular shrink-0 font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatoMoneda(l.cantidad * l.precioUnitario)}
                      </span>
                      <IconButton icon={Trash2} onClick={() => handleEliminarLinea(i)} label="Quitar línea" className="shrink-0" />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Columna
          titulo="De clientes (a cobrar)"
          remitos={remitosCobrar}
          facturas={facturas}
          cuentasBancarias={cuentasBancarias}
          sectores={sectores}
          onRegistrarAnticipo={onRegistrarAnticipo}
          onVincularFactura={onVincularFactura}
          onEliminar={onEliminar}
        />
        <Columna
          titulo="De proveedores (a pagar)"
          remitos={remitosPagar}
          facturas={facturas}
          cuentasBancarias={cuentasBancarias}
          sectores={sectores}
          onRegistrarAnticipo={onRegistrarAnticipo}
          onVincularFactura={onVincularFactura}
          onEliminar={onEliminar}
        />
      </div>
    </div>
  )
}
