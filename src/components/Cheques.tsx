import { useState } from 'react'
import { Download, FileUp, Pencil, Receipt, Trash2 } from 'lucide-react'
import type { Cheque, CuentaBancaria, EstadoCheque, Factura, TipoCheque } from '../lib/cfo'
import { calcularTotalesCheques, estadosChequeDisponibles, etiquetaEstadoCheque, montoNetoCheque } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'
import { Card } from './Card'
import { Button } from './Button'
import { importarChequesDesdeExcel } from '../lib/excelImport'
import { descargarPlantillaCheques } from '../lib/plantillasImportacion'

interface Props {
  cheques: Cheque[]
  facturas: Factura[]
  /** Cuentas bancarias/caja (plan Full) para elegir dónde entra/sale la plata cuando el cheque se
   * cobra o se vende. */
  cuentas?: CuentaBancaria[]
  onAgregar: (cheque: Omit<Cheque, 'id'>) => void
  onCambiarEstado: (id: string, estado: EstadoCheque) => void
  onCambiarCuenta: (id: string, cuentaId: string | undefined) => void
  onCambiarComision: (id: string, comisionDescuento: number) => void
  /** Corregir los datos del cheque: número, banco, a nombre de quién, importe y fechas. */
  onEditar: (id: string, cambios: Partial<Pick<Cheque, 'numero' | 'banco' | 'contraparte' | 'monto' | 'fechaEmision' | 'fechaCobro'>>) => void
  onEliminar: (id: string) => void
}

