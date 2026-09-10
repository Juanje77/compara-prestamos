import { useMemo, useState } from 'react'
import type { OfertaCalculada } from '../lib/finance'
import { cuotaFrancesa, formatoMoneda, formatoPorcentaje, saldoPendiente } from '../lib/finance'
import type { TipoPrestamo } from '../data/loans'

interface Props {
  ofertas: OfertaCalculada[]
  tipo: TipoPrestamo
}

export function RefinanciacionCalculator({ ofertas, tipo }: Props) {
  const [montoOriginal, setMontoOriginal] = useState(5000000)
  const [tasaActual, setTasaActual] = useState(90)
  const [plazoOriginal, setPlazoOriginal] = useState(24)
  const [cuotasPagadas, setCuotasPagadas] = useState(6)
  const [costoCancelacionPct, setCostoCancelacionPct] = useState(3)

  const mejorOferta = ofertas[0]
  const plazoRestante = plazoOriginal - cuotasPagadas

  const resultado = useMemo(() => {
    if (!mejorOferta || plazoRestante <= 0) return null

    const saldo = saldoPendiente(montoOriginal, tasaActual, plazoOriginal, cuotasPagadas)
    if (saldo <= 0) return null

    const cuotaActual = cuotaFrancesa(montoOriginal, tasaActual, plazoOriginal)
    const cuotaNueva = cuotaFrancesa(saldo, mejorOferta.tna, plazoRestante)

    const interesRestanteActual = cuotaActual * plazoRestante - saldo
    const interesRestanteNuevo = cuotaNueva * plazoRestante - saldo
    const ahorroInteres = interesRestanteActual - interesRestanteNuevo

    const costoCancelacion = saldo * (costoCancelacionPct / 100)
    const ahorroNeto = ahorroInteres - costoCancelacion
    const ahorroMensual = cuotaActual - cuotaNueva

    return {
      saldo,
      cuotaActual,
      cuotaNueva,
      ahorroMensual,
      ahorroInteres,
      costoCancelacion,
      ahorroNeto,
      conviene: ahorroNeto > 0 && ahorroMensual > 0,
    }
  }, [mejorOferta, montoOriginal, tasaActual, plazoOriginal, cuotasPagadas, costoCancelacionPct, plazoRestante])

  if (!mejorOferta) return null

  return (
    <section
      className="mb-8 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        ¿Te conviene refinanciar un crédito que ya tenés?
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Cargá los datos de tu préstamo actual y lo comparamos contra la mejor oferta vigente ({mejorOferta.banco},{' '}
        {formatoPorcentaje(mejorOferta.tna)} TNA) para ver si conviene cancelarlo y tomar uno nuevo.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Monto original del préstamo
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={100000}
              max={60000000}
              step={100000}
              value={montoOriginal}
              onChange={(e) => setMontoOriginal(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-32 shrink-0 text-right font-semibold">{formatoMoneda(montoOriginal)}</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Tasa (TNA) que estás pagando hoy
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={180}
              step={1}
              value={tasaActual}
              onChange={(e) => setTasaActual(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-20 shrink-0 text-right font-semibold">{tasaActual}%</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Plazo total original (meses)
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={6}
              max={360}
              step={6}
              value={plazoOriginal}
              onChange={(e) => setPlazoOriginal(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-20 shrink-0 text-right font-semibold">{plazoOriginal} m</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Cuotas ya pagadas
          </span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={Math.max(0, plazoOriginal - 1)}
              step={1}
              value={Math.min(cuotasPagadas, Math.max(0, plazoOriginal - 1))}
              onChange={(e) => setCuotasPagadas(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-20 shrink-0 text-right font-semibold">{cuotasPagadas} m</span>
          </div>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Costo estimado de cancelación anticipada (% sobre saldo)
          </span>
          <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Varía según el banco y el contrato — algunos no cobran nada, otros hasta un 5-8% del saldo. Consultá
            el tuyo antes de decidir.
          </p>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={8}
              step={0.5}
              value={costoCancelacionPct}
              onChange={(e) => setCostoCancelacionPct(Number(e.target.value))}
              className="w-full accent-current"
              style={{ color: 'var(--series-blue)' }}
            />
            <span className="tabular w-16 shrink-0 text-right font-semibold">{costoCancelacionPct}%</span>
          </div>
        </label>
      </div>

      {!resultado && (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Ajustá los datos: las cuotas pagadas deben ser menores al plazo total para poder calcular el saldo
          pendiente.
        </p>
      )}

      {resultado && (
        <div className="mt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Saldo pendiente hoy
              </p>
              <p className="tabular text-lg font-semibold">{formatoMoneda(resultado.saldo)}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Cuota actual vs. nueva
              </p>
              <p className="tabular text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{formatoMoneda(resultado.cuotaActual)}</span>
                {' → '}
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatoMoneda(resultado.cuotaNueva)}
                </span>
              </p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Ahorro mensual
              </p>
              <p
                className="tabular text-lg font-semibold"
                style={{ color: resultado.ahorroMensual > 0 ? 'var(--status-good-text)' : '#a02020' }}
              >
                {resultado.ahorroMensual > 0 ? '+' : ''}
                {formatoMoneda(resultado.ahorroMensual)}
              </p>
            </div>
          </div>

          <div
            className="mt-4 rounded-lg border p-4"
            style={{
              borderColor: resultado.conviene ? 'var(--status-good)' : '#d03b3b',
              background: resultado.conviene
                ? 'color-mix(in srgb, var(--status-good) 6%, var(--surface-1))'
                : 'color-mix(in srgb, #d03b3b 6%, var(--surface-1))',
            }}
          >
            <p
              className="mb-1 text-sm font-semibold"
              style={{ color: resultado.conviene ? 'var(--status-good-text)' : '#a02020' }}
            >
              {resultado.conviene ? '✓ Conviene refinanciar' : '✗ No conviene refinanciar (con estos datos)'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              A lo largo de los {plazoRestante} meses que te quedan, pagarías{' '}
              <span className="tabular font-semibold">{formatoMoneda(Math.abs(resultado.ahorroInteres))}</span>{' '}
              {resultado.ahorroInteres > 0 ? 'menos' : 'más'} de interés con la oferta nueva. Restando el costo
              estimado de cancelación anticipada ({formatoMoneda(resultado.costoCancelacion)}), el ahorro neto
              sería de{' '}
              <span
                className="tabular font-semibold"
                style={{ color: resultado.ahorroNeto > 0 ? 'var(--status-good-text)' : '#a02020' }}
              >
                {formatoMoneda(resultado.ahorroNeto)}
              </span>
              .
            </p>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Estimación orientativa: no incluye gastos de otorgamiento del préstamo nuevo (sellado, seguro,
        gastos administrativos), que también restan al ahorro. {tipo === 'hipotecario' && 'En créditos UVA el saldo se ajusta por inflación, así que esta comparación es aproximada.'}
      </p>
    </section>
  )
}
