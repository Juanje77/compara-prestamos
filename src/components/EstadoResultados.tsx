import { AlertTriangle } from 'lucide-react'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import type { EstadoResultados as Estado, CriterioResultados } from '../lib/estadoResultados'
import { Card } from './Card'

// El estado de resultados del ejercicio.
//
// Se parece a un estado de resultados de verdad a propósito: los mismos renglones, en el mismo
// orden, con los subtotales marcados. Quien lo lee ya sabe leerlo, y un contador que lo ve tiene
// que poder reconocerlo sin que se lo expliquen.

interface Props {
  estado: Estado
  aniosDisponibles: number[]
  onCambiarAnio: (anio: number) => void
  onCambiarCriterio: (criterio: CriterioResultados) => void
}

function Linea({
  etiqueta,
  monto,
  sangria = false,
  negativo = false,
}: {
  etiqueta: string
  monto: number
  sangria?: boolean
  negativo?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${sangria ? 'pl-4' : ''}`}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {etiqueta}
      </span>
      <span className="tabular shrink-0 text-sm" style={{ color: 'var(--text-primary)' }}>
        {negativo && monto !== 0 ? `(${formatoMoneda(Math.abs(monto))})` : formatoMoneda(monto)}
      </span>
    </div>
  )
}

function Subtotal({ etiqueta, monto, detalle }: { etiqueta: string; monto: number; detalle?: string }) {
  return (
    <div
      className="mt-1 flex items-baseline justify-between gap-3 border-t py-1.5"
      style={{ borderColor: 'var(--gridline)' }}
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {etiqueta}
        {detalle && (
          <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
            {detalle}
          </span>
        )}
      </span>
      <span
        className="tabular shrink-0 font-semibold"
        style={{ color: monto >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
      >
        {formatoMoneda(monto)}
      </span>
    </div>
  )
}

export function EstadoResultados({ estado, aniosDisponibles, onCambiarAnio, onCambiarCriterio }: Props) {
  const e = estado
  return (
    <div className="space-y-6">
      <Card as="section">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Estado de resultados {e.anio}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Por lo devengado y sin IVA: cada comprobante pesa en el año de su fecha, se haya cobrado o no.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1" role="group" aria-label="Criterio">
              {(['gestion', 'fiscal'] as CriterioResultados[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCambiarCriterio(c)}
                  aria-pressed={e.criterio === c}
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                  style={
                    e.criterio === c
                      ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: '#fff' }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                  }
                  title={
                    c === 'gestion'
                      ? 'Todo lo que pasó, con factura o sin ella'
                      : 'Solo lo que tiene respaldo fiscal, como lo ve ARCA'
                  }
                >
                  {c === 'gestion' ? 'De gestión' : 'Fiscal'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Ejercicio">
              {aniosDisponibles.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onCambiarAnio(a)}
                  aria-pressed={a === e.anio}
                  className="tabular rounded-full border px-3 py-1 text-xs font-medium"
                  style={
                    a === e.anio
                      ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: '#fff' }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {e.comprobantesSinIva > 0 && (
          <p
            className="mt-3 flex items-start gap-1.5 rounded-lg border p-2 text-xs"
            style={{ borderColor: 'var(--status-warning)', color: 'var(--text-secondary)' }}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--status-warning)' }} />
            <span>
              Hay {e.comprobantesSinIva} comprobante{e.comprobantesSinIva === 1 ? '' : 's'} del ejercicio sin IVA
              discriminado. Si tu actividad es responsable inscripto, esos importes están entrando con el IVA
              adentro y el resultado queda inflado — cargales el IVA en Comprobantes. Si sos monotributista está
              bien así: tus comprobantes no discriminan IVA.
            </span>
          </p>
        )}
      </Card>

      <Card as="section">
        <Linea etiqueta="Ventas netas" monto={e.ventasNetas} />
        {e.criterio === 'gestion' && e.ventasSinFactura !== 0 && (
          <p className="pl-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Incluye {formatoMoneda(e.ventasSinFactura)} sin factura
          </p>
        )}
        <Linea
          etiqueta={e.criterioCosto === 'stock' ? 'Costo de ventas (salidas de stock)' : 'Costo de ventas (compras del período)'}
          monto={e.costoVentas}
          negativo
        />
        <Subtotal etiqueta="Resultado bruto" monto={e.resultadoBruto} detalle={formatoPorcentaje(e.margenBrutoPct)} />

        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
            Gastos operativos
          </p>
          <Linea etiqueta="Sueldos y cargas sociales" monto={e.sueldos} sangria negativo />
          {e.gastos
            .filter((g) => g.monto !== 0)
            .map((g) => (
              <Linea key={g.key} etiqueta={g.label} monto={g.monto} sangria negativo />
            ))}
          <Linea etiqueta="Amortizaciones" monto={e.amortizaciones} sangria negativo />
        </div>
        <Subtotal etiqueta="Resultado operativo" monto={e.resultadoOperativo} />

        <div className="mt-4">
          <Linea etiqueta="Resultados financieros (descuento de cheques)" monto={e.resultadosFinancieros} />
          <Linea etiqueta="Impuestos (IIBB y monotributo)" monto={e.impuestos} negativo />
        </div>
        <Subtotal etiqueta="Resultado del ejercicio" monto={e.resultadoNeto} />
      </Card>

      {e.amortizacionesDetalle.sinDatos.length > 0 && (
        <Card as="section">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Bienes que todavía no amortizan
          </p>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Les falta la fecha de alta o los años de vida útil. Cargáselos en Patrimonio y entran solos acá. No
            les pongo una vida útil por defecto a propósito: sería un número que vos no decidiste y que después
            aparece firmado en un estado de resultados.
          </p>
          <ul className="space-y-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {e.amortizacionesDetalle.sinDatos.map((b) => (
              <li key={b.id} className="flex items-baseline justify-between gap-3">
                <span className="truncate">{b.concepto}</span>
                <span className="tabular shrink-0">{formatoMoneda(b.valorEstimado)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {e.amortizacionesDetalle.detalle.length > 0 && (
        <Card as="section">
          <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Detalle de amortizaciones
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                  <th className="pb-2 font-medium">Bien</th>
                  <th className="pb-2 text-right font-medium">Valor</th>
                  <th className="pb-2 text-right font-medium">Del ejercicio</th>
                  <th className="pb-2 text-right font-medium">Acumulada</th>
                  <th className="pb-2 text-right font-medium">Residual</th>
                </tr>
              </thead>
              <tbody>
                {e.amortizacionesDetalle.detalle.map((a) => (
                  <tr key={a.bien.id} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                    <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>
                      {a.bien.concepto}
                      <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {a.bien.vidaUtilAnios} años · {a.mesesEnElPeriodo} {a.mesesEnElPeriodo === 1 ? 'mes' : 'meses'}
                      </span>
                    </td>
                    <td className="tabular py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatoMoneda(a.bien.valorEstimado)}
                    </td>
                    <td className="tabular py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>
                      {formatoMoneda(a.delPeriodo)}
                    </td>
                    <td className="tabular py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatoMoneda(a.acumulada)}
                    </td>
                    <td className="tabular py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {formatoMoneda(a.residual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
