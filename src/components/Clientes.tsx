import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ClienteResumen } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { IconButton } from './IconButton'
import { Card } from './Card'
import { Button } from './Button'

interface Props {
  clientes: ClienteResumen[]
  onAgregarManual: (cliente: string) => void
  onEliminarManual: (cliente: string) => void
}

export function Clientes({ clientes, onAgregarManual, onEliminarManual }: Props) {
  const [nombreNuevo, setNombreNuevo] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nombre = nombreNuevo.trim()
    if (!nombre) return
    if (clientes.some((c) => c.cliente.toLowerCase() === nombre.toLowerCase())) return
    onAgregarManual(nombre)
    setNombreNuevo('')
  }

  return (
    <Card as="section">
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Clientes
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Todos tus clientes, con la cantidad de operaciones y el total de cada uno. Se arma solo con lo
        que cargues en Ingresos y gastos o en Comprobantes.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Nombre del cliente"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <Button type="submit" variante="primario">
          Agregar
        </Button>
      </form>

      {clientes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay clientes: cargá una venta en Ingresos y gastos (con el nombre del cliente en el concepto), importá facturas emitidas en Comprobantes, o agregá uno a mano arriba.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 text-right font-medium">Facturas</th>
                <th className="pb-2 pr-4 text-right font-medium">Total facturado</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.cliente} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                  <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>
                    {c.cliente}
                  </td>
                  <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {c.cantidad}
                  </td>
                  <td className="tabular py-2 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(c.totalFacturado)}
                  </td>
                  <td className="py-2 text-right">
                    {c.cantidad === 0 && (
                      <IconButton icon={Trash2} onClick={() => onEliminarManual(c.cliente)} label="Eliminar cliente" className="shrink-0" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
