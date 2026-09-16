import { useState } from 'react'
import {
  APORTES_PERSONALES_PCT_DEFAULT,
  CONTRIBUCIONES_PATRONALES_PCT_DEFAULT,
  calcularCostoEmpleado,
  type Empleado,
  type NominaTotal,
} from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'

interface Props {
  empleados: Empleado[]
  nomina: NominaTotal
  onAgregar: (empleado: Omit<Empleado, 'id'>) => void
  onActualizar: (id: string, cambios: Partial<Omit<Empleado, 'id'>>) => void
  onEliminar: (id: string) => void
}

function FilaEmpleado({
  empleado,
  onActualizar,
  onEliminar,
}: {
  empleado: Empleado
  onActualizar: Props['onActualizar']
  onEliminar: Props['onEliminar']
}) {
  const costo = calcularCostoEmpleado(empleado)

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: 'var(--border)',
        background: empleado.activo ? 'var(--surface-1)' : 'var(--surface-2)',
        opacity: empleado.activo ? 1 : 0.7,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {empleado.nombre}
          </p>
          {!empleado.activo && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'var(--gridline)', color: 'var(--text-muted)' }}
            >
              De baja
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onActualizar(empleado.id, { activo: !empleado.activo })}
            className="rounded-lg border px-2.5 py-1 text-xs font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            {empleado.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
          <button onClick={() => onEliminar(empleado.id)} aria-label="Eliminar" className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
            🗑
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Sueldo bruto
          </span>
          <InputMoneda
            value={empleado.sueldoBruto}
            onChange={(v) => onActualizar(empleado.id, { sueldoBruto: v })}
            className="tabular mt-0.5 w-32 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Aportes personales %
          </span>
          <InputMoneda
            value={empleado.aportesPersonalesPct}
            onChange={(v) => onActualizar(empleado.id, { aportesPersonalesPct: v })}
            className="tabular mt-0.5 w-24 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Contribuciones patronales %
          </span>
          <InputMoneda
            value={empleado.contribucionesPatronalesPct}
            onChange={(v) => onActualizar(empleado.id, { contribucionesPatronalesPct: v })}
            className="tabular mt-0.5 w-24 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 border-t pt-3" style={{ borderColor: 'var(--gridline)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Neto de bolsillo
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(costo.sueldoNeto)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Contribuciones patronales
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(costo.contribucionesPatronales)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Costo para la empresa
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--series-blue)' }}>
            {formatoMoneda(costo.costoEmpresa)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Sueldos({ empleados, nomina, onAgregar, onActualizar, onEliminar }: Props) {
  const [nombre, setNombre] = useState('')
  const [sueldoBruto, setSueldoBruto] = useState(0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || sueldoBruto <= 0) return
    onAgregar({
      nombre: nombre.trim(),
      sueldoBruto,
      aportesPersonalesPct: APORTES_PERSONALES_PCT_DEFAULT,
      contribucionesPatronalesPct: CONTRIBUCIONES_PATRONALES_PCT_DEFAULT,
      activo: true,
    })
    setNombre('')
    setSueldoBruto(0)
  }

  const ordenados = [...empleados].sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre))

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Sueldos y cargas sociales
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cargá el sueldo bruto de cada empleado — los porcentajes de aportes personales y
          contribuciones patronales vienen con un valor de referencia editable por si tu actividad
          tiene una alícuota distinta. El costo para la empresa de la nómina activa alimenta solo
          la categoría "Sueldos" de Presupuesto vs. Real y el Dashboard, como el resto de las
          categorías automáticas.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nombre del empleado"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="min-w-[180px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <InputMoneda
            placeholder="Sueldo bruto"
            value={sueldoBruto}
            onChange={setSueldoBruto}
            className="tabular w-36 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--series-blue)' }}
          >
            Agregar empleado
          </button>
        </form>
      </section>

      {nomina.cantidadActivos > 0 && (
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <p className="mb-3 text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
            Nómina vigente ({nomina.cantidadActivos} activo{nomina.cantidadActivos === 1 ? '' : 's'})
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total bruto
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(nomina.totalBruto)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total neto
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {formatoMoneda(nomina.totalNeto)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Contribuciones
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {formatoMoneda(nomina.totalContribuciones)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Costo para la empresa
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--series-blue)' }}>
                {formatoMoneda(nomina.totalCostoEmpresa)}
              </p>
            </div>
          </div>
        </section>
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ningún empleado.
        </p>
      ) : (
        <div className="space-y-3">
          {ordenados.map((e) => (
            <FilaEmpleado key={e.id} empleado={e} onActualizar={onActualizar} onEliminar={onEliminar} />
          ))}
        </div>
      )}
    </div>
  )
}
