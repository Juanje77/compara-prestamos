import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { CASAS, DETALLE_CASA, NOMBRE_CASA, type CasaDolar } from '../lib/cotizaciones'
import type { EstadoCotizaciones } from '../lib/useCotizaciones'
import { InputMoneda } from './InputMoneda'

// Qué dólar usa el sistema para convertir, y la salida de emergencia para fijarlo a mano.
//
// Lo de "a mano" no es un capricho: para un balance se usa el tipo de cambio de la fecha de
// cierre, no el de hoy, y para una operación puntual el del día en que se hizo. El sistema no
// tiene por qué saber cuál corresponde en cada caso — pero sí tiene que dejar ponerlo.

export interface ConfigDolarValor {
  casa: CasaDolar
  manual?: { compra: number; venta: number } | null
}

interface Props {
  valor: ConfigDolarValor
  onCambiar: (v: ConfigDolarValor) => void
  estado: EstadoCotizaciones
  onCerrar: () => void
}

export function ConfigDolar({ valor, onCambiar, estado, onCerrar }: Props) {
  const [aMano, setAMano] = useState(Boolean(valor.manual))
  const deLaFuente = estado.cotizaciones[valor.casa]
  const [compra, setCompra] = useState(valor.manual?.compra ?? deLaFuente?.compra ?? 0)
  const [venta, setVenta] = useState(valor.manual?.venta ?? deLaFuente?.venta ?? 0)

  function guardar() {
    onCambiar({ casa: valor.casa, manual: aMano && venta > 0 ? { compra: compra || venta, venta } : null })
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div
        role="dialog"
        aria-label="Cotización del dólar"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border p-5 sm:rounded-2xl"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Cotización del dólar
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ color: 'var(--text-muted)' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Con este tipo de cambio el sistema convierte a pesos todo lo que tengas en dólares, para que los
          totales y los indicadores no mezclen monedas. Lo que esté en dólares se guarda en dólares: se
          convierte recién al mostrarlo.
        </p>

        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Cuál usar
          </legend>
          <div className="space-y-2">
            {CASAS.map((c) => {
              const cot = estado.cotizaciones[c]
              return (
                <label
                  key={c}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border p-3"
                  style={{
                    borderColor: valor.casa === c ? 'var(--series-blue)' : 'var(--border)',
                    background: 'var(--surface-2)',
                  }}
                >
                  <input
                    type="radio"
                    name="casa-dolar"
                    className="mt-1"
                    checked={valor.casa === c}
                    onChange={() => onCambiar({ ...valor, casa: c })}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {NOMBRE_CASA[c]}
                      </span>
                      <span className="tabular text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {cot ? `compra ${cot.compra.toLocaleString('es-AR')} / venta ${cot.venta.toLocaleString('es-AR')}` : 'sin dato'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>
                      {DETALLE_CASA[c]}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <label className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={aMano} onChange={(e) => setAMano(e.target.checked)} />
          Fijar el tipo de cambio a mano
        </label>
        {aMano && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Compra
              <InputMoneda
                value={compra}
                onChange={setCompra}
                aria-label="Tipo de cambio comprador"
                className="tabular mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Venta
              <InputMoneda
                value={venta}
                onChange={setVenta}
                aria-label="Tipo de cambio vendedor"
                className="tabular mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
            </label>
            <p className="col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Mientras esté fijado, no se usa la cotización del día. Es lo que corresponde para un cierre de
              balance, donde vale el tipo de cambio de la fecha de cierre y no el de hoy.
            </p>
          </div>
        )}

        {estado.error && (
          <p className="mb-3 text-xs" style={{ color: 'var(--status-warning)' }}>
            No se pudo traer la cotización del día ({estado.error}). Se sigue usando la última que se trajo.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={estado.refrescar}
            disabled={estado.cargando}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={14} className={estado.cargando ? 'animate-spin' : ''} aria-hidden="true" />
            Actualizar ahora
          </button>
          <button
            type="button"
            onClick={guardar}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold"
            style={{ background: 'var(--series-blue)', color: '#fff' }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
