import { ArrowRight, Wallet } from 'lucide-react'
import { formatoMoneda } from '../lib/finance'
import type { PosicionFinanciera } from '../lib/posicionFinanciera'

// La primera franja del Dashboard: la pregunta que se hace cualquier dueño al entrar.
//
// "¿Cuánta plata tengo, cuánto me deben, cuánto debo?" El cálculo ya existía y vivía adentro de
// Cobranzas y pagos: había que entrar a otra pantalla para enterarse de lo primero que uno quiere
// saber. Acá sale de la misma lista de movimientos que esa pantalla, así que los dos números
// coinciden siempre — que dos pantallas del mismo sistema digan cosas distintas sobre la misma
// plata es la forma más rápida de que el usuario deje de creerle a las dos.

interface Props {
  posicion: PosicionFinanciera
  /** Para el botón que lleva al detalle. */
  onVerDetalle: () => void
}

function Monto({
  etiqueta,
  valor,
  detalle,
  color,
}: {
  etiqueta: string
  valor: number
  detalle?: string
  color?: string
}) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {etiqueta}
      </p>
      <p className="tabular text-xl font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>
        {formatoMoneda(valor)}
      </p>
      {detalle && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {detalle}
        </p>
      )}
    </div>
  )
}

export function PosicionHoy({ posicion, onVerDetalle }: Props) {
  const { caja, aCobrar, aPagar, posicionNeta } = posicion
  return (
    <section
      className="mb-6 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Wallet size={17} aria-hidden="true" /> Tu plata hoy
        </h2>
        <button
          type="button"
          onClick={onVerDetalle}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
        >
          Ver semana a semana <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Monto etiqueta="En caja y bancos" valor={caja} detalle="plata que ya está" />
        <Monto
          etiqueta="Te deben"
          valor={aCobrar.total}
          detalle={`cheques ${formatoMoneda(aCobrar.cheques)} · facturas ${formatoMoneda(aCobrar.facturas)}`}
          color="var(--status-good-text)"
        />
        <Monto
          etiqueta="Tenés que pagar"
          valor={aPagar.total}
          detalle={`facturas ${formatoMoneda(aPagar.facturas)} · sueldos ${formatoMoneda(aPagar.sueldos)}`}
          color="var(--status-critical)"
        />
        <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            Te queda
          </p>
          <p
            className="tabular text-xl font-semibold"
            style={{ color: posicionNeta >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
          >
            {formatoMoneda(posicionNeta)}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            si entra y sale todo
          </p>
        </div>
      </div>
    </section>
  )
}