const campoEdicion = {
  borderColor: 'var(--border)',
  background: 'var(--surface-1)',
  color: 'var(--text-primary)',
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function Cheques({ cheques, facturas, cuentas, onAgregar, onCambiarEstado, onCambiarCuenta, onCambiarComision, onEditar, onEliminar }: Props) {
  const [tipo, setTipo] = useState<TipoCheque>('recibido')
  const [importando, setImportando] = useState(false)
  /** Qué cheque se está corrigiendo, con sus valores provisorios. */
  const [editando, setEditando] = useState<{
    id: string
    numero: string
    banco: string
    contraparte: string
    monto: number
    fechaEmision: string
    fechaCobro: string
  } | null>(null)

  function abrirEdicion(c: Cheque) {
    setEditando({
      id: c.id,
      numero: c.numero ?? '',
      banco: c.banco,
      contraparte: c.contraparte,
      monto: c.monto,
      fechaEmision: c.fechaEmision,
      fechaCobro: c.fechaCobro,
    })
  }

  function guardarEdicion() {
    if (!editando) return
    if (!editando.contraparte.trim() || editando.monto <= 0 || !editando.fechaCobro) return
    onEditar(editando.id, {
      numero: editando.numero.trim() || undefined,
      banco: editando.banco.trim(),
      contraparte: editando.contraparte.trim(),
      monto: editando.monto,
      fechaEmision: editando.fechaEmision,
      fechaCobro: editando.fechaCobro,
    })
    setEditando(null)
  }
  const [mensajeImport, setMensajeImport] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [numero, setNumero] = useState('')
  const [banco, setBanco] = useState('')
  const [contraparte, setContraparte] = useState('')
  const [monto, setMonto] = useState(0)
  const [fechaEmision, setFechaEmision] = useState(hoyISO)
  const [fechaCobro, setFechaCobro] = useState(hoyISO)
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<Set<string>>(new Set())
  const [busquedaFactura, setBusquedaFactura] = useState('')

  const totales = calcularTotalesCheques(cheques)
  const listado = [...cheques].sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))

  // No se exige que la factura esté sin cobrar/pagar: muchos cargan el comprobante ya marcado
  // como cumplido y recién después arman el cheque que lo cubre, para dejar el registro de con
  // qué cheque puntual se saldó.
  const facturasCubiertas = new Set(cheques.flatMap((c) => c.facturasIds ?? []))
  const facturasElegibles = facturas.filter(
    (f) =>
      f.tipo === (tipo === 'recibido' ? 'emitida' : 'recibida') &&
      f.tipoComprobante !== 'nota_credito' &&
      !facturasCubiertas.has(f.id),
  )
  const textoBusqueda = busquedaFactura.trim().toLowerCase()
  const facturasFiltradas = textoBusqueda
    ? facturasElegibles.filter(
        (f) => f.contraparte.toLowerCase().includes(textoBusqueda) || f.numero?.toLowerCase().includes(textoBusqueda),
      )
    : facturasElegibles

  function cambiarTipo(nuevoTipo: TipoCheque) {
    setTipo(nuevoTipo)
    setFacturasSeleccionadas(new Set())
    setBusquedaFactura('')
  }

  function alternarFactura(id: string) {
    setFacturasSeleccionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const total = facturasElegibles.filter((f) => next.has(f.id)).reduce((s, f) => s + f.monto, 0)
      if (next.size > 0) setMonto(total)
      return next
    })
  }

  /**
   * Alta masiva desde la chequera en Excel.
   *
   * Entran todos como "en cartera": un cheque que ya se cobró o se pagó no hace falta importarlo,
   * porque su plata ya está en el saldo de la cuenta. Importarlo como cobrado la sumaría de nuevo.
   */
  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    setImportando(true)
    setMensajeImport(null)
    try {
      const filas = await importarChequesDesdeExcel(file)
      if (filas.length === 0) {
        setMensajeImport({ tipo: 'error', texto: 'No se encontraron cheques válidos en el archivo.' })
      } else {
        for (const f of filas) onAgregar({ ...f, tipo, estado: 'cartera' })
        setMensajeImport({
          tipo: 'ok',
          texto: `Se importaron ${filas.length} cheques ${tipo === 'emitido' ? 'emitidos' : 'recibidos'}.`,
        })
      }
    } catch (err) {
      setMensajeImport({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo leer el archivo.' })
    } finally {
      setImportando(false)
      inputEl.value = ''
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!banco.trim() || !contraparte.trim() || !monto || monto <= 0 || !fechaEmision || !fechaCobro) return
    onAgregar({
      tipo,
      numero: numero.trim() || undefined,
      banco: banco.trim(),
      contraparte: contraparte.trim(),
      monto,
      fechaEmision,
      fechaCobro,
      estado: 'cartera',
      facturasIds: facturasSeleccionadas.size > 0 ? [...facturasSeleccionadas] : undefined,
    })
    setNumero('')
    setBanco('')
    setContraparte('')
    setMonto(0)
    setFacturasSeleccionadas(new Set())
  }

  return (
    <div className="space-y-6">
      <Card as="section">
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Cheques
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cheques de terceros que recibiste y cheques propios que emitiste. Un recibido lo podés cobrar al
          vencimiento, o venderlo (descontarlo) antes en un banco a cambio de una comisión. Junto con tus
          cuentas bancarias, es la base para armar un balance contable a fin de año.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            <FileUp size={14} aria-hidden="true" />
            {importando ? 'Importando…' : `Importar ${tipo === 'emitido' ? 'emitidos' : 'recibidos'} desde Excel`}
            <input type="file" accept=".xlsx,.xls" onChange={handleImportar} className="hidden" disabled={importando} />
          </label>
          <button
            type="button"
            onClick={() => descargarPlantillaCheques(tipo)}
            className="inline-flex items-center gap-1 text-[11px] font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            <Download size={11} aria-hidden="true" /> Descargar plantilla
          </button>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Importa los del tipo elegido abajo. Entran todos en cartera.
          </span>
        </div>

        {mensajeImport && (
          <p
            className="mb-3 text-xs"
            style={{ color: mensajeImport.tipo === 'ok' ? 'var(--status-good-text)' : 'var(--status-critical)' }}
          >
            {mensajeImport.texto}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => cambiarTipo(e.target.value as TipoCheque)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="recibido">Recibido (de un cliente)</option>
            <option value="emitido">Emitido (a un proveedor)</option>
          </select>
          <input
            type="text"
            placeholder="Banco"
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            className="min-w-[120px] shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
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
            placeholder="Cliente / proveedor"
            value={contraparte}
            onChange={(e) => setContraparte(e.target.value)}
            className="min-w-[140px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <InputMoneda
            placeholder="Monto"
            value={monto}
            onChange={setMonto}
            className="tabular w-28 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <label className="flex shrink-0 items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Emisión
            <input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
          </label>
          <label className="flex shrink-0 items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Cobro
            <input
              type="date"
              value={fechaCobro}
              onChange={(e) => setFechaCobro(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
          </label>
          <Button type="submit" variante="primario">
            Agregar
          </Button>
        </form>

        {facturasElegibles.length > 0 && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--gridline)' }}>
            <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {tipo === 'recibido' ? 'Facturas de venta que cobra este cheque' : 'Facturas de compra que paga este cheque'}{' '}
              <span style={{ color: 'var(--text-secondary)' }}>(opcional)</span>
            </p>
            <input
              type="text"
              placeholder="Buscar por cliente/proveedor o número…"
              value={busquedaFactura}
              onChange={(e) => setBusquedaFactura(e.target.value)}
              className="mb-2 w-full rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            {facturasFiltradas.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay facturas que coincidan con la búsqueda.
              </p>
            ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {facturasFiltradas.map((f) => (
                <li key={f.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={facturasSeleccionadas.has(f.id)}
                      onChange={() => alternarFactura(f.id)}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="min-w-[100px] flex-1 truncate">{f.contraparte}</span>
                    <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(`${f.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className="tabular shrink-0 font-medium">{formatoMoneda(f.monto)}</span>
                  </label>
                </li>
              ))}
            </ul>
            )}
            {facturasSeleccionadas.size > 0 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--series-blue)' }}>
                {facturasSeleccionadas.size} factura(s) seleccionada(s) — el monto de arriba se completó con su total.
                Al agregar el cheque quedan marcadas como {tipo === 'recibido' ? 'cobradas' : 'pagadas'}.
              </p>
            )}
          </div>
        )}
      </Card>

      {cheques.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ningún cheque.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card padding="sm">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Recibidos en cartera
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(totales.recibidosEnCartera)}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Emitidos en cartera
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(totales.emitidosEnCartera)}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Saldo neto en cheques
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: totales.saldoNetoCheques >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
              >
                {formatoMoneda(totales.saldoNetoCheques)}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Comisiones pagadas a bancos
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: totales.totalComisionesDescuento > 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}
              >
                {formatoMoneda(totales.totalComisionesDescuento)}
              </p>
            </Card>
          </section>

          <Card as="section">
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Cheques cargados
            </h3>
            <ul className="max-h-96 space-y-1.5 overflow-y-auto">
              {listado.map((c) =>
                editando?.id === c.id ? (
                  <li key={c.id} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--series-blue)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editando.banco}
                        onChange={(e) => setEditando({ ...editando, banco: e.target.value })}
                        aria-label="Banco"
                        placeholder="Banco"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') guardarEdicion()
                          if (e.key === 'Escape') setEditando(null)
                        }}
                        className="w-32 shrink-0 rounded-lg border px-2 py-1 text-sm"
                        style={campoEdicion}
                      />
                      <input
                        type="text"
                        value={editando.numero}
                        onChange={(e) => setEditando({ ...editando, numero: e.target.value })}
                        aria-label="Número"
                        placeholder="Número"
                        className="w-28 shrink-0 rounded-lg border px-2 py-1 text-sm"
                        style={campoEdicion}
                      />
                      <input
                        type="text"
                        value={editando.contraparte}
                        onChange={(e) => setEditando({ ...editando, contraparte: e.target.value })}
                        aria-label="Cliente / proveedor"
                        className="min-w-[140px] flex-1 rounded-lg border px-2 py-1 text-sm"
                        style={campoEdicion}
                      />
                      <InputMoneda
                        value={editando.monto}
                        onChange={(v) => setEditando({ ...editando, monto: v })}
                        aria-label="Monto"
                        className="tabular w-28 shrink-0 rounded-lg border px-2 py-1 text-sm"
                        style={campoEdicion}
                      />
                      <label className="shrink-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Emisión
                        <input
                          type="date"
                          value={editando.fechaEmision}
                          onChange={(e) => setEditando({ ...editando, fechaEmision: e.target.value })}
                          className="ml-1 rounded-lg border px-2 py-1 text-sm"
                          style={campoEdicion}
                        />
                      </label>
                      <label className="shrink-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Cobro
                        <input
                          type="date"
                          value={editando.fechaCobro}
                          onChange={(e) => setEditando({ ...editando, fechaCobro: e.target.value })}
                          className="ml-1 rounded-lg border px-2 py-1 text-sm"
                          style={campoEdicion}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={guardarEdicion}
                        className="shrink-0 rounded-lg px-3 py-1 text-xs font-semibold text-white"
                        style={{ background: 'var(--series-blue)' }}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="shrink-0 text-xs font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                    {c.facturasIds && c.facturasIds.length > 0 && (
                      <p className="mt-1.5 text-[11px]" style={{ color: 'var(--status-warning)' }}>
                        Este cheque abona {c.facturasIds.length} comprobante{c.facturasIds.length === 1 ? '' : 's'}.
                        Si cambiás el importe, revisá que siga cubriéndolos: lo que se imputó a esas facturas no
                        se recalcula solo.
                      </p>
                    )}
                  </li>
                ) : (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', opacity: c.estado === 'rechazado' ? 0.6 : 1 }}
                >
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'var(--gridline)', color: 'var(--text-secondary)' }}
                  >
                    {c.tipo === 'recibido' ? 'Recibido' : 'Emitido'}
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.banco}
                    {c.numero && ` (${c.numero})`}
                  </span>
                  <span className="min-w-[100px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {c.contraparte}
                    {c.facturasIds && c.facturasIds.length > 0 && (
                      <span
                        className="ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: 'var(--gridline)', color: 'var(--text-muted)' }}
                        title="Facturas que abona este cheque"
                      >
                        <Receipt size={10} aria-hidden="true" /> {c.facturasIds.length}
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Cobro {new Date(`${c.fechaCobro}T00:00:00`).toLocaleDateString('es-AR')}
                  </span>
                  <select
                    value={c.estado}
                    onChange={(e) => onCambiarEstado(c.id, e.target.value as EstadoCheque)}
                    className="shrink-0 rounded-lg border px-2 py-1 text-xs"
                    style={{
                      borderColor: c.estado === 'rechazado' ? 'var(--status-critical)' : 'var(--border)',
                      background: 'var(--surface-1)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {estadosChequeDisponibles(c.tipo).map((estado) => (
                      <option key={estado} value={estado}>
                        {etiquetaEstadoCheque(estado, c.tipo)}
                      </option>
                    ))}
                  </select>
                  {(c.estado === 'cobrado' || c.estado === 'vendido') && cuentas && cuentas.length > 0 && (
                    <select
                      value={c.cuentaId ?? ''}
                      onChange={(e) => onCambiarCuenta(c.id, e.target.value || undefined)}
                      title="En qué caja o cuenta entró/salió la plata"
                      className="shrink-0 rounded-lg border px-2 py-1 text-xs"
                      style={{
                        borderColor: c.cuentaId ? 'var(--border)' : 'var(--status-warning)',
                        background: 'var(--surface-1)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">Cuenta…</option>
                      {cuentas.map((cta) => (
                        <option key={cta.id} value={cta.id}>
                          {cta.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                  {c.estado === 'vendido' && (
                    <label className="flex shrink-0 items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Comisión banco
                      <InputMoneda
                        value={c.comisionDescuento ?? 0}
                        onChange={(v) => onCambiarComision(c.id, v)}
                        className="tabular w-24 rounded border px-1.5 py-0.5 text-xs"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                      />
                    </label>
                  )}
                  {c.estado === 'vendido' ? (
                    <span
                      className="tabular shrink-0 font-medium"
                      style={{ color: c.tipo === 'emitido' ? 'var(--status-critical)' : 'var(--text-primary)' }}
                      title={`Bruto ${formatoMoneda(c.monto)} − comisión ${formatoMoneda(c.comisionDescuento ?? 0)}`}
                    >
                      {formatoMoneda(montoNetoCheque(c))} neto
                    </span>
                  ) : (
                    <span
                      className="tabular shrink-0 font-medium"
                      style={{ color: c.tipo === 'emitido' ? 'var(--status-critical)' : 'var(--text-primary)' }}
                    >
                      {formatoMoneda(c.monto)}
                    </span>
                  )}
                  <IconButton icon={Pencil} onClick={() => abrirEdicion(c)} label="Editar cheque" className="shrink-0" />
                  <IconButton icon={Trash2} onClick={() => onEliminar(c.id)} label="Eliminar cheque" className="shrink-0" />
                </li>
                ),
              )}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
