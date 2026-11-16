import { AlertTriangle, ArrowRight } from 'lucide-react'
import { formatoMoneda } from '../lib/finance'
import type { LadoCuentasPendientes, ResumenCuentasPendientes } from '../lib/cfo'

// Lo que te deben y lo que debés, en el Dashboard.
//
// Estaba solo adentro de Comprobantes, que es la pantalla donde uno va a CARGAR. Pero "cuánto me
// deben" es de las primeras preguntas del día, y para contestarla había que entrar a otra
// pantalla y buscarlo. Son los mismos números, no un cálculo nuevo.
//
// El vencido va aparte del total a propósito: el total dice cuánto hay, el vencido dice de qué
// hay que ocuparse hoy.

interface Props {
  resumen: ResumenCuentasPendientes
  onVerComprobantes: () => void
}

function Lado({
  etiqueta,
  lado,
  tono,
}: {
  etiqueta: string
  lado: LadoCuentasPendientes
  tono: 'cobrar' | 'pagar'
}) {
  const color = tono === 'cobrar' ? 'var(--series-blue)' : 'var(--text-primary)'
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {etiqueta}
      </p>
      <p className="tabular text-xl font-semibold" style={{ color }}>
        {formatoMoneda(lado.total)}
      </p>
      {lado.vencido > 0 ? (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--status-critical)' }}>
          <AlertTriangle size={12} aria-hidden="true" />
          {formatoMoneda(lado.vencido)} vencido
          <span style={{ color: 'var(--text-muted)' }}>
            ({lado.cantidadVencida} {lado.cantidadVencida === 1 ? 'comprobante' : 'comprobantes'})
          </span>
        </p>
      ) : (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {lado.total > 0 ? 'Nada vencido' : 'Sin pendientes'}
        </p>
      )}
    </div>
  )
}

export function CuentasPendientes({ resumen, onVerComprobantes }: Props) {
  const { cobrar, pagar, neto } = resumen
  return (
    <section
      className="mb-6 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Cuentas por cobrar y por pagar
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Saldo pendiente de tus comprobantes, descontando los pagos parciales ya imputados
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

      {!resumen.hayDatos ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No tenés comprobantes pendientes. En cuanto cargues una factura emitida o recibida que todavía
          no esté cobrada o pagada, acá vas a ver cuánto te deben y cuánto debés.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Lado etiqueta="Te deben" lado={cobrar} tono="cobrar" />
          <Lado etiqueta="Debés" lado={pagar} tono="pagar" />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Neto
            </p>
            <p
              className="tabular text-xl font-semibold"
              style={{ color: neto >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
            >
              {formatoMoneda(neto)}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {/* Dicho explícito porque es el error de lectura más caro: un neto grande y a favor
                  invita a gastarlo, y todavía no está cobrado. */}
              {neto >= 0 ? 'A tu favor, pero todavía sin cobrar' : 'Debés más de lo que te deben'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
