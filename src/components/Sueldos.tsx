import { useState } from 'react'
import {
  BASE_DESCUENTO_LABEL,
  CARGAS_SOCIALES_ADICIONALES_PCT_DEFAULT,
  DESCUENTOS_DEFAULT,
  CONCEPTO_PAGO_SUELDOS_LABEL,
  CONTRIBUCIONES_PATRONALES_PCT_DEFAULT,
  calcularCostoEmpleado,
  TIPO_LIQUIDACION_LABEL,
  buscarLiquidacion,
  calcularPagosSueldos,
  idOrigenPagoSueldos,
  previsualizarLiquidacion,
  totalesDeLiquidacion,
  type BaseDescuento,
  type ConceptoHaber,
  type ConceptoPagoSueldos,
  type CuentaBancaria,
  type DatosEmpleador,
  type Liquidacion,
  type TipoLiquidacion,
  type DescuentoEmpleado,
  type Empleado,
  type MovimientoTesoreria,
  type NominaTotal,
  type PagoSueldos,
  type Sector,
} from '../lib/cfo'
import { formatoMoneda } from '../lib/finance'
import { abrirLibroSueldos, abrirRecibosSueldo } from '../lib/htmlReport'
import { InputMoneda } from './InputMoneda'

interface Props {
  nombreNegocio: string
  datosEmpleador: DatosEmpleador
  onCambiarDatosEmpleador: (datos: DatosEmpleador) => void
  liquidaciones: Liquidacion[]
  onCerrarLiquidacion: (mes: string, tipo: TipoLiquidacion) => void
  onReabrirLiquidacion: (id: string) => void
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

function nuevoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  onImprimir,
}: {
  empleado: Empleado
  sectores: Sector[]
  onImprimir: (empleado: Empleado) => void
  onActualizar: Props['onActualizar']
  onEliminar: Props['onEliminar']
}) {
  const [abierto, setAbierto] = useState(false)
  const costo = calcularCostoEmpleado(empleado)
  const asignaciones = empleado.asignaciones ?? []
  const totalAsignado = asignaciones.reduce((s, a) => s + a.porcentaje, 0)
  const conceptos = empleado.conceptos ?? []
  const descuentos = empleado.descuentos ?? DESCUENTOS_DEFAULT.map((d, i) => ({ ...d, id: `default-${i}` }))

  function cambiarConceptos(nuevos: ConceptoHaber[]) {
    onActualizar(empleado.id, { conceptos: nuevos })
  }

  function cambiarDescuentos(nuevos: DescuentoEmpleado[]) {
    onActualizar(empleado.id, { descuentos: nuevos })
  }

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
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setAbierto(!abierto)}
          aria-expanded={abierto}
          className="flex min-w-[180px] flex-1 items-center gap-2 text-left"
        >
          <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
            {abierto ? '▾' : '▸'}
          </span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {empleado.nombre}
          </span>
          {empleado.categoria && (
            <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {empleado.categoria}
            </span>
          )}
          {!empleado.activo && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'var(--gridline)', color: 'var(--text-muted)' }}
            >
              De baja
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-4 text-right">
          <div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Neto
            </p>
            <p className="tabular text-sm font-semibold" style={{ color: 'var(--status-good-text)' }}>
              {formatoMoneda(costo.sueldoNeto)}
            </p>
          </div>
          <div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Costo empresa
            </p>
            <p className="tabular text-sm font-semibold" style={{ color: 'var(--series-blue)' }}>
              {formatoMoneda(costo.costoEmpresa)}
            </p>
          </div>
          <button
            onClick={() => onImprimir(empleado)}
            title="Imprimir recibo"
            aria-label={`Imprimir recibo de ${empleado.nombre}`}
            className="rounded-lg border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            🖨
          </button>
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

      {abierto && (
      <>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Sueldo básico
          </span>
          <InputMoneda
            value={empleado.sueldoBruto}
            onChange={(v) => onActualizar(empleado.id, { sueldoBruto: v })}
            className="tabular mt-0.5 w-36 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            CUIL
          </span>
          <input
            type="text"
            placeholder="20-12345678-3"
            value={empleado.cuil ?? ''}
            onChange={(e) => onActualizar(empleado.id, { cuil: e.target.value })}
            className="tabular mt-0.5 w-36 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Fecha de ingreso
          </span>
          <input
            type="date"
            value={empleado.fechaIngreso ?? ''}
            onChange={(e) => onActualizar(empleado.id, { fechaIngreso: e.target.value })}
            className="tabular mt-0.5 w-36 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Legajo
          </span>
          <input
            type="text"
            value={empleado.legajo ?? ''}
            onChange={(e) => onActualizar(empleado.id, { legajo: e.target.value })}
            className="tabular mt-0.5 w-20 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
        </label>
        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Categoría / convenio
          </span>
          <input
            type="text"
            placeholder="Ej: Administrativo A — CCT 130/75"
            value={empleado.categoria ?? ''}
            onChange={(e) => onActualizar(empleado.id, { categoria: e.target.value })}
            className="mt-0.5 w-60 rounded-lg border px-2 py-1 text-sm"
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

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--gridline)' }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Otros haberes <span style={{ color: 'var(--text-secondary)' }}>(antigüedad, presentismo, acuerdos)</span>
          </p>
          <button
            onClick={() =>
              cambiarConceptos([...conceptos, { id: nuevoId(), descripcion: '', monto: 0, remunerativo: true }])
            }
            className="rounded-lg border px-2 py-0.5 text-xs font-medium"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            + Agregar haber
          </button>
        </div>
        {conceptos.map((c, i) => (
          <div key={c.id} className="mb-1.5 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Concepto"
              value={c.descripcion}
              onChange={(e) =>
                cambiarConceptos(conceptos.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))
              }
              className="min-w-[160px] flex-1 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <InputMoneda
              value={c.monto}
              onChange={(v) => cambiarConceptos(conceptos.map((x, j) => (j === i ? { ...x, monto: v } : x)))}
              className="tabular w-32 shrink-0 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <select
              value={c.remunerativo ? 'rem' : 'norem'}
              onChange={(e) =>
                cambiarConceptos(
                  conceptos.map((x, j) => (j === i ? { ...x, remunerativo: e.target.value === 'rem' } : x)),
                )
              }
              className="shrink-0 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            >
              <option value="rem">Remunerativo</option>
              <option value="norem">No remunerativo</option>
            </select>
            <button
              onClick={() => cambiarConceptos(conceptos.filter((_, j) => j !== i))}
              aria-label="Quitar haber"
              className="shrink-0 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--gridline)' }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Descuentos al empleado
          </p>
          <button
            onClick={() =>
              cambiarDescuentos([...descuentos, { id: nuevoId(), descripcion: '', porcentaje: 0, base: 'total' }])
            }
            className="rounded-lg border px-2 py-0.5 text-xs font-medium"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            + Agregar descuento
          </button>
        </div>
        {costo.descuentos.map((d, i) => (
          <div key={d.id} className="mb-1.5 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Ej: S.E.C. Art. 100 CCT 130/75"
              value={d.descripcion}
              onChange={(e) =>
                cambiarDescuentos(descuentos.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))
              }
              className="min-w-[160px] flex-1 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <InputMoneda
              value={d.porcentaje}
              onChange={(v) => cambiarDescuentos(descuentos.map((x, j) => (j === i ? { ...x, porcentaje: v } : x)))}
              className="tabular w-20 shrink-0 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <select
              value={d.base}
              onChange={(e) =>
                cambiarDescuentos(
                  descuentos.map((x, j) => (j === i ? { ...x, base: e.target.value as BaseDescuento } : x)),
                )
              }
              className="shrink-0 rounded-lg border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            >
              {(Object.keys(BASE_DESCUENTO_LABEL) as BaseDescuento[]).map((b) => (
                <option key={b} value={b}>
                  {BASE_DESCUENTO_LABEL[b]}
                </option>
              ))}
            </select>
            <span className="tabular w-32 shrink-0 text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatoMoneda(d.monto)}
            </span>
            <button
              onClick={() => cambiarDescuentos(descuentos.filter((_, j) => j !== i))}
              aria-label="Quitar descuento"
              className="shrink-0 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-3 sm:grid-cols-3" style={{ borderColor: 'var(--gridline)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Remunerativo
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(costo.remunerativo)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No remunerativo
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatoMoneda(costo.noRemunerativo)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total descuentos
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(costo.totalDescuentos)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Neto de bolsillo
          </p>
          <p className="tabular text-lg font-semibold" style={{ color: 'var(--status-good-text)' }}>
            {formatoMoneda(costo.sueldoNeto)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Contribuciones + cargas
          </p>
          <p className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {formatoMoneda(costo.contribucionesPatronales + costo.cargasSocialesAdicionales)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Costo para la empresa
          </p>
          <p className="tabular text-lg font-semibold" style={{ color: 'var(--series-blue)' }}>
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
      </>
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
  nombreNegocio,
  datosEmpleador,
  onCambiarDatosEmpleador,
  liquidaciones,
  onCerrarLiquidacion,
  onReabrirLiquidacion,
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

  function imprimirRecibos(deQuienes: Empleado[], tipo: TipoLiquidacion = 'mensual') {
    if (deQuienes.length === 0) return
    const mes = mesActualISO()
    const cerrada = buscarLiquidacion(liquidaciones, mes, tipo)
    // Si el mes está cerrado se imprime lo congelado (con su número); si no, un borrador.
    const idsPedidos = new Set(deQuienes.map((e) => e.id))
    const completa = cerrada ?? previsualizarLiquidacion(deQuienes, mes, tipo)
    const liquidacion = { ...completa, recibos: completa.recibos.filter((r) => idsPedidos.has(r.empleadoId)) }
    const buscarPago = (mesBuscado: string, concepto: 'netos' | 'cargas') =>
      movimientosTesoreria.find(
        (m) => m.origen === 'sueldo' && m.origenId === idOrigenPagoSueldos(mesBuscado, concepto),
      )
    // La constancia de aportes que exige el recibo es la del mes anterior al liquidado.
    const [anio, numeroMes] = mes.split('-').map(Number)
    const anterior = new Date(anio, numeroMes - 2, 1)
    const mesAnterior = `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, '0')}`
    const pagoCargas = buscarPago(mesAnterior, 'cargas')
    const cuentaDelPago = cuentas.find((c) => c.id === pagoCargas?.cuentaId)

    abrirRecibosSueldo({
      nombreNegocio,
      empleador: datosEmpleador,
      liquidacion,
      fechaPago: buscarPago(mes, 'netos')?.fecha,
      depositoAportes: pagoCargas
        ? { periodo: mesAnterior, fecha: pagoCargas.fecha, entidad: cuentaDelPago?.nombre ?? 'cuenta registrada' }
        : undefined,
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || sueldoBruto <= 0) return
    onAgregar({
      nombre: nombre.trim(),
      sueldoBruto,
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
          Cada empleado se arma como su recibo: el <strong>básico</strong> más los haberes que
          correspondan, separando los <strong>remunerativos</strong> de los{' '}
          <strong>no remunerativos</strong> (los acuerdos no remunerativos no pagan jubilación ni
          PAMI ni generan contribuciones patronales). Los descuentos vienen con los tres de
          siempre —jubilación 11%, Ley 19.032 3% y obra social 3%— y podés sumar los de tu convenio
          (S.E.C., F.A.E.C. y S., cuota sindical), cada uno con la base sobre la que se calcula. El
          costo para la empresa de la nómina activa reemplaza al estimado de sueldos en todo el
          Dashboard —composición de gastos, margen operativo, runway y punto de equilibrio— y en
          Presupuesto vs. Real.
        </p>

        <div className="mb-4 rounded-lg border p-3" style={{ borderColor: 'var(--gridline)', background: 'var(--surface-2)' }}>
          <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Datos de la empresa para el recibo{' '}
            <span style={{ color: 'var(--text-secondary)' }}>(obligatorios por el art. 140 de la LCT)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="CUIT del empleador"
              value={datosEmpleador.cuit}
              onChange={(e) => onCambiarDatosEmpleador({ ...datosEmpleador, cuit: e.target.value })}
              className="w-44 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              placeholder="Domicilio de la empresa"
              value={datosEmpleador.domicilio}
              onChange={(e) => onCambiarDatosEmpleador({ ...datosEmpleador, domicilio: e.target.value })}
              className="min-w-[200px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              placeholder="Lugar de pago (localidad)"
              value={datosEmpleador.lugarPago}
              onChange={(e) => onCambiarDatosEmpleador({ ...datosEmpleador, lugarPago: e.target.value })}
              className="w-52 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
              Nómina vigente ({nomina.cantidadActivos} activo{nomina.cantidadActivos === 1 ? '' : 's'})
            </p>
            <button
              onClick={() => imprimirRecibos(empleados.filter((e) => e.activo))}
              className="rounded-lg border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              🖨 Imprimir todos los recibos
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Remunerativo
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(nomina.totalRemunerativo)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No remunerativo
              </p>
              <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(nomina.totalNoRemunerativo)}
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

      {empleados.some((e) => e.activo) && (
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Liquidaciones y libro de sueldos
            </h3>
            <button
              onClick={() => abrirLibroSueldos({ nombreNegocio, empleador: datosEmpleador, liquidaciones })}
              className="rounded-lg border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              📖 Ver libro de sueldos
            </button>
          </div>
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Cerrar el período congela lo liquidado y le asigna a cada recibo su número correlativo. Hasta que no lo
            cierres, los recibos salen como borrador sin numerar y el mes no entra al libro.
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(['mensual', 'aguinaldo'] as TipoLiquidacion[]).map((tipo) => {
              const cerrada = buscarLiquidacion(liquidaciones, mesActualISO(), tipo)
              return (
                <button
                  key={tipo}
                  onClick={() => (cerrada ? onReabrirLiquidacion(cerrada.id) : onCerrarLiquidacion(mesActualISO(), tipo))}
                  className="rounded-lg border px-3 py-1.5 text-sm font-semibold"
                  style={
                    cerrada
                      ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                      : { borderColor: 'var(--series-blue)', background: 'var(--series-blue)', color: 'white' }
                  }
                >
                  {cerrada ? `Reabrir ${TIPO_LIQUIDACION_LABEL[tipo].toLowerCase()} de este mes` : `Cerrar liquidación ${tipo === 'aguinaldo' ? 'de aguinaldo' : 'del mes'}`}
                </button>
              )
            })}
          </div>

          {liquidaciones.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Todavía no cerraste ningún período.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...liquidaciones]
                .sort((a, b) => b.mes.localeCompare(a.mes))
                .map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--gridline)' }}
                  >
                    <span className="min-w-[150px] flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {etiquetaMes(l.mes)}
                      <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                        {TIPO_LIQUIDACION_LABEL[l.tipo]}
                      </span>
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Recibos {String(l.recibos[0]?.numeroRecibo ?? 0).padStart(6, '0')}–
                      {String(l.recibos[l.recibos.length - 1]?.numeroRecibo ?? 0).padStart(6, '0')}
                    </span>
                    <span className="tabular shrink-0 font-semibold" style={{ color: 'var(--status-good-text)' }}>
                      {formatoMoneda(totalesDeLiquidacion(l.recibos).neto)}
                    </span>
                    <button
                      onClick={() =>
                        abrirRecibosSueldo({ nombreNegocio, empleador: datosEmpleador, liquidacion: l })
                      }
                      title="Imprimir los recibos de este período"
                      className="rounded-lg border px-2 py-1 text-xs"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                      🖨
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste ningún empleado.
        </p>
      ) : (
        <div className="space-y-3">
          {ordenados.map((e) => (
            <FilaEmpleado
              key={e.id}
              empleado={e}
              sectores={sectores}
              onImprimir={(emp) => imprimirRecibos([emp])}
              onActualizar={onActualizar}
              onEliminar={onEliminar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
