import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { IngresosBrutosManualMes, PosicionIngresosBrutosMes } from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { InfoTooltip } from './InfoTooltip'
import { IconButton } from './IconButton'
import { Card } from './Card'
import { Button } from './Button'

interface Props {
  posicion: PosicionIngresosBrutosMes[]
  onCambiarManual: (mes: string, campo: keyof IngresosBrutosManualMes, valor: number | undefined) => void
  onEliminarMes: (mes: string) => void
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
  sufijo,
  onCambiar,
  onQuitar,
}: {
  valor: number
  esManual: boolean
  sufijo?: string
  onCambiar: (valor: number) => void
  onQuitar: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {esManual && (
        <button
          onClick={onQuitar}
          title="Volver al valor por defecto"
          className="shrink-0 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          ↺
        </button>
      )}
      {sufijo === '%' ? (
        <input
          type="number"
          step={0.1}
          value={valor}
          onChange={(e) => onCambiar(Number(e.target.value))}
          className="tabular w-24 rounded-lg border px-2 py-1 text-right text-sm"
          style={{
            borderColor: esManual ? 'var(--series-blue)' : 'var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
          }}
        />
      ) : (
        <InputMoneda
          value={valor}
          onChange={onCambiar}
          className="tabular w-24 rounded-lg border px-2 py-1 text-right text-sm"
          style={{
            borderColor: esManual ? 'var(--series-blue)' : 'var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
          }}
        />
      )}
      {sufijo && (
        <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          {sufijo}
        </span>
      )}
    </div>
  )
}

export function PosicionIngresosBrutos({ posicion, onCambiarManual, onEliminarMes }: Props) {
  const [mesNuevo, setMesNuevo] = useState(() => new Date().toISOString().slice(0, 7))

  function handleAgregarMes(e: React.FormEvent) {
    e.preventDefault()
    if (!mesNuevo || posicion.some((p) => p.mes === mesNuevo)) return
    onCambiarManual(mesNuevo, 'retenciones', 0)
  }

  function handleEliminarMes(mes: string) {
    if (!window.confirm(`¿Eliminar ${mesLegible(mes)} de la Posición de Ingresos Brutos? Si tiene ventas cargadas ese mes, va a volver a aparecer con los valores automáticos.`)) return
    onEliminarMes(mes)
  }

  return (
    <Card as="section">
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Posición de Ingresos Brutos — La Pampa
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Por mes: tu facturación neta de IVA (base imponible) multiplicada por la alícuota, menos las
        retenciones/percepciones que ya te hicieron los clientes. A diferencia del IVA, no arrastra saldo de
        un mes a otro. La base imponible se completa sola con tus facturas emitidas de Comprobantes; la
        alícuota y las retenciones son siempre editables a mano.
      </p>

      <form onSubmit={handleAgregarMes} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={mesNuevo}
          onChange={(e) => setMesNuevo(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <Button type="submit" variante="primario">
          Agregar mes a mano
        </Button>
      </form>

      {posicion.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no hay ningún mes cargado. Agregá uno arriba, o cargá una venta en Comprobantes para que
          aparezca acá solo.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                <th className="pb-2 font-medium">Mes</th>
                <th className="pb-2 text-right font-medium">
                  <span className="flex items-center justify-end gap-1.5">
                    Base imponible
                    <InfoTooltip texto="Lo que facturaste en el mes, sin IVA — es el monto sobre el que se calcula el impuesto." />
                  </span>
                </th>
                <th className="pb-2 text-right font-medium">
                  <span className="flex items-center justify-end gap-1.5">
                    Alícuota
                    <InfoTooltip texto="El porcentaje que te cobra la provincia sobre tus ventas (en La Pampa, la general es 3%)." />
                  </span>
                </th>
                <th className="pb-2 text-right font-medium">Impuesto determinado</th>
                <th className="pb-2 text-right font-medium">
                  <span className="flex items-center justify-end gap-1.5">
                    Retenciones
                    <InfoTooltip texto="Lo que ya te descontaron tus clientes por este impuesto — se resta de lo que tenés que pagar." />
                  </span>
                </th>
                <th className="pb-2 text-right font-medium">Resultado del mes</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {posicion.map((p) => (
                <tr key={p.mes} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                  <td className="py-2 whitespace-nowrap capitalize" style={{ color: 'var(--text-primary)' }}>
                    {mesLegible(p.mes)}
                  </td>
                  <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(p.baseImponible)}
                  </td>
                  <td className="py-2">
                    <CeldaEditable
                      valor={p.alicuotaPct}
                      esManual={p.alicuotaPctEsManual}
                      sufijo="%"
                      onCambiar={(v) => onCambiarManual(p.mes, 'alicuotaPct', v)}
                      onQuitar={() => onCambiarManual(p.mes, 'alicuotaPct', undefined)}
                    />
                  </td>
                  <td className="tabular py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatoMoneda(p.impuestoDeterminado)}
                  </td>
                  <td className="py-2">
                    <CeldaEditable
                      valor={p.retenciones}
                      esManual={p.retencionesEsManual}
                      onCambiar={(v) => onCambiarManual(p.mes, 'retenciones', v)}
                      onQuitar={() => onCambiarManual(p.mes, 'retenciones', undefined)}
                    />
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
                  <td className="py-2 text-right">
                    <IconButton icon={Trash2} onClick={() => handleEliminarMes(p.mes)} label={`Eliminar ${mesLegible(p.mes)}`} className="shrink-0" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
