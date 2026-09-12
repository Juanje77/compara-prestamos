import { useState } from 'react'
import type { IvaManualMes, PosicionIvaMes } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'

interface Props {
  posicion: PosicionIvaMes[]
  onCambiarManual: (mes: string, campo: keyof IvaManualMes, valor: number | undefined) => void
}

function mesLegible(mes: string): string {
  const [anio, m] = mes.split('-')
  const fecha = new Date(Number(anio), Number(m) - 1, 1)
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function CeldaEditable({
  valor,
  esManual,
  onCambiar,
  onQuitar,
}: {
  valor: number
  esManual: boolean
  onCambiar: (valor: number) => void
  onQuitar: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {esManual && (
        <button
          onClick={onQuitar}
          title="Volver a calcularlo automáticamente desde los comprobantes"
          className="shrink-0 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          ↺
        </button>
      )}
      <input
        type="number"
        value={valor}
        onChange={(e) => onCambiar(Number(e.target.value))}
        className="tabular w-28 rounded-lg border px-2 py-1 text-right text-sm"
        style={{
          borderColor: esManual ? 'var(--series-blue)' : 'var(--border)',
          background: 'var(--surface-1)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  )
}

export function PosicionIva({ posicion, onCambiarManual }: Props) {
  const [mesNuevo, setMesNuevo] = useState(() => new Date().toISOString().slice(0, 7))

  function handleAgregarMes(e: React.FormEvent) {
    e.preventDefault()
    if (!mesNuevo || posicion.some((p) => p.mes === mesNuevo)) return
    onCambiarManual(mesNuevo, 'creditoFiscal', 0)
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Posición de IVA
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Débito fiscal (IVA de tus ventas) menos crédito fiscal (IVA de tus compras) por mes. Si el saldo
        técnico da a favor, se arrastra al mes siguiente como crédito; si da a pagar, no se arrastra nada. Se
        completa solo con el IVA que cargues en cada comprobante de Salud financiera, pero cualquier valor se
        puede pisar a mano (por ejemplo, si no cargaste el IVA comprobante por comprobante, o para corregir el
        saldo a favor con el que arrancaste a usar FinCorp).
      </p>

      <form onSubmit={handleAgregarMes} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={mesNuevo}
          onChange={(e) => setMesNuevo(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--series-blue)' }}
        >
          Agregar mes a mano
        </button>
      </form>

      {posicion.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay ningún mes cargado. Agregá uno arriba, o completá el campo IVA al cargar una factura
          en Salud financiera para que aparezca acá solo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
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
                  <td className="py-2 whitespace-nowrap capitalize" style={{ color: 'var(--text-primary)' }}>
                    {mesLegible(p.mes)}
                  </td>
                  <td className="py-2">
                    <CeldaEditable
                      valor={p.saldoAFavorAnterior}
                      esManual={p.saldoAFavorAnteriorEsManual}
                      onCambiar={(v) => onCambiarManual(p.mes, 'saldoAFavorAnterior', v)}
                      onQuitar={() => onCambiarManual(p.mes, 'saldoAFavorAnterior', undefined)}
                    />
                  </td>
                  <td className="py-2">
                    <CeldaEditable
                      valor={p.debitoFiscal}
                      esManual={p.debitoFiscalEsManual}
                      onCambiar={(v) => onCambiarManual(p.mes, 'debitoFiscal', v)}
                      onQuitar={() => onCambiarManual(p.mes, 'debitoFiscal', undefined)}
                    />
                  </td>
                  <td className="py-2">
                    <CeldaEditable
                      valor={p.creditoFiscal}
                      esManual={p.creditoFiscalEsManual}
                      onCambiar={(v) => onCambiarManual(p.mes, 'creditoFiscal', v)}
                      onQuitar={() => onCambiarManual(p.mes, 'creditoFiscal', undefined)}
                    />
                  </td>
                  <td
                    className="tabular py-2 text-right font-medium"
                    style={{ color: p.saldoTecnico >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
                  >
                    {formatoMoneda(p.saldoTecnico)}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
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
