import { useMemo, useState } from 'react'
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Factura, ResumenMensual, TipoComprobante, TipoFactura } from '../lib/cfo'
import {
  MEDIOS_PAGO_LABEL,
  calcularMargenBrutoTotal,
  calcularRanking,
  calcularResumenMensual,
  ivaConSigno,
  montoConSigno,
  montoNetoConSigno,
  sumarDias,
  type MedioPago,
} from '../lib/cfo'
import { importarComprobantesArca } from '../lib/arcaImport'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'

interface Props {
  facturas: Factura[]
  onAgregar: (factura: Omit<Factura, 'id'>) => void
  onImportarVarias: (facturas: Omit<Factura, 'id'>[]) => void
  onCambiar: (id: string, cambios: Partial<Pick<Factura, 'fechaEstimadaCobroPago' | 'cumplido' | 'medioPago'>>) => void
  onEliminar: (id: string) => void
  onVaciar: () => void
  onDescargarInforme: () => void
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

const COLORES_RANKING = [
  'var(--series-blue)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
]

function RankingTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <p className="font-semibold">{payload[0].name}</p>
      <p className="tabular" style={{ color: 'var(--text-secondary)' }}>
        {formatoMoneda(payload[0].value)}
      </p>
    </div>
  )
}

function EvolucionTooltip({ active, payload }: { active?: boolean; payload?: { payload: ResumenMensual }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const r = payload[0].payload
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
    >
      <p className="mb-1 font-semibold capitalize">{mesLegible(r.mes)}</p>
      <p className="tabular" style={{ color: 'var(--series-blue)' }}>
        Ventas: {formatoMoneda(r.ventasNetas)}
      </p>
      <p className="tabular" style={{ color: 'var(--series-2)' }}>
        Compras: {formatoMoneda(r.comprasNetas)}
      </p>
    </div>
  )
}

