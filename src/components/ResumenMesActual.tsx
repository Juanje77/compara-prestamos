import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import type { ResumenMes, Variacion } from '../lib/dashboardMes'

// Cómo viene el mes, contra el anterior.
//
// Facturado y cobrado van separados a propósito: se puede tener un mes excelente de ventas y no
// haber visto un peso. Es, de hecho, la diferencia que más problemas de caja explica, y mostrar
// solo una de las dos esconde justo eso.

interface Props {
  actual: ResumenMes
  anterior: ResumenMes
  variaciones: {
    facturado: Variacion
    cobrado: Variacion
    pagado: Variacion
    margen: Variacion
  }
  onVerComprobantes: () => void
}

function mesLegible(mes: string): string {
  const [anio, m] = mes.split('-')
  return new Date(Number(anio), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

/** Solo la primera letra. La clase `capitalize` de CSS pone en mayúscula cada palabra y deja
 * "Octubre De 2026", y en medio de una frase ("comparado con septiembre") no va ninguna. */
function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * La flechita con el cambio. `bueno` dice de qué lado está lo deseable: que suba lo facturado es
 * una buena noticia y que suba lo pagado no, así que el color no puede salir del signo.
 */
export function Tendencia({ v, bueno = 'sube' }: { v: Variacion; bueno?: 'sube' | 'baja' }) {
  if (v.direccion === 'igual') {
    return (
      <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Minus size={12} aria-hidden="true" /> igual que el mes pasado
      </span>
    )
  }
  const favorable = v.direccion === bueno
  const Icono = v.direccion === 'sube' ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: favorable ? 'var(--status-good-text)' : 'var(--status-critical)' }}
    >
      <Icono size={12} aria-hidden="true" />
      {/* Sin porcentaje cuando el mes anterior fue cero o negativo: ahí el número se leería al
          revés o sería inventado, y conviene decir "nuevo" antes que mentir una magnitud. */}
      {v.porcentaje === null ? 'nuevo' : `${formatoPorcentaje(Math.abs(v.porcentaje))} vs. mes pasado`}
    </span>
  )
}

function Celda({
  etiqueta,
  valor,
  v,
  bueno = 'sube',
}: {
  etiqueta: string
  valor: string
  v: Variacion
  bueno?: 'sube' | 'baja'
}) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {etiqueta}
      </p>
      <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {valor}
      </p>
      <p className="mt-1">
        <Tendencia v={v} bueno={bueno} />
      </p>
    </div>
  )
}

export function ResumenMesActual({ actual, anterior, variaciones, onVerComprobantes }: Props) {
  const sinNada = actual.facturado === 0 && actual.cobrado === 0 && actual.pagado === 0
  return (
    <section
      className="mb-6 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {conMayuscula(mesLegible(actual.mes))}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Comparado con {mesLegible(anterior.mes)}
          </p>
        </div>
        <button
          type="button"
          onClick={onVerComprobantes}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
        >
          Ver comprobantes <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>

      {sinNada ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay movimientos este mes. En cuanto cargues un comprobante o un cobro, acá vas a ver
          cómo viene contra el mes pasado.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Celda etiqueta="Facturaste" valor={formatoMoneda(actual.facturado)} v={variaciones.facturado} />
          <Celda etiqueta="Cobraste" valor={formatoMoneda(actual.cobrado)} v={variaciones.cobrado} />
          <Celda etiqueta="Pagaste" valor={formatoMoneda(actual.pagado)} v={variaciones.pagado} bueno="baja" />
          <Celda
            etiqueta={`Margen (${formatoPorcentaje(actual.margenPct)})`}
            valor={formatoMoneda(actual.margen)}
            v={variaciones.margen}
          />
        </div>
      )}
    </section>
  )
}
