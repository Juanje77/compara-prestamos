import { useState } from 'react'
import type { Cheque, EstadoCheque, TipoCheque } from '../lib/cfo'
import { calcularTotalesCheques, estadosChequeDisponibles, etiquetaEstadoCheque, montoNetoCheque } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  cheques: Cheque[]
  onAgregar: (cheque: Omit<Cheque, 'id'>) => void
  onCambiarEstado: (id: string, estado: EstadoCheque) => void
  onCambiarComision: (id: string, comisionDescuento: number) => void
  onEliminar: (id: string) => void
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function Cheques({ cheques, onAgregar, onCambiarEstado, onCambiarComision, onEliminar }: Props) {
  const [tipo, setTipo] = useState<TipoCheque>('recibido')
  const [numero, setNumero] = useState('')
  const [banco, setBanco] = useState('')
  const [contraparte, setContraparte] = useState('')
  const [monto, setMonto] = useState('')
  const [fechaEmision, setFechaEmision] = useState(hoyISO)
  const [fechaCobro, setFechaCobro] = useState(hoyISO)

  const totales = calcularTotalesCheques(cheques)
  const listado = [...cheques].sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = Number(monto)
    if (!banco.trim() || !contraparte.trim() || !m || m <= 0 || !fechaEmision || !fechaCobro) return
    onAgregar({
      tipo,
      numero: numero.trim() || undefined,
      banco: banco.trim(),
      contraparte: contraparte.trim(),
      monto: m,
      fechaEmision,
      fechaCobro,
      estado: 'cartera',
    })
    setNumero('')
    setBanco('')
    setContraparte('')
    setMonto('')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Cheques
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cheques de terceros que recibiste y cheques propios que emitiste. Un recibido lo podés cobrar al
          vencimiento, o venderlo (descontarlo) antes en un banco a cambio de una comisión. Junto con tus
          cuentas bancarias, es la base para armar un balance contable a fin de año.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCheque)}
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
          <input
            type="number"
            placeholder="Monto"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
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
          <button
            type="submit"
            className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--series-blue)' }}
          >
            Agregar
          </button>
        </form>
      </section>

      {cheques.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ningún cheque.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Recibidos en cartera
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(totales.recibidosEnCartera)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Emitidos en cartera
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(totales.emitidosEnCartera)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Saldo neto en cheques
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: totales.saldoNetoCheques >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
              >
                {formatoMoneda(totales.saldoNetoCheques)}
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Comisiones pagadas a bancos
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: totales.totalComisionesDescuento > 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}
              >
                {formatoMoneda(totales.totalComisionesDescuento)}
              </p>
            </div>
          </section>

          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Cheques cargados
            </h3>
            <ul className="max-h-96 space-y-1.5 overflow-y-auto">
              {listado.map((c) => (
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
                  {c.estado === 'vendido' && (
                    <label className="flex shrink-0 items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Comisión banco
                      <input
                        type="number"
                        min={0}
                        value={c.comisionDescuento ?? ''}
                        onChange={(e) => onCambiarComision(c.id, Number(e.target.value))}
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
                  <button
                    onClick={() => onEliminar(c.id)}
                    aria-label="Eliminar cheque"
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
