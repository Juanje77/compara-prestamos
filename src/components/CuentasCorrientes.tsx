import { useState } from 'react'
import type { CuentaCorrienteContraparte, MedioPago, Pago, TipoDocumentoAnticipo, TipoFactura } from '../lib/cfo'
import { MEDIOS_PAGO_LABEL } from '../lib/cfo'

const DOCUMENTO_LABEL: Record<TipoDocumentoAnticipo, string> = {
  remito: 'Remito',
  presupuesto: 'Presupuesto',
}
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'

interface Props {
  cuentasCobrar: CuentaCorrienteContraparte[]
  cuentasPagar: CuentaCorrienteContraparte[]
  pagos: Pago[]
  onAplicarPago: (contraparte: string, tipo: TipoFactura, monto: number, fecha: string, medioPago: MedioPago | undefined) => void
  onEliminarPago: (id: string) => void
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function TarjetaContraparte({
  grupo,
  tipo,
  pagos,
  onAplicarPago,
  onEliminarPago,
}: {
  grupo: CuentaCorrienteContraparte
  tipo: TipoFactura
  pagos: Pago[]
  onAplicarPago: Props['onAplicarPago']
  onEliminarPago: Props['onEliminarPago']
}) {
  const [monto, setMonto] = useState(0)
  const [fecha, setFecha] = useState(hoyISO)
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [expandido, setExpandido] = useState(false)

  const idsFacturas = new Set(grupo.facturas.map((f) => f.id))
  const pagosDeEstaCuenta = pagos.filter((p) => idsFacturas.has(p.facturaId)).sort((a, b) => b.fecha.localeCompare(a.fecha))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!monto || monto <= 0) return
    onAplicarPago(grupo.contraparte, tipo, monto, fecha, medioPago || undefined)
    setMonto(0)
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {grupo.contraparte}
        </p>
        <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatoMoneda(grupo.saldo)}
        </p>
      </div>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        Facturado {formatoMoneda(grupo.totalFacturado)} · Pagado/anticipado {formatoMoneda(grupo.totalPagado)} ·{' '}
        {grupo.facturas.length} factura{grupo.facturas.length === 1 ? '' : 's'} pendiente
        {grupo.facturas.length === 1 ? '' : 's'}
        {grupo.remitos.length > 0 &&
          ` · ${grupo.remitos.length} remito/presupuesto${grupo.remitos.length === 1 ? '' : 's'} sin facturar`}
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
        <InputMoneda
          placeholder="Monto"
          value={monto}
          onChange={setMonto}
          className="tabular w-28 shrink-0 rounded-lg border px-2 py-1 text-sm"
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
        <button
          type="submit"
          className="shrink-0 rounded-lg px-3 py-1 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--series-blue)' }}
        >
          Registrar pago
        </button>
      </form>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Se aplica primero a la factura pendiente más antigua
        {grupo.remitos.length > 0 && ' (no a los remitos/presupuestos, que se anticipan desde su propia solapa)'}.
      </p>

      <button
        onClick={() => setExpandido((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: 'var(--text-secondary)' }}
      >
        {expandido ? '▾' : '▸'} Ver detalle ({grupo.facturas.length} factura{grupo.facturas.length === 1 ? '' : 's'}
        {pagosDeEstaCuenta.length > 0 ? `, ${pagosDeEstaCuenta.length} pago(s)` : ''}
        {grupo.remitos.length > 0 ? `, ${grupo.remitos.length} remito/presupuesto(s)` : ''})
      </button>

      {expandido && (
        <div className="mt-2 space-y-3">
          <ul className="space-y-1 text-xs">
            {grupo.facturas.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
                style={{ borderColor: 'var(--gridline)' }}
              >
                <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {new Date(`${f.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
                {f.numero && (
                  <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {f.numero}
                  </span>
                )}
                <span className="tabular flex-1" style={{ color: 'var(--text-secondary)' }}>
                  {formatoMoneda(f.monto)} total
                </span>
                {f.montoPagado > 0 && (
                  <span className="tabular shrink-0" style={{ color: 'var(--status-good-text)' }}>
                    {formatoMoneda(f.montoPagado)} pagado
                  </span>
                )}
                <span className="tabular shrink-0 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatoMoneda(f.saldo)} saldo
                </span>
              </li>
            ))}
          </ul>
          {grupo.remitos.length > 0 && (
            <ul className="space-y-1 text-xs">
              {grupo.remitos.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
                  style={{ borderColor: 'var(--gridline)' }}
                >
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
                  >
                    {DOCUMENTO_LABEL[r.tipoDocumento]}
                  </span>
                  <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="tabular flex-1" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(r.monto)} total
                  </span>
                  {r.montoAnticipado > 0 && (
                    <span className="tabular shrink-0" style={{ color: 'var(--status-good-text)' }}>
                      {formatoMoneda(r.montoAnticipado)} anticipado
                    </span>
                  )}
                  <span className="tabular shrink-0 font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatoMoneda(r.saldo)} saldo
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pagosDeEstaCuenta.length > 0 && (
            <ul className="space-y-1 text-xs">
              {pagosDeEstaCuenta.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 rounded border px-2 py-1"
                  style={{ borderColor: 'var(--gridline)' }}
                >
                  <span style={{ color: 'var(--status-good-text)' }}>✓</span>
                  <span className="tabular shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {new Date(`${p.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="tabular flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatoMoneda(p.monto)}
                  </span>
                  {p.medioPago && <span style={{ color: 'var(--text-muted)' }}>{MEDIOS_PAGO_LABEL[p.medioPago]}</span>}
                  <button onClick={() => onEliminarPago(p.id)} aria-label="Eliminar pago" style={{ color: 'var(--text-muted)' }}>
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Columna({
  titulo,
  grupos,
  tipo,
  pagos,
  onAplicarPago,
  onEliminarPago,
}: {
  titulo: string
  grupos: CuentaCorrienteContraparte[]
  tipo: TipoFactura
  pagos: Pago[]
  onAplicarPago: Props['onAplicarPago']
  onEliminarPago: Props['onEliminarPago']
}) {
  const [busqueda, setBusqueda] = useState('')
  const texto = busqueda.trim().toLowerCase()
  const filtrados = texto ? grupos.filter((g) => g.contraparte.toLowerCase().includes(texto)) : grupos
  const totalSaldo = grupos.reduce((s, g) => s + g.saldo, 0)

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {titulo}
        </h3>
        <span className="tabular text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {formatoMoneda(totalSaldo)}
        </span>
      </div>
      {grupos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No hay saldos pendientes.
        </p>
      ) : (
        <>
          {grupos.length > 4 && (
            <input
              type="text"
              placeholder="Buscar cliente/proveedor…"
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
            <div className="max-h-[32rem] space-y-3 overflow-y-auto">
              {filtrados.map((g) => (
                <TarjetaContraparte
                  key={g.contraparte}
                  grupo={g}
                  tipo={tipo}
                  pagos={pagos}
                  onAplicarPago={onAplicarPago}
                  onEliminarPago={onEliminarPago}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function CuentasCorrientes({ cuentasCobrar, cuentasPagar, pagos, onAplicarPago, onEliminarPago }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Saldo pendiente por cliente y proveedor, sumando tanto las facturas cargadas en Comprobantes como los
        remitos y presupuestos todavía sin facturar (con lo que ya anticiparon). Registrá un pago a cuenta y
        se va imputando automáticamente a la factura pendiente más antigua de esa cuenta — así podés ir
        cancelando una deuda grande de a partes, sin tener que marcar cada factura entera como cobrada o
        pagada. Los anticipos de remitos/presupuestos se cargan desde su propia solapa.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Columna
          titulo="Cuentas por cobrar"
          grupos={cuentasCobrar}
          tipo="emitida"
          pagos={pagos}
          onAplicarPago={onAplicarPago}
          onEliminarPago={onEliminarPago}
        />
        <Columna
          titulo="Cuentas por pagar"
          grupos={cuentasPagar}
          tipo="recibida"
          pagos={pagos}
          onAplicarPago={onAplicarPago}
          onEliminarPago={onEliminarPago}
        />
      </div>
    </div>
  )
}
