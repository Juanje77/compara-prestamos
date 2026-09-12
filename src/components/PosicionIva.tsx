import type { PosicionIvaMes } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  posicion: PosicionIvaMes[]
}

function mesLegible(mes: string): string {
  const [anio, m] = mes.split('-')
  const fecha = new Date(Number(anio), Number(m) - 1, 1)
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function PosicionIva({ posicion }: Props) {
  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Posición de IVA
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Débito fiscal (IVA de tus ventas) menos crédito fiscal (IVA de tus compras) por mes. Si el saldo
        técnico da a favor, se arrastra al mes siguiente como crédito; si da a pagar, no se arrastra nada. Se
        calcula a partir del IVA que cargaste en cada comprobante de Salud financiera.
      </p>

      {posicion.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay comprobantes con IVA cargado. Al agregar una factura en Salud financiera, completá
          también el campo IVA para que aparezca acá.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                <th className="pb-2 font-medium">Mes</th>
                <th className="pb-2 text-right font-medium">Saldo a favor mes anterior</th>
                <th className="pb-2 text-right font-medium">Débito fiscal</th>
                <th className="pb-2 text-right font-medium">Crédito fiscal</th>
                <th className="pb-2 text-right font-medium">Saldo técnico</th>
                <th className="pb-2 text-right font-medium">Resultado del mes</th>
              </tr>
            </thead>
            <tbody>
              {posicion.map((p) => (
                <tr key={p.mes} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                  <td className="py-2 capitalize" style={{ color: 'var(--text-primary)' }}>
                    {mesLegible(p.mes)}
                  </td>
                  <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(p.saldoAFavorAnterior)}
                  </td>
                  <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(p.debitoFiscal)}
                  </td>
                  <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(p.creditoFiscal)}
                  </td>
                  <td
                    className="tabular py-2 text-right font-medium"
                    style={{ color: p.saldoTecnico >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
                  >
                    {formatoMoneda(p.saldoTecnico)}
                  </td>
                  <td className="py-2 text-right">
                    {p.saldoAPagar > 0 ? (
                      <span className="font-semibold" style={{ color: 'var(--status-critical)' }}>
                        A pagar: {formatoMoneda(p.saldoAPagar)}
                      </span>
                    ) : (
                      <span className="font-semibold" style={{ color: 'var(--status-good-text)' }}>
                        A favor: {formatoMoneda(p.saldoAFavor)}
                      </span>
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
