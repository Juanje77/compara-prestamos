import { useState } from 'react'
import { AlertTriangle, CalendarClock, ChevronDown } from 'lucide-react'
import { formatoMoneda } from '../lib/finance'
import type { Cheque } from '../lib/cfo'
import { armarLineaDeTiempoCheques, type TramoCheques } from '../lib/lineaDeTiempoCheques'

// Cuándo cae cada cheque, semana a semana.
//
// La lista de cheques contesta "qué tengo". Esto contesta "¿llego a cubrir los de la semana que
// viene?", que es la pregunta por la que uno abre esta pantalla.
//
// Las barras van a lados opuestos de una misma línea: arriba lo que entra, abajo lo que sale. Es
// la forma de ver de un saque la semana en la que sale más de lo que entra, sin leer un número.
// Todas las barras se miden contra el mismo máximo, porque si cada semana se escalara a lo suyo,
// una semana de mil pesos se vería igual de alta que una de un millón.

const ALTO_BARRA = 44

interface Props {
  cheques: Cheque[]
  /** La caja de hoy, para arrastrar el saldo. */
  saldoInicial: number
  semanas?: number
}

function Barra({ monto, max, tono }: { monto: number; max: number; tono: 'entra' | 'sale' }) {
  // Mínimo 2px cuando hay algo: una barra de un peso no se ve, pero "no hay nada" y "hay poco"
  // tienen que distinguirse.
  const alto = monto > 0 ? Math.max(2, Math.round((monto / max) * ALTO_BARRA)) : 0
  return (
    <div
      className="w-full rounded-sm"
      style={{
        height: alto,
        background: tono === 'entra' ? 'var(--series-blue)' : 'var(--series-2)',
      }}
    />
  )
}