export function Facturas({ facturas, onAgregar, onImportarVarias, onCambiar, onEliminar, onVaciar, onDescargarInforme }: Props) {
  const [tipo, setTipo] = useState<TipoFactura>('emitida')
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobante>('factura')
  const [contraparte, setContraparte] = useState('')
  const [monto, setMonto] = useState('')
  const [iva, setIva] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [cuotas, setCuotas] = useState('1')
  const [filtro, setFiltro] = useState<'todas' | TipoFactura>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [importando, setImportando] = useState(false)
  const [mensajeImport, setMensajeImport] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [plazoDias, setPlazoDias] = useState(30)

  const resumenMensual = useMemo(() => calcularResumenMensual(facturas), [facturas])
  const rankingClientes = useMemo(() => calcularRanking(facturas, 'emitida'), [facturas])
  const rankingProveedores = useMemo(() => calcularRanking(facturas, 'recibida'), [facturas])
  const margenTotal = useMemo(() => calcularMargenBrutoTotal(facturas), [facturas])
  const ivaTotales = useMemo(() => {
    let netoVentas = 0
    let ivaVentas = 0
    let netoCompras = 0
    let ivaCompras = 0
    for (const f of facturas) {
      if (f.tipo === 'emitida') {
        netoVentas += montoNetoConSigno(f)
        ivaVentas += ivaConSigno(f)
      } else {
        netoCompras += montoNetoConSigno(f)
        ivaCompras += ivaConSigno(f)
      }
    }
    return { netoVentas, ivaVentas, netoCompras, ivaCompras }
  }, [facturas])

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const listado = facturas
    .filter((f) => filtro === 'todas' || f.tipo === filtro)
    .filter(
      (f) =>
        !busquedaNormalizada ||
        f.contraparte.toLowerCase().includes(busquedaNormalizada) ||
        (f.numero ?? '').toLowerCase().includes(busquedaNormalizada),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(monto)
    const ivaNum = Number(iva)
    const cuotasNum = Math.max(1, Math.round(Number(cuotas) || 1))
    if (!contraparte.trim() || !m || m <= 0 || !fecha) return
    onAgregar({
      tipo,
      tipoComprobante,
      contraparte: contraparte.trim(),
      monto: m,
      fecha,
      fechaEstimadaCobroPago: sumarDias(fecha, plazoDias),
      cumplido: false,
      cuotas: cuotasNum > 1 ? cuotasNum : undefined,
      iva: ivaNum > 0 ? ivaNum : undefined,
    })
    setContraparte('')
    setMonto('')
    setIva('')
    setCuotas('1')
  }

  function handleVaciar() {
    if (facturas.length === 0) return
    if (!window.confirm('¿Borrar todos los comprobantes cargados? No se puede deshacer.')) return
    onVaciar()
  }

  async function handleImportarArca(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    setMensajeImport(null)
    setImportando(true)
    try {
      const { facturas: importadas, omitidas } = await importarComprobantesArca(file, plazoDias)
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
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Salud financiera con tus comprobantes
          </h2>
          {facturas.length > 0 && (
            <button
              onClick={onDescargarInforme}
              className="shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              📊 Descargar informe en PDF
            </button>
          )}
        </div>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ventas y compras netas, margen bruto y calidad de tu facturación a partir de facturas, notas de
          crédito y notas de débito. Lo que quede pendiente de cobrar o pagar (no tildado como cobrada/pagada)
          aparece automáticamente organizado por semana en "Cobranzas y pagos".
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
          <label className="ml-auto flex shrink-0 items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Cobro/pago estimado a
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
            type="number"
            placeholder="IVA"
            title="Monto de IVA incluido en el total (opcional)"
            value={iva}
            onChange={(e) => setIva(e.target.value)}
            className="tabular w-24 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <select
            title="Calcular el IVA a partir de una alícuota, sobre el monto total"
            defaultValue=""
            onChange={(e) => {
              const pct = Number(e.target.value)
              const m = Number(monto)
              if (pct > 0 && m > 0) setIva(String(Math.round(m - m / (1 + pct / 100))))
              e.target.value = ''
            }}
            className="shrink-0 rounded-lg border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-muted)' }}
          >
            <option value="" disabled>
              % IVA
            </option>
            <option value="21">21%</option>
            <option value="10.5">10,5%</option>
            <option value="27">27%</option>
          </select>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <input
            type="number"
            min={1}
            title="En cuántas cuotas mensuales se paga (1 = de contado)"
            placeholder="Cuotas"
            value={cuotas}
            onChange={(e) => setCuotas(e.target.value)}
            className="tabular w-20 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
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
                Ventas netas del período
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(margenTotal.ventasNetas)}
              </p>
              <p className="tabular mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Neto: {formatoMoneda(ivaTotales.netoVentas)} · IVA (débito fiscal): {formatoMoneda(ivaTotales.ivaVentas)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Compras netas del período
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(margenTotal.comprasNetas)}
              </p>
              <p className="tabular mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Neto: {formatoMoneda(ivaTotales.netoCompras)} · IVA (crédito fiscal): {formatoMoneda(ivaTotales.ivaCompras)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Margen bruto del período
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: margenTotal.margenBruto >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
              >
                {formatoMoneda(margenTotal.margenBruto)} ({formatoPorcentaje(margenTotal.margenBrutoPct)})
              </p>
            </div>
          </section>

          {margenTotal.margenBruto < 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ⚠️ Compraste más de lo que facturaste en el período. Esto no implica necesariamente un quiebre de
              caja: si cargaste esas compras con la cantidad de cuotas en las que las estás pagando, el
              Dashboard ya reparte el impacto real mes a mes en vez de contarlo todo de una vez — mirá el
              runway y la proyección de caja para tu situación real.
            </p>
          )}

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ventas y compras netas por mes
            </h3>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Solo para ver la evolución — el margen bruto real (arriba) se calcula sobre el total del período,
              no mes a mes, porque una compra y la venta que genera no siempre caen en el mismo mes.
            </p>

            {resumenMensual.length > 1 && (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={resumenMensual} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <XAxis
                    dataKey="mes"
                    tickFormatter={mesLegible}
                    stroke="var(--axis)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--gridline)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatoMoneda(v)}
                    stroke="var(--axis)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--gridline)' }}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip content={<EvolucionTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ventasNetas" name="Ventas netas" stroke="var(--series-blue)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="comprasNetas" name="Compras netas" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                    <th className="pb-2 font-medium">Mes</th>
                    <th className="pb-2 text-right font-medium">Ventas netas</th>
                    <th className="pb-2 text-right font-medium">Compras netas</th>
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
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={rankingClientes} dataKey="monto" nameKey="contraparte" innerRadius={35} outerRadius={65} paddingAngle={2}>
                        {rankingClientes.map((r, i) => (
                          <Cell key={r.contraparte} fill={COLORES_RANKING[i % COLORES_RANKING.length]} stroke="var(--surface-1)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<RankingTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-2">
                    {rankingClientes.map((r, i) => (
                      <li key={r.contraparte} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORES_RANKING[i % COLORES_RANKING.length] }} />
                        <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                          {r.contraparte}
                        </span>
                        <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatoMoneda(r.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
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
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={rankingProveedores} dataKey="monto" nameKey="contraparte" innerRadius={35} outerRadius={65} paddingAngle={2}>
                        {rankingProveedores.map((r, i) => (
                          <Cell key={r.contraparte} fill={COLORES_RANKING[i % COLORES_RANKING.length]} stroke="var(--surface-1)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<RankingTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="mt-2 space-y-2">
                    {rankingProveedores.map((r, i) => (
                      <li key={r.contraparte} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORES_RANKING[i % COLORES_RANKING.length] }} />
                        <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                          {r.contraparte}
                        </span>
                        <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatoMoneda(r.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Comprobantes cargados
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="🔍 Buscar por cliente/proveedor o número…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-56 rounded-full border px-3 py-1 text-xs"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
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
                <button
                  onClick={handleVaciar}
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                  style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
                >
                  🗑 Borrar todo
                </button>
              </div>
            </div>

            {listado.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay comprobantes que coincidan con la búsqueda.
              </p>
            ) : (
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
                    <label className="flex shrink-0 items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {f.tipo === 'emitida' ? 'Cobro' : 'Pago'} est.
                      <input
                        type="date"
                        value={f.fechaEstimadaCobroPago ?? f.fecha}
                        onChange={(e) => onCambiar(f.id, { fechaEstimadaCobroPago: e.target.value })}
                        className="rounded border px-1.5 py-0.5 text-xs"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                      />
                    </label>
                    <label
                      className="flex shrink-0 items-center gap-1 text-xs"
                      style={{ color: f.cumplido ? 'var(--status-good-text)' : 'var(--text-muted)' }}
                    >
                      <input
                        type="checkbox"
                        checked={f.cumplido ?? false}
                        onChange={(e) => onCambiar(f.id, { cumplido: e.target.checked })}
                        className="h-3.5 w-3.5 accent-current"
                      />
                      {f.tipo === 'emitida' ? 'Cobrada' : 'Pagada'}
                    </label>
                    {f.cumplido && (
                      <select
                        value={f.medioPago ?? ''}
                        onChange={(e) => onCambiar(f.id, { medioPago: (e.target.value || undefined) as MedioPago | undefined })}
                        title="Con qué se cobró/pagó"
                        className="shrink-0 rounded border px-1.5 py-0.5 text-xs"
                        style={{
                          borderColor: f.medioPago ? 'var(--border)' : 'var(--status-warning)',
                          background: 'var(--surface-1)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <option value="">Medio…</option>
                        {(Object.keys(MEDIOS_PAGO_LABEL) as MedioPago[]).map((medio) => (
                          <option key={medio} value={medio}>
                            {MEDIOS_PAGO_LABEL[medio]}
                          </option>
                        ))}
                      </select>
                    )}
                    <span
                      className="tabular shrink-0 font-medium"
                      style={{
                        color: f.tipoComprobante === 'nota_credito' ? 'var(--status-critical)' : 'var(--text-primary)',
                        opacity: f.cumplido ? 0.5 : 1,
                      }}
                      title={f.iva ? `Neto ${formatoMoneda(montoNetoConSigno(f))} + IVA ${formatoMoneda(ivaConSigno(f))}` : undefined}
                    >
                      {formatoMoneda(montoConSigno(f))}
                    </span>
                    {f.iva !== undefined && f.iva > 0 && (
                      <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                        (IVA {formatoMoneda(f.iva)})
                      </span>
                    )}
                    {(f.cuotas ?? 1) > 1 && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                        title={`Se reparte en ${f.cuotas} cuotas mensuales para el impacto en caja`}
                      >
                        ×{f.cuotas} cuotas
                      </span>
                    )}
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
            )}
          </section>
        </>
      )}
    </div>
  )
}
