import { useState } from 'react'
import type { Factura, TipoComprobante } from '../lib/cfo'
import { alicuotaIvaDeFactura, montoDisponibleParaNota, validarNota } from '../lib/facturacionElectronica'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'

// Alta de una nota de crédito o débito sobre una factura concreta.
//
// La nota nace desde el comprobante que corrige, no desde un formulario en blanco: así hereda el
// cliente, los datos fiscales y la alícuota, y el sistema puede controlar que una nota de crédito
// no devuelva más de lo que se facturó.

interface Props {
  original: Factura
  facturas: Factura[]
  onCrear: (nota: Omit<Factura, 'id'>) => void
  onCerrar: () => void
}

export function NuevaNota({ original, facturas, onCrear, onCerrar }: Props) {
  const [tipoComprobante, setTipoComprobante] = useState<Exclude<TipoComprobante, 'factura'>>('nota_credito')
  const disponible = montoDisponibleParaNota(original, facturas)
  const [monto, setMonto] = useState(disponible)
  const [detalle, setDetalle] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))

  // El IVA de la nota mantiene la alícuota del original: si se acredita la mitad de una factura
  // con 21%, se acredita también la mitad de su IVA.
  const alicuota = alicuotaIvaDeFactura(original)
  const iva = alicuota === null ? undefined : (monto * alicuota) / (100 + alicuota)

  const borrador: Omit<Factura, 'id'> = {
    tipo: original.tipo,
    tipoComprobante,
    contraparte: original.contraparte,
    monto,
    iva: iva === undefined ? undefined : Math.round(iva * 100) / 100,
    fecha,
    detalle: detalle.trim() || undefined,
    receptor: original.receptor,
    comprobanteAsociadoId: original.id,
    esInterna: original.esInterna,
  }

  const problemas = validarNota({ ...borrador, id: 'nueva' }, original, facturas)
  const esCredito = tipoComprobante === 'nota_credito'

  const campo = { borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border p-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {esCredito ? 'Nota de crédito' : 'Nota de débito'}
        </h3>
        <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Sobre {original.numero ? `la factura ${original.numero}` : 'la factura'} de {original.contraparte},{' '}
          {new Date(`${original.fecha}T00:00:00`).toLocaleDateString('es-AR')} por {formatoMoneda(original.monto)}.
          {esCredito && ` Queda sin acreditar ${formatoMoneda(disponible)}.`}
        </p>

        <div className="mb-3 flex gap-2">
          {(['nota_credito', 'nota_debito'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipoComprobante(t)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={
                tipoComprobante === t
                  ? { borderColor: 'var(--series-blue)', color: 'var(--series-blue)', background: 'var(--surface-2)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
              }
            >
              {t === 'nota_credito' ? 'Crédito (resta)' : 'Débito (suma)'}
            </button>
          ))}
        </div>

        <div className="mb-3 space-y-2">
          <InputMoneda
            placeholder="Monto de la nota"
            value={monto}
            onChange={setMonto}
            className="w-full rounded-lg border px-3 py-1.5 text-sm"
            style={campo}
          />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border px-3 py-1.5 text-sm"
            style={campo}
          />
          <input
            type="text"
            placeholder="Motivo (devolución, bonificación, error de facturación…)"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="w-full rounded-lg border px-3 py-1.5 text-sm"
            style={campo}
          />
        </div>

        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {iva === undefined
            ? 'El original no discrimina IVA, así que la nota tampoco.'
            : `IVA de la nota: ${formatoMoneda(iva)} (${alicuota}%, la misma alícuota del original).`}
        </p>

        {problemas.length > 0 && (
          <ul className="mb-3 space-y-1 border-l-2 py-2 pl-3" style={{ borderColor: 'var(--status-critical)' }}>
            {problemas.map((p) => (
              <li key={p} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onCrear(borrador)
              onCerrar()
            }}
            disabled={problemas.length > 0 || !(monto > 0)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{
              background: problemas.length === 0 && monto > 0 ? 'var(--series-blue)' : 'var(--surface-2)',
              color: problemas.length === 0 && monto > 0 ? '#fff' : 'var(--text-muted)',
            }}
          >
            Crear nota
          </button>
        </div>
      </div>
    </div>
  )
}