function DetalleCheques({ titulo, cheques }: { titulo: string; cheques: Cheque[] }) {
  if (cheques.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        {titulo}
      </p>
      <ul className="mt-1 space-y-1">
        {cheques.map((c) => (
          <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span style={{ color: 'var(--text-primary)' }}>
              {new Date(`${c.fechaCobro}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
              {' · '}
              {c.contraparte || 'Sin nombre'}
              {c.numero ? <span style={{ color: 'var(--text-muted)' }}> (N.º {c.numero})</span> : null}
              <span style={{ color: 'var(--text-muted)' }}> — {c.banco}</span>
            </span>
            <span className="tabular font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatoMoneda(c.monto)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LineaDeTiempoCheques({ cheques, saldoInicial, semanas = 13 }: Props) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const linea = armarLineaDeTiempoCheques(cheques, saldoInicial, semanas)

  if (!linea.hayCheques) {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No tenés cheques en cartera. En cuanto cargues uno, acá vas a ver en qué semana cae y cómo queda
          tu caja después de cobrarlo o pagarlo.
        </p>
      </div>
    )
  }

  const max = Math.max(1, ...linea.tramos.flatMap((t) => [t.recibidos.total, t.emitidos.total]))
  const tramoAbierto: TramoCheques | null = abierta === null ? null : linea.tramos[abierta]
  const totalVencido = linea.vencidos.reduce((s, c) => s + c.monto, 0)

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          <CalendarClock size={17} aria-hidden="true" /> Cuándo caen los cheques
        </h3>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-blue)' }} /> Cobrás
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-2)' }} /> Pagás
          </span>
        </div>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Solo los que están en cartera. El saldo arranca de tu caja de hoy ({formatoMoneda(linea.saldoInicial)}) y
        arrastra semana a semana.
      </p>

      {linea.vencidos.length > 0 && (
        <p
          className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--status-critical)', color: 'var(--text-primary)' }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-critical)' }} aria-hidden="true" />
          <span>
            <strong>
              {linea.vencidos.length === 1 ? 'Un cheque' : `${linea.vencidos.length} cheques`} por{' '}
              {formatoMoneda(totalVencido)}
            </strong>{' '}
            {linea.vencidos.length === 1 ? 'sigue' : 'siguen'} en cartera con la fecha ya pasada. O no se
            {linea.vencidos.length === 1 ? ' depositó' : ' depositaron'}, o falta actualizarle
            {linea.vencidos.length === 1 ? '' : 's'} el estado — pero hasta resolverlo, el saldo de abajo{' '}
            {linea.vencidos.length === 1 ? 'lo está' : 'los está'} ignorando.
          </span>
        </p>
      )}

      {linea.primerTramoEnRojo !== null && (
        <p
          className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--status-warning)', color: 'var(--text-primary)' }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-warning)' }} aria-hidden="true" />
          <span>
            Con los cheques cargados, tu caja queda en rojo en la semana del{' '}
            <strong>
              {linea.tramos[linea.primerTramoEnRojo].semana.inicio.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
            </strong>
            : {formatoMoneda(linea.tramos[linea.primerTramoEnRojo].saldoAcumulado)}.
          </span>
        </p>
      )}

      {/* Scroll horizontal: trece semanas no entran en un celular, y apretarlas hasta que entren
          deja columnas de cuatro píxeles donde no se lee nada. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-max gap-1.5">
          {linea.tramos.map((t, i) => {
            const vacia = t.recibidos.total === 0 && t.emitidos.total === 0
            const seleccionada = abierta === i
            return (
              <button
                key={t.semana.label}
                type="button"
                onClick={() => setAbierta(seleccionada ? null : i)}
                aria-expanded={seleccionada}
                title={`${t.semana.label}: cobrás ${formatoMoneda(t.recibidos.total)}, pagás ${formatoMoneda(t.emitidos.total)}`}
                className="flex w-[74px] shrink-0 flex-col items-center rounded-lg border px-1.5 py-2 text-center"
                style={{
                  borderColor: seleccionada ? 'var(--series-blue)' : 'var(--border)',
                  background: vacia ? 'transparent' : 'var(--surface-2)',
                  opacity: vacia ? 0.55 : 1,
                }}
              >
                {/* Arriba lo que entra, creciendo hacia la línea del medio. */}
                <div className="flex w-full flex-col justify-end" style={{ height: ALTO_BARRA }}>
                  <Barra monto={t.recibidos.total} max={max} tono="entra" />
                </div>
                <div className="my-0.5 h-px w-full" style={{ background: 'var(--border)' }} />
                <div className="flex w-full flex-col justify-start" style={{ height: ALTO_BARRA }}>
                  <Barra monto={t.emitidos.total} max={max} tono="sale" />
                </div>
                <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {t.semana.inicio.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </p>
                <p
                  className="tabular text-[11px] font-semibold"
                  style={{ color: t.saldoAcumulado < 0 ? 'var(--status-critical)' : 'var(--text-primary)' }}
                >
                  {formatoMoneda(t.saldoAcumulado)}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        Tocá una semana para ver qué cheques la componen. El número de abajo es cómo queda tu caja al final de
        esa semana.
      </p>

      {tramoAbierto && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <ChevronDown size={14} aria-hidden="true" /> {tramoAbierto.semana.label}
          </p>
          {tramoAbierto.recibidos.cheques.length === 0 && tramoAbierto.emitidos.cheques.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Esa semana no cae ningún cheque.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetalleCheques titulo={`Cobrás — ${formatoMoneda(tramoAbierto.recibidos.total)}`} cheques={tramoAbierto.recibidos.cheques} />
              <DetalleCheques titulo={`Pagás — ${formatoMoneda(tramoAbierto.emitidos.total)}`} cheques={tramoAbierto.emitidos.cheques} />
            </div>
          )}
        </div>
      )}

      {linea.masAdelante.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Además hay {linea.masAdelante.length === 1 ? 'un cheque' : `${linea.masAdelante.length} cheques`} por{' '}
          {formatoMoneda(linea.masAdelante.reduce((s, c) => s + c.monto, 0))} con fecha posterior a estos{' '}
          {semanas / 4 >= 3 ? `${Math.round(semanas / 4.33)} meses` : `${semanas} semanas`}.
        </p>
      )}
    </div>
  )
}
