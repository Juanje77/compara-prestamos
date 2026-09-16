import { useState } from 'react'
import {
  APORTES_PERSONALES_PCT_DEFAULT,
  CARGAS_SOCIALES_ADICIONALES_PCT_DEFAULT,
  CONCEPTO_PAGO_SUELDOS_LABEL,
  CONTRIBUCIONES_PATRONALES_PCT_DEFAULT,
  calcularCostoEmpleado,
  calcularPagosSueldos,
  type ConceptoPagoSueldos,
  type CuentaBancaria,
  type Empleado,
  type MovimientoTesoreria,
  type NominaTotal,
  type PagoSueldos,
  type Sector,
} from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'

interface Props {
  empleados: Empleado[]
  nomina: NominaTotal
  /** Medio sueldo por empleado con sus cargas — solo se paga en junio y diciembre. */
  aguinaldo: NominaTotal
  /** Sectores creados en Márgenes por sector, para repartir el costo de cada empleado. */
  sectores: Sector[]
  /** Cajas y cuentas de Tesorería, para elegir de dónde sale la plata al pagar la nómina. */
  cuentas: CuentaBancaria[]
  movimientosTesoreria: MovimientoTesoreria[]
  onAgregar: (empleado: Omit<Empleado, 'id'>) => void
  onActualizar: (id: string, cambios: Partial<Omit<Empleado, 'id'>>) => void
  onEliminar: (id: string) => void
  onPagar: (concepto: ConceptoPagoSueldos, mes: string, monto: number, cuentaId: string, fecha: string) => void
  onDeshacerPago: (movimientoId: string) => void
}

function mesActualISO(): string {
  return new Date().toISOString().slice(0, 7)
}

function etiquetaMes(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number)
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function FilaEmpleado({
  empleado,
  sectores,
  onActualizar,
  onEliminar,
}: {
  empleado: Empleado
  sectores: Sector[]
  onActualizar: Props['onActualizar']
  onEliminar: Props['onEliminar']
}) {
  const costo = calcularCostoEmpleado(empleado)
  const asignaciones = empleado.asignaciones ?? []
  const totalAsignado = asignaciones.reduce((s, a) => s + a.porcentaje, 0)

  function cambiarAsignacion(sectorId: string, porcentaje: number) {
    const resto = asignaciones.filter((a) => a.sectorId !== sectorId)
    onActualizar(empleado.id, {
      asignaciones: porcentaje > 0 ? [...resto, { sectorId, porcentaje }] : resto,
    })
  }

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
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Cargas sociales adicionales %
          </span>
          <InputMoneda
            value={empleado.cargasSocialesAdicionalesPct}
            onChange={(v) => onActualizar(empleado.id, { cargasSocialesAdicionalesPct: v })}
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
            Cargas sociales adicionales
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(costo.cargasSocialesAdicionales)}
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

      {sectores.length > 0 && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--gridline)' }}>
          <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Reparto por sector <span style={{ color: 'var(--text-secondary)' }}>(% del costo)</span> — si hace varias
            tareas, repartilo entre los sectores que corresponda.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {sectores.map((s) => (
              <label key={s.id} className="block">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {s.nombre}
                </span>
                <InputMoneda
                  value={asignaciones.find((a) => a.sectorId === s.id)?.porcentaje ?? 0}
                  onChange={(v) => cambiarAsignacion(s.id, v)}
                  className="tabular mt-0.5 w-20 rounded-lg border px-2 py-1 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
              </label>
            ))}
            <p
              className="tabular pb-1 text-xs font-semibold"
              style={{ color: totalAsignado > 100 ? 'var(--status-critical)' : 'var(--text-muted)' }}
            >
              {totalAsignado}% asignado
              {totalAsignado > 100 && ' — te pasaste del 100%'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function FilaPago({
  pago,
  cuentas,
  onPagar,
  onDeshacerPago,
}: {
  pago: PagoSueldos
  cuentas: CuentaBancaria[]
  onPagar: Props['onPagar']
  onDeshacerPago: Props['onDeshacerPago']
}) {
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '')
  const [fecha, setFecha] = useState(pago.fechaEstimada)

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
      style={{
        borderColor: pago.pagado ? 'var(--status-good-text)' : 'var(--border)',
        background: pago.pagado ? 'color-mix(in srgb, var(--status-good) 6%, transparent)' : 'var(--surface-1)',
      }}
    >
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {CONCEPTO_PAGO_SUELDOS_LABEL[pago.concepto]}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {pago.pagado ? 'Pagado' : `Estimado para el ${new Date(`${pago.fechaEstimada}T00:00:00`).toLocaleDateString('es-AR')}`}
        </p>
      </div>
      <p className="tabular shrink-0 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        {formatoMoneda(pago.monto)}
      </p>

      {pago.pagado ? (
        <button
          onClick={() => pago.movimientoId && onDeshacerPago(pago.movimientoId)}
          className="shrink-0 rounded-lg border px-3 py-1 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Deshacer pago
        </button>
      ) : (
        <>
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="shrink-0 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          >
            <option value="">Cuenta…</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="tabular w-36 shrink-0 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={() => cuentaId && onPagar(pago.concepto, pago.mes, pago.monto, cuentaId, fecha)}
            disabled={!cuentaId}
            className="shrink-0 rounded-lg px-3 py-1 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--series-blue)' }}
          >
            Registrar pago
          </button>
        </>
      )}
    </div>
  )
}

