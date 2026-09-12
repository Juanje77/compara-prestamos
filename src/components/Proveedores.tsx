import { useState } from 'react'
import type { ProveedorResumen } from '../lib/cfo'
import { CATEGORIAS_GASTO } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  proveedores: ProveedorResumen[]
  onClasificar: (proveedor: string, categoria: string) => void
  onAgregarManual: (proveedor: string, categoria: string) => void
  onEliminarManual: (proveedor: string) => void
}

export function Proveedores({ proveedores, onClasificar, onAgregarManual, onEliminarManual }: Props) {
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [categoriaNueva, setCategoriaNueva] = useState(CATEGORIAS_GASTO[0].key)

  const sinClasificar = proveedores.filter((p) => p.cantidad > 0 && !p.categoria)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nombre = nombreNuevo.trim()
    if (!nombre) return
    if (proveedores.some((p) => p.proveedor.toLowerCase() === nombre.toLowerCase())) return
    onAgregarManual(nombre, categoriaNueva)
    setNombreNuevo('')
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Proveedores
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Clasificá cada proveedor en una categoría de gasto para que Presupuesto vs. Real se complete solo con tus
        facturas recibidas.
      </p>

      {sinClasificar.length > 0 && (
        <p
          className="mb-4 rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--status-warning)', color: 'var(--status-warning)', background: 'var(--surface-1)' }}
        >
          ⚠️ Tenés {sinClasificar.length} proveedor{sinClasificar.length === 1 ? '' : 'es'} con facturas sin
          clasificar: {sinClasificar.map((p) => p.proveedor).join(', ')}.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Nombre del proveedor"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <select
          value={categoriaNueva}
          onChange={(e) => setCategoriaNueva(e.target.value)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          {CATEGORIAS_GASTO.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--series-blue)' }}
        >
          Agregar
        </button>
      </form>

      {proveedores.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay proveedores: importá facturas recibidas en Salud financiera o agregá uno a mano arriba.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                <th className="pb-2 pr-4 font-medium">Proveedor</th>
                <th className="pb-2 pr-4 text-right font-medium">Facturas</th>
                <th className="pb-2 pr-4 text-right font-medium">Total facturado</th>
                <th className="pb-2 pr-2 font-medium">Categoría</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.proveedor} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                  <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>
                    {p.proveedor}
                  </td>
                  <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {p.cantidad}
                  </td>
                  <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(p.totalFacturado)}
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={p.categoria}
                      onChange={(e) => onClasificar(p.proveedor, e.target.value)}
                      className="rounded-lg border px-2 py-1 text-sm"
                      style={{
                        borderColor: p.categoria ? 'var(--border)' : 'var(--status-warning)',
                        background: 'var(--surface-1)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">Sin clasificar</option>
                      {CATEGORIAS_GASTO.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    {p.cantidad === 0 && (
                      <button
                        onClick={() => onEliminarManual(p.proveedor)}
                        aria-label="Eliminar proveedor"
                        className="shrink-0 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