function PanelPagos({
  nomina,
  aguinaldo,
  cuentas,
  movimientosTesoreria,
  onPagar,
  onDeshacerPago,
}: {
  nomina: NominaTotal
  aguinaldo: NominaTotal
  cuentas: CuentaBancaria[]
  movimientosTesoreria: MovimientoTesoreria[]
  onPagar: Props['onPagar']
  onDeshacerPago: Props['onDeshacerPago']
}) {
  const [mes, setMes] = useState(mesActualISO)
  const pagos = calcularPagosSueldos(nomina, mes, movimientosTesoreria, aguinaldo)

  function sumarMeses(delta: number) {
    const [anio, m] = mes.split('-').map(Number)
    const fecha = new Date(anio, m - 1 + delta, 1)
    setMes(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Pago de la nómina
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => sumarMeses(-1)}
            aria-label="Mes anterior"
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            ←
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {etiquetaMes(mes)}
          </span>
          <button
            onClick={() => sumarMeses(1)}
            aria-label="Mes siguiente"
            className="rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            →
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        La nómina se paga en dos veces: primero los netos a cada empleado, y después todo lo que va
        a AFIP, ART y sindicato con el F.931. Al registrar cada pago, la plata sale de la caja o
        cuenta que elijas y el saldo en Tesorería baja al toque.
      </p>

      {cuentas.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Cargá una caja o cuenta en Tesorería para poder registrar el pago.
        </p>
      ) : (
        <div className="space-y-2">
          {pagos.map((p) => (
            <FilaPago key={p.concepto} pago={p} cuentas={cuentas} onPagar={onPagar} onDeshacerPago={onDeshacerPago} />
          ))}
        </div>
      )}
    </section>
  )
}

export function Sueldos({
  empleados,
  nomina,
  aguinaldo,
  sectores,
  cuentas,
  movimientosTesoreria,
  onAgregar,
  onActualizar,
  onEliminar,
  onPagar,
  onDeshacerPago,
}: Props) {
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
      cargasSocialesAdicionalesPct: CARGAS_SOCIALES_ADICIONALES_PCT_DEFAULT,
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
          Cargá el sueldo bruto de cada empleado. La empresa paga dos cosas distintas además del
          bruto: las <strong>contribuciones patronales</strong> (jubilación, PAMI y obra social a
          cargo del empleador) y otras <strong>cargas sociales adicionales</strong> (ART, seguro de
          vida obligatorio, cuota sindical patronal). Los tres porcentajes vienen con un valor de
          referencia editable por si tu actividad tiene alícuotas distintas. El costo para la
          empresa de la nómina activa reemplaza al estimado de sueldos en todo el Dashboard —
          composición de gastos, margen operativo, runway y punto de equilibrio— y en Presupuesto
          vs. Real.
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-5">
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
                Contribuciones patronales
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {formatoMoneda(nomina.totalContribucionesPatronales)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Cargas sociales adicionales
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {formatoMoneda(nomina.totalCargasSocialesAdicionales)}
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

      {nomina.cantidadActivos > 0 && (
        <PanelPagos
          nomina={nomina}
          aguinaldo={aguinaldo}
          cuentas={cuentas}
          movimientosTesoreria={movimientosTesoreria}
          onPagar={onPagar}
          onDeshacerPago={onDeshacerPago}
        />
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ningún empleado.
        </p>
      ) : (
        <div className="space-y-3">
          {ordenados.map((e) => (
            <FilaEmpleado key={e.id} empleado={e} sectores={sectores} onActualizar={onActualizar} onEliminar={onEliminar} />
          ))}
        </div>
      )}
    </div>
  )
}
