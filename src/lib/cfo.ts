import { formatoMoneda } from './finance'

export interface CuentaBancaria {
  id: string
  nombre: string
  saldo: number
}

export function calcularSaldoTotalBancos(cuentas: CuentaBancaria[]): number {
  return cuentas.reduce((s, c) => s + c.saldo, 0)
}

// ---------------------------------------------------------------------------
// Tesorería (Full): a qué caja o cuenta bancaria entra/sale cada cobro y pago
// ---------------------------------------------------------------------------
//
// A diferencia de un Pago (que salda una factura en la cuenta corriente, sin importar de dónde
// salió la plata), un MovimientoTesoreria es la plata físicamente entrando o saliendo de una caja
// o cuenta bancaria puntual. El saldo de cada CuentaBancaria deja de editarse a mano (salvo el
// saldo inicial al crearla) y pasa a ser la suma de sus movimientos — mismo patrón que
// stockActual/MovimientoStock.

export type TipoMovimientoTesoreria = 'ingreso' | 'egreso' | 'ajuste'

export interface MovimientoTesoreria {
  id: string
  cuentaId: string
  tipo: TipoMovimientoTesoreria
  monto: number
  fecha: string
  concepto?: string
  /** De dónde vino este movimiento, para poder revertirlo si se modifica o borra el origen. Los
   * movimientos "manual" (ajustes a mano) son los únicos que se pueden borrar directamente desde
   * Tesorería. */
  origen: 'factura' | 'anticipo' | 'cheque' | 'sueldo' | 'manual'
  origenId?: string
}

/** Un ajuste guarda el monto ya con signo (positivo suma, negativo resta); ingreso/egreso son
 * siempre positivos y el signo lo pone el tipo. */
export function deltaDeMovimientoTesoreria(m: MovimientoTesoreria): number {
  if (m.tipo === 'ingreso') return m.monto
  if (m.tipo === 'egreso') return -m.monto
  return m.monto
}

export function aplicarMovimientoTesoreria(cuentas: CuentaBancaria[], m: MovimientoTesoreria): CuentaBancaria[] {
  return cuentas.map((c) => (c.id === m.cuentaId ? { ...c, saldo: c.saldo + deltaDeMovimientoTesoreria(m) } : c))
}

export function revertirMovimientoTesoreria(cuentas: CuentaBancaria[], m: MovimientoTesoreria): CuentaBancaria[] {
  return cuentas.map((c) => (c.id === m.cuentaId ? { ...c, saldo: c.saldo - deltaDeMovimientoTesoreria(m) } : c))
}

export interface ResumenCuentaTesoreria {
  cuenta: CuentaBancaria
  ingresos: number
  egresos: number
  movimientos: MovimientoTesoreria[]
}

/** Ingresos/egresos y movimientos propios de cada cuenta, para el detalle de Tesorería. */
export function resumenPorCuenta(cuentas: CuentaBancaria[], movimientos: MovimientoTesoreria[]): ResumenCuentaTesoreria[] {
  return cuentas.map((cuenta) => {
    const propios = movimientos.filter((m) => m.cuentaId === cuenta.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
    return {
      cuenta,
      ingresos: propios.reduce((s, m) => s + Math.max(0, deltaDeMovimientoTesoreria(m)), 0),
      egresos: propios.reduce((s, m) => s + Math.max(0, -deltaDeMovimientoTesoreria(m)), 0),
      movimientos: propios,
    }
  })
}

// ---------------------------------------------------------------------------
// Conciliación bancaria (Full): cruzar el extracto del banco contra Tesorería
// ---------------------------------------------------------------------------
//
// Importar un extracto no agrega movimientos nuevos a ciegas (a diferencia de los otros
// importadores) — cada fila del banco se guarda aparte como MovimientoBancario y se intenta
// emparejar contra un MovimientoTesoreria ya cargado de la misma cuenta, mismo monto y una fecha
// cercana (el banco acredita/debita unos días después de la fecha real). Lo que no matchea queda
// pendiente para revisar a mano.

/** Margen de días entre la fecha real de un movimiento y la fecha en que aparece en el extracto,
 * para considerarlo la misma operación al conciliar automáticamente. */
export const MARGEN_DIAS_CONCILIACION = 3

export interface MovimientoBancario {
  id: string
  cuentaId: string
  fecha: string
  descripcion?: string
  /** Con signo: positivo un ingreso, negativo un egreso — mismo criterio que un ajuste. */
  monto: number
  /** Saldo que informa el extracto después de este movimiento, si la fila lo trae. */
  saldoDeclarado?: number
  conciliado: boolean
  /** Con qué MovimientoTesoreria se emparejó, una vez conciliado. */
  movimientoTesoreriaId?: string
}

/** Busca, para cada fila del banco todavía sin conciliar, un único MovimientoTesoreria de la
 * misma cuenta con el mismo monto (con signo) dentro del margen de días — si hay más de un
 * candidato posible se deja para revisar a mano, no se adivina cuál es. */
export function buscarCoincidenciasAutomaticas(
  bancarios: MovimientoBancario[],
  movimientos: MovimientoTesoreria[],
  cuentaId: string,
  margenDias: number = MARGEN_DIAS_CONCILIACION,
): { bancarioId: string; movimientoId: string }[] {
  const pendientesBancarios = bancarios.filter((b) => b.cuentaId === cuentaId && !b.conciliado)
  const movimientosDeLaCuenta = movimientos.filter((m) => m.cuentaId === cuentaId)
  const yaVinculados = new Set(bancarios.filter((b) => b.movimientoTesoreriaId).map((b) => b.movimientoTesoreriaId))
  const usadosEnEstaPasada = new Set<string>()
  const resultado: { bancarioId: string; movimientoId: string }[] = []

  for (const bancario of pendientesBancarios) {
    const fechaBancario = new Date(`${bancario.fecha}T00:00:00`).getTime()
    const candidatos = movimientosDeLaCuenta.filter((m) => {
      if (usadosEnEstaPasada.has(m.id) || yaVinculados.has(m.id)) return false
      if (Math.round(deltaDeMovimientoTesoreria(m) * 100) !== Math.round(bancario.monto * 100)) return false
      const diasDeDiferencia = Math.abs(new Date(`${m.fecha}T00:00:00`).getTime() - fechaBancario) / 86400000
      return diasDeDiferencia <= margenDias
    })
    if (candidatos.length === 1) {
      resultado.push({ bancarioId: bancario.id, movimientoId: candidatos[0].id })
      usadosEnEstaPasada.add(candidatos[0].id)
    }
  }
  return resultado
}

export interface ResumenConciliacion {
  saldoSistema: number
  /** Último saldo que informó el extracto importado, si alguna fila lo traía. */
  saldoExtracto: number | null
  diferencia: number | null
  bancariosPendientes: MovimientoBancario[]
  movimientosPendientes: MovimientoTesoreria[]
}

/** Estado de la conciliación de una cuenta: cuánto falta para que el saldo del sistema coincida
 * con el del banco, y qué movimientos quedan sin cruzar de cada lado. */
export function calcularResumenConciliacion(
  cuenta: CuentaBancaria,
  bancarios: MovimientoBancario[],
  movimientos: MovimientoTesoreria[],
): ResumenConciliacion {
  const bancariosDeLaCuenta = bancarios.filter((b) => b.cuentaId === cuenta.id).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const movimientosDeLaCuenta = movimientos.filter((m) => m.cuentaId === cuenta.id)
  const idsVinculados = new Set(bancariosDeLaCuenta.filter((b) => b.movimientoTesoreriaId).map((b) => b.movimientoTesoreriaId))
  const ultimoConSaldo = [...bancariosDeLaCuenta].reverse().find((b) => b.saldoDeclarado !== undefined)
  const saldoExtracto = ultimoConSaldo?.saldoDeclarado ?? null

  return {
    saldoSistema: cuenta.saldo,
    saldoExtracto,
    diferencia: saldoExtracto !== null ? cuenta.saldo - saldoExtracto : null,
    bancariosPendientes: bancariosDeLaCuenta.filter((b) => !b.conciliado),
    movimientosPendientes: movimientosDeLaCuenta.filter((m) => !idsVinculados.has(m.id)),
  }
}

// ---------------------------------------------------------------------------
// Patrimonio / bienes realizables (Premium)
// ---------------------------------------------------------------------------
//
// Activos que no forman parte de la caja del día a día, pero que se podrían
// vender o liquidar ante un quiebre de caja — inversiones, inmuebles,
// vehículos, maquinaria o stock excedente. No se suman al runway principal
// (que debe reflejar la caja real, ver calcularRunwayMeses), sino que se
// muestran como un colchón adicional aparte.

export type TipoBien = 'inversion' | 'inmueble' | 'vehiculo' | 'maquinaria' | 'stock' | 'otro'

export const TIPOS_BIEN_LABEL: Record<TipoBien, string> = {
  inversion: 'Inversión financiera',
  inmueble: 'Inmueble',
  vehiculo: 'Vehículo',
  maquinaria: 'Maquinaria / equipamiento',
  stock: 'Stock excedente',
  otro: 'Otro',
}

export interface Bien {
  id: string
  concepto: string
  tipo: TipoBien
  valorEstimado: number
}

export function calcularValorTotalBienes(bienes: Bien[]): number {
  return bienes.reduce((s, b) => s + b.valorEstimado, 0)
}

/**
 * Runway "extendido": cuántos meses cubrirían la caja MÁS lo que se podría liquidar del
 * patrimonio, pagando solo gastos fijos — un colchón adicional de referencia, no la liquidez
 * inmediata real (esa es calcularRunwayMeses, que no incluye el patrimonio).
 */
export function calcularRunwayExtendido(saldoInicial: number, valorBienes: number, gastosFijos: number): number {
  if (gastosFijos <= 0) return Infinity
  return Math.max(0, (saldoInicial + valorBienes) / gastosFijos)
}

export interface Deuda {
  id: string
  concepto: string
  montoAdeudado: number
  cuotaMensual: number
  proximoVencimiento?: string
}

export function calcularDeudaTotal(deudas: Deuda[]): number {
  return deudas.reduce((s, d) => s + d.montoAdeudado, 0)
}

export function calcularCuotaDeudaTotal(deudas: Deuda[]): number {
  return deudas.reduce((s, d) => s + d.cuotaMensual, 0)
}

/** Endeudamiento expresado en meses de ingreso que harían falta para cubrir toda la deuda pendiente. */
export function calcularEndeudamientoMeses(deudaTotal: number, ingresos: number): number {
  if (deudaTotal <= 0) return 0
  if (ingresos <= 0) return Infinity
  return deudaTotal / ingresos
}

export type TipoGasto = 'fijo' | 'variable'

export interface CategoriaGasto {
  key: string
  label: string
  monto: number
  tipo: TipoGasto
  color: string
}

export interface CategoriaConfig {
  key: string
  label: string
  tipo: TipoGasto
  color: string
  default: number
}

/** Categorías de gasto del negocio — se usan tanto en el Dashboard (montos estimados) como en la
 * clasificación de proveedores para Presupuesto vs. Real. */
export const CATEGORIAS_GASTO: CategoriaConfig[] = [
  { key: 'sueldos', label: 'Sueldos y cargas sociales', tipo: 'fijo', color: 'var(--series-blue)', default: 2500000 },
  { key: 'alquiler', label: 'Alquiler', tipo: 'fijo', color: 'var(--series-2)', default: 600000 },
  { key: 'servicios', label: 'Servicios (luz, gas, internet)', tipo: 'fijo', color: 'var(--series-3)', default: 300000 },
  { key: 'impuestos', label: 'Impuestos', tipo: 'fijo', color: 'var(--series-4)', default: 600000 },
  { key: 'seguros', label: 'Seguros y otros gastos fijos', tipo: 'fijo', color: 'var(--series-5)', default: 300000 },
  { key: 'insumos', label: 'Insumos / mercadería', tipo: 'variable', color: 'var(--series-6)', default: 1500000 },
  { key: 'otros', label: 'Otros gastos variables', tipo: 'variable', color: 'var(--series-7)', default: 500000 },
]

export function calcularGastosTotales(categorias: CategoriaGasto[]) {
  const fijos = categorias.filter((c) => c.tipo === 'fijo').reduce((s, c) => s + c.monto, 0)
  const variables = categorias.filter((c) => c.tipo === 'variable').reduce((s, c) => s + c.monto, 0)
  return { fijos, variables, total: fijos + variables }
}

/** Margen operativo: qué porcentaje de cada peso de ingreso queda como resultado, luego de todos los gastos. */
export function calcularMargenOperativo(ingresos: number, gastosTotales: number): number {
  if (ingresos <= 0) return 0
  return ((ingresos - gastosTotales) / ingresos) * 100
}

/**
 * Runway de caja: meses que el saldo actual alcanza para cubrir los gastos FIJOS si el ingreso
 * cayera a cero. Se usan solo los gastos fijos (no los totales) porque los variables —insumos,
 * mercadería— existen justamente porque hay ventas: si el ingreso cae a cero, esas compras
 * también caen a cero junto con él, y contarlas infla artificialmente el "gasto a cubrir".
 */
export function calcularRunwayMeses(saldoInicial: number, gastosFijos: number): number {
  if (gastosFijos <= 0) return Infinity
  return Math.max(0, saldoInicial / gastosFijos)
}

/** Cobertura de deuda: cuántas veces el ingreso mensual cubre la cuota de deuda mensual total. */
export function calcularCoberturaDeuda(ingresos: number, cuotaDeudaTotal: number): number {
  if (cuotaDeudaTotal <= 0) return Infinity
  return ingresos / cuotaDeudaTotal
}

export interface FilaProyeccion {
  mes: number
  ingresos: number
  gastos: number
  saldo: number
}

/**
 * Proyección de saldo de caja mes a mes. Con `tasaCrecimientoMensualPct` en 0 (el valor por
 * defecto) es una proyección lineal simple, asumiendo ingresos y gastos constantes. Con una tasa
 * distinta de 0, los ingresos se ajustan ese porcentaje cada mes (función Premium). Cada fila
 * incluye también el ingreso y el gasto de ese mes, para poder mostrarlos junto al saldo
 * acumulado (y que se vea claro que los gastos sí se están restando).
 */
export function proyectarFlujoCaja(
  saldoInicial: number,
  ingresos: number,
  gastosTotales: number,
  meses: number,
  tasaCrecimientoMensualPct = 0,
  /** Gastos que caen en un mes puntual y no todos los meses — hoy el aguinaldo de junio y
   * diciembre. El índice 0 es el primer mes proyectado. */
  gastosExtraPorMes: number[] = [],
): FilaProyeccion[] {
  const filas: FilaProyeccion[] = []
  let saldo = saldoInicial
  let ingresoMes = ingresos
  for (let mes = 1; mes <= meses; mes++) {
    const gastosDelMes = gastosTotales + (gastosExtraPorMes[mes - 1] ?? 0)
    saldo += ingresoMes - gastosDelMes
    filas.push({ mes, ingresos: ingresoMes, gastos: gastosDelMes, saldo })
    ingresoMes *= 1 + tasaCrecimientoMensualPct / 100
  }
  return filas
}

export interface PuntoEquilibrio {
  alcanzable: boolean
  ingresosNecesarios: number
  contribucionMarginalPct: number
}

/**
 * Punto de equilibrio simplificado: asume que los gastos variables escalan linealmente con los
 * ingresos actuales (no hay un costo variable "por unidad" cargado). Con eso estima cuánto ingreso
 * mensual necesita el negocio para cubrir sus gastos fijos.
 */
export function calcularPuntoEquilibrio(ingresos: number, gastosFijos: number, gastosVariables: number): PuntoEquilibrio {
  const tasaVariable = ingresos > 0 ? gastosVariables / ingresos : 1
  const contribucionMarginalPct = (1 - tasaVariable) * 100

  if (contribucionMarginalPct <= 0) {
    return { alcanzable: false, ingresosNecesarios: Infinity, contribucionMarginalPct }
  }

  return {
    alcanzable: true,
    ingresosNecesarios: gastosFijos / (contribucionMarginalPct / 100),
    contribucionMarginalPct,
  }
}

// ---------------------------------------------------------------------------
// Presupuesto vs. Real (Premium)
// ---------------------------------------------------------------------------

export interface DesvioCategoria {
  key: string
  label: string
  presupuestado: number
  real: number
  desvioMonto: number
  desvioPct: number
  esAutomatico: boolean
}

export interface RealCategoria {
  monto: number
  automatico: boolean
}

/** Compara lo presupuestado (categorías) contra lo realmente gastado/ingresado en el mes. */
export function calcularDesvios(categorias: CategoriaGasto[], real: Record<string, RealCategoria>): DesvioCategoria[] {
  return categorias.map((c) => {
    const info = real[c.key] ?? { monto: 0, automatico: false }
    const montoReal = info.monto
    const desvioMonto = montoReal - c.monto
    const desvioPct = c.monto > 0 ? (desvioMonto / c.monto) * 100 : montoReal > 0 ? 100 : 0
    return {
      key: c.key,
      label: c.label,
      presupuestado: c.monto,
      real: montoReal,
      desvioMonto,
      desvioPct,
      esAutomatico: info.automatico,
    }
  })
}

export interface DesvioVentas {
  presupuestado: number
  real: number
  desvioMonto: number
  desvioPct: number
  esAutomatico: boolean
}

/**
 * Compara el ingreso mensual presupuestado (el mismo que se carga en el Dashboard) contra lo
 * realmente facturado ese mes — mismo criterio que calcularDesvios, pero del lado de ventas, donde
 * superar el presupuesto es una buena noticia en vez de un exceso de gasto. Se completa solo con
 * las facturas emitidas de ese mes, salvo que el usuario lo haya pisado a mano.
 */
export function calcularDesvioVentas(
  presupuestado: number,
  facturas: Factura[],
  ventasManualPorMes: Record<string, number>,
  mesISO: string,
): DesvioVentas {
  const fila = calcularResumenMensual(facturas).find((r) => r.mes === mesISO)
  const manual = ventasManualPorMes[mesISO]
  const real = manual !== undefined ? manual : (fila?.ventasNetas ?? 0)
  const esAutomatico = manual === undefined && fila !== undefined
  const desvioMonto = real - presupuestado
  const desvioPct = presupuestado > 0 ? (desvioMonto / presupuestado) * 100 : real > 0 ? 100 : 0
  return { presupuestado, real, desvioMonto, desvioPct, esAutomatico }
}

// ---------------------------------------------------------------------------
// Salud financiera a partir de comprobantes (Premium)
// ---------------------------------------------------------------------------
//
// Este módulo NO es para saber qué falta cobrar o pagar (eso lo resuelve el
// módulo de Cobranzas y pagos semanal). Es para medir la salud del negocio a
// partir de los comprobantes fiscales: ventas y compras netas, margen, y qué
// tan sano es el mix de facturas vs. notas de crédito/débito.

export type TipoFactura = 'emitida' | 'recibida'
export type TipoComprobante = 'factura' | 'nota_credito' | 'nota_debito'

/** Con qué se cobró o se pagó — para poder armar más adelante un balance contable
 * (caja + bancos + cheques en cartera) a partir de lo cargado durante el año. */
export type MedioPago = 'caja' | 'cheque' | 'transferencia'

export const MEDIOS_PAGO_LABEL: Record<MedioPago, string> = {
  caja: 'Caja (efectivo)',
  cheque: 'Cheque',
  transferencia: 'Transferencia bancaria',
}

export interface Factura {
  id: string
  tipo: TipoFactura
  tipoComprobante: TipoComprobante
  contraparte: string
  monto: number
  fecha: string
  numero?: string
  /** Fecha estimada (editable) en la que se espera cobrar/pagar este comprobante — alimenta el
   * calendario semanal de Cobros y Pagos. No afecta el cálculo de ventas/compras netas. */
  fechaEstimadaCobroPago?: string
  /** Si ya se cobró (emitida) o se pagó (recibida) en la realidad. */
  cumplido?: boolean
  /** En cuántas cuotas mensuales se cobra/paga — por defecto 1 (de contado). Solo afecta el
   * impacto en la caja mes a mes (Dashboard y Presupuesto vs. Real): el total facturado y el
   * margen bruto siempre usan el monto completo, sin importar en cuántas cuotas se pague. */
  cuotas?: number
  /** Con qué se cobró/pagó una vez marcada como cumplida — caja, cheque o transferencia. */
  medioPago?: MedioPago
  /** Parte del monto total que corresponde a IVA (débito fiscal si es emitida, crédito fiscal si
   * es recibida) — el resto (monto - iva) es el neto/base imponible. Opcional: si no se carga, se
   * asume que el comprobante no discrimina IVA (monotributo, exento, etc.). */
  iva?: number
}

/** Suma (o resta, con un número negativo) una cantidad de días a una fecha ISO (YYYY-MM-DD). */
export function sumarDias(fechaISO: string, dias: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00`)
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

/**
 * Monto con signo: las notas de crédito restan (una compra que se anula, o una venta que no se
 * concretó/se anuló), las facturas y notas de débito (recargos) suman — tanto en emitidas como
 * en recibidas.
 */
export function montoConSigno(f: Factura): number {
  return f.tipoComprobante === 'nota_credito' ? -f.monto : f.monto
}

/** IVA con el mismo signo que montoConSigno — una nota de crédito también revierte el IVA que
 * había generado el comprobante original. */
export function ivaConSigno(f: Factura): number {
  const iva = f.iva ?? 0
  return f.tipoComprobante === 'nota_credito' ? -iva : iva
}

/** Monto neto (sin IVA) con signo: lo que queda del monto total una vez descontado el IVA. */
export function montoNetoConSigno(f: Factura): number {
  return montoConSigno(f) - ivaConSigno(f)
}

/** Un pago (parcial o total) imputado contra una factura puntual — ver Cuentas corrientes. Varias
 * facturas de un mismo cliente/proveedor pueden ir cobrándose/pagándose de a partes con varios
 * registros de este tipo, en vez de depender del "cumplido" todo-o-nada de la factura. */
export interface Pago {
  id: string
  facturaId: string
  monto: number
  fecha: string
  medioPago?: MedioPago
  /** Si este pago se generó al vincular la factura a un cheque, el id de ese cheque — para poder
   * borrarlo si se elimina el cheque. */
  chequeId?: string
  /** Caja o cuenta bancaria por la que entró/salió la plata — ver MovimientoTesoreria. */
  cuentaId?: string
}

/** Cuánto se pagó/cobró hasta ahora de una factura puntual, sumando todos sus pagos parciales. */
export function calcularMontoPagado(facturaId: string, pagos: Pago[]): number {
  return pagos.filter((p) => p.facturaId === facturaId).reduce((s, p) => s + p.monto, 0)
}

/** Saldo pendiente de una factura (nunca negativo: un excedente pagado de más no "adeuda" nada). */
export function calcularSaldoFactura(f: Factura, pagos: Pago[]): number {
  return Math.max(0, f.monto - calcularMontoPagado(f.id, pagos))
}

/** Saldo pendiente con el mismo signo que montoConSigno — las notas de crédito no se cobran/pagan
 * de a partes, así que ahí se ignoran los pagos y se usa el monto completo como siempre. */
function saldoPendienteConSigno(f: Factura, pagos: Pago[]): number {
  return f.tipoComprobante === 'nota_credito' ? montoConSigno(f) : calcularSaldoFactura(f, pagos)
}

export interface CuotaFactura {
  fecha: string
  monto: number
}

/**
 * Reparte el monto (con signo) de un comprobante en sus cuotas mensuales, para medir el impacto
 * real en la caja mes a mes: una compra grande financiada en muchas cuotas no golpea la caja de
 * un solo mes, aunque el total facturado sea alto (eso no cambia el margen bruto ni el ranking,
 * que siguen usando el monto completo). Con 1 cuota (o sin definir) da el mismo resultado que
 * antes: una sola entrada con la fecha y el monto original.
 */
export function distribuirEnCuotas(f: Factura): CuotaFactura[] {
  const cuotas = Math.max(1, Math.round(f.cuotas ?? 1))
  const montoCuota = montoConSigno(f) / cuotas
  return Array.from({ length: cuotas }, (_, i) => ({
    fecha: i === 0 ? f.fecha : sumarDias(f.fecha, i * 30),
    monto: montoCuota,
  }))
}

// ---------------------------------------------------------------------------
// Clasificación de proveedores (Premium)
// ---------------------------------------------------------------------------

/** Mapa proveedor -> key de categoría de gasto (ver CATEGORIAS_GASTO). */
export type ClasificacionesProveedores = Record<string, string>

export interface ProveedorResumen {
  proveedor: string
  categoria: string
  totalFacturado: number
  cantidad: number
}

/**
 * Todos los proveedores vistos en facturas recibidas, más los que se hayan clasificado a mano
 * sin tener todavía ninguna factura cargada, con su categoría asignada (vacío si no tiene).
 */
export function listarProveedores(facturas: Factura[], clasificaciones: ClasificacionesProveedores): ProveedorResumen[] {
  const mapa = new Map<string, { total: number; cantidad: number }>()
  for (const f of facturas) {
    if (f.tipo !== 'recibida') continue
    const actual = mapa.get(f.contraparte) ?? { total: 0, cantidad: 0 }
    actual.total += montoConSigno(f)
    actual.cantidad += 1
    mapa.set(f.contraparte, actual)
  }
  for (const proveedor of Object.keys(clasificaciones)) {
    if (!mapa.has(proveedor)) mapa.set(proveedor, { total: 0, cantidad: 0 })
  }
  return [...mapa.entries()]
    .map(([proveedor, { total, cantidad }]) => ({
      proveedor,
      categoria: clasificaciones[proveedor] ?? '',
      totalFacturado: total,
      cantidad,
    }))
    .sort((a, b) => b.totalFacturado - a.totalFacturado)
}

export interface ClienteResumen {
  cliente: string
  totalFacturado: number
  cantidad: number
}

/**
 * Todos los clientes vistos en facturas emitidas, más los que se hayan agregado a mano sin
 * tener todavía ninguna factura cargada. A diferencia de Proveedores, acá no se clasifica en
 * categorías de gasto — eso solo tiene sentido del lado de lo que compra el negocio.
 */
export function listarClientes(facturas: Factura[], clientesManual: string[]): ClienteResumen[] {
  const mapa = new Map<string, { total: number; cantidad: number }>()
  for (const f of facturas) {
    if (f.tipo !== 'emitida') continue
    const actual = mapa.get(f.contraparte) ?? { total: 0, cantidad: 0 }
    actual.total += montoConSigno(f)
    actual.cantidad += 1
    mapa.set(f.contraparte, actual)
  }
  for (const cliente of clientesManual) {
    if (!mapa.has(cliente)) mapa.set(cliente, { total: 0, cantidad: 0 })
  }
  return [...mapa.entries()]
    .map(([cliente, { total, cantidad }]) => ({ cliente, totalFacturado: total, cantidad }))
    .sort((a, b) => b.totalFacturado - a.totalFacturado)
}

/** Suma, por categoría, las facturas recibidas de un mes cuyo proveedor ya está clasificado —
 * repartiendo en cuotas las compras que se pagan en varios meses (ver distribuirEnCuotas). */
export function calcularRealAutomaticoPorMes(
  facturas: Factura[],
  clasificaciones: ClasificacionesProveedores,
  mesISO: string,
): Record<string, number> {
  const resultado: Record<string, number> = {}
  for (const f of facturas) {
    if (f.tipo !== 'recibida') continue
    const categoria = clasificaciones[f.contraparte]
    if (!categoria) continue
    for (const cuota of distribuirEnCuotas(f)) {
      if (cuota.fecha.slice(0, 7) !== mesISO) continue
      resultado[categoria] = (resultado[categoria] ?? 0) + cuota.monto
    }
  }
  return resultado
}

/**
 * El "Real" efectivo de cada categoría para un mes: usa lo cargado a mano si existe (el usuario
 * lo pisó a propósito), y si no, lo automático calculado desde las facturas clasificadas.
 */
export function calcularRealEfectivoPorMes(
  categorias: CategoriaGasto[],
  facturas: Factura[],
  clasificaciones: ClasificacionesProveedores,
  realManualPorMes: Record<string, Record<string, number>>,
  mesISO: string,
): Record<string, RealCategoria> {
  const automatico = calcularRealAutomaticoPorMes(facturas, clasificaciones, mesISO)
  const manual = realManualPorMes[mesISO] ?? {}
  const resultado: Record<string, RealCategoria> = {}
  for (const c of categorias) {
    if (manual[c.key] !== undefined) {
      resultado[c.key] = { monto: manual[c.key], automatico: false }
    } else {
      resultado[c.key] = { monto: automatico[c.key] ?? 0, automatico: automatico[c.key] !== undefined }
    }
  }
  return resultado
}

export interface ResumenMensual {
  mes: string
  ventasNetas: number
  comprasNetas: number
}

/**
 * Ventas y compras netas por mes (ya con notas de crédito/débito aplicadas) — solo para ver la
 * evolución. No calcula un margen por mes: ventas y compras no tienen por qué corresponder al
 * mismo período (por ejemplo, se compra mercadería un mes y se vende en otro), así que mezclar
 * ambas por mes da un margen sin sentido. El margen real se calcula sobre el total acumulado, ver
 * calcularMargenBrutoTotal.
 */
export function calcularResumenMensual(facturas: Factura[]): ResumenMensual[] {
  const porMes = new Map<string, { ventas: number; compras: number }>()
  for (const f of facturas) {
    const mes = f.fecha.slice(0, 7)
    const actual = porMes.get(mes) ?? { ventas: 0, compras: 0 }
    const monto = montoConSigno(f)
    if (f.tipo === 'emitida') actual.ventas += monto
    else actual.compras += monto
    porMes.set(mes, actual)
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, { ventas, compras }]) => ({ mes, ventasNetas: ventas, comprasNetas: compras }))
}

export interface PromedioMensual {
  promedio: number
  hayDatos: boolean
}

function calcularPromedioMensual(meses: number[]): PromedioMensual {
  const conDatos = meses.filter((m) => m !== 0)
  if (conDatos.length === 0) return { promedio: 0, hayDatos: false }
  return { promedio: conDatos.reduce((s, m) => s + m, 0) / conDatos.length, hayDatos: true }
}

function calcularPromedioMensualPorTipo(facturas: Factura[], tipo: TipoFactura): PromedioMensual {
  const porMes = new Map<string, number>()
  for (const f of facturas) {
    if (f.tipo !== tipo) continue
    for (const cuota of distribuirEnCuotas(f)) {
      const mes = cuota.fecha.slice(0, 7)
      porMes.set(mes, (porMes.get(mes) ?? 0) + cuota.monto)
    }
  }
  return calcularPromedioMensual([...porMes.values()])
}

/**
 * Promedio de ventas netas mensuales a partir de todas las facturas emitidas cargadas en Salud
 * financiera (repartidas en cuotas si corresponde, ver distribuirEnCuotas) — para proyectar el
 * flujo de caja con un ingreso representativo del negocio real (varios meses), en vez de depender
 * de si hubo ventas cargadas justo el mes en curso.
 */
export function calcularPromedioVentasMensual(facturas: Factura[]): PromedioMensual {
  return calcularPromedioMensualPorTipo(facturas, 'emitida')
}

/**
 * Promedio de compras netas mensuales a partir de todas las facturas recibidas cargadas en Salud
 * financiera (repartidas en cuotas, ver distribuirEnCuotas) — mismo criterio que las ventas: un
 * gasto representativo de varios meses en vez de depender solo del mes en curso.
 */
export function calcularPromedioComprasMensual(facturas: Factura[]): PromedioMensual {
  return calcularPromedioMensualPorTipo(facturas, 'recibida')
}

export interface PromediosMensualesReales {
  ventasPromedio: number
  comprasPromedio: number
  hayVentas: boolean
  hayCompras: boolean
}

/**
 * Promedio mensual de ventas y compras para el margen operativo del Dashboard, usando el MISMO
 * denominador (la cantidad de meses con algún comprobante, de venta o de compra) para ambos
 * lados. Si se promediara cada lado por separado —como hace calcularPromedioVentasMensual /
 * calcularPromedioComprasMensual, correcto para DSO/DPO— un negocio que cargó todas sus ventas
 * en un solo mes y sus compras repartidas en varios meses termina con un margen inflado que no
 * coincide con el margen bruto real del período.
 */
export function calcularPromediosMensualesReales(facturas: Factura[]): PromediosMensualesReales {
  const ventasPorMes = new Map<string, number>()
  const comprasPorMes = new Map<string, number>()
  for (const f of facturas) {
    for (const cuota of distribuirEnCuotas(f)) {
      const mes = cuota.fecha.slice(0, 7)
      const mapa = f.tipo === 'emitida' ? ventasPorMes : comprasPorMes
      mapa.set(mes, (mapa.get(mes) ?? 0) + cuota.monto)
    }
  }
  const meses = new Set([...ventasPorMes.keys(), ...comprasPorMes.keys()])
  if (meses.size === 0) return { ventasPromedio: 0, comprasPromedio: 0, hayVentas: false, hayCompras: false }
  const sumar = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0)
  return {
    ventasPromedio: sumar(ventasPorMes) / meses.size,
    comprasPromedio: sumar(comprasPorMes) / meses.size,
    hayVentas: ventasPorMes.size > 0,
    hayCompras: comprasPorMes.size > 0,
  }
}


export interface MargenBrutoTotal {
  ventasNetas: number
  comprasNetas: number
  margenBruto: number
  margenBrutoPct: number
}

/** Margen bruto sobre el total acumulado del período cargado: todas las ventas menos todas las compras. */
export function calcularMargenBrutoTotal(facturas: Factura[]): MargenBrutoTotal {
  let ventasNetas = 0
  let comprasNetas = 0
  for (const f of facturas) {
    const monto = montoConSigno(f)
    if (f.tipo === 'emitida') ventasNetas += monto
    else comprasNetas += monto
  }
  const margenBruto = ventasNetas - comprasNetas
  return { ventasNetas, comprasNetas, margenBruto, margenBrutoPct: ventasNetas > 0 ? (margenBruto / ventasNetas) * 100 : 0 }
}

export interface RankingContraparte {
  contraparte: string
  monto: number
  cantidad: number
}

/** Top clientes (emitidas) o proveedores (recibidas) por monto neto acumulado. */
export function calcularRanking(facturas: Factura[], tipo: TipoFactura, top = 5): RankingContraparte[] {
  const mapa = new Map<string, { monto: number; cantidad: number }>()
  for (const f of facturas.filter((x) => x.tipo === tipo)) {
    const actual = mapa.get(f.contraparte) ?? { monto: 0, cantidad: 0 }
    actual.monto += montoConSigno(f)
    actual.cantidad += 1
    mapa.set(f.contraparte, actual)
  }
  return [...mapa.entries()]
    .map(([contraparte, { monto, cantidad }]) => ({ contraparte, monto, cantidad }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, top)
}

// ---------------------------------------------------------------------------
// Posición de IVA (Premium)
// ---------------------------------------------------------------------------
//
// Mecánica estándar de IVA en Argentina: Débito fiscal (IVA de ventas) menos
// Crédito fiscal (IVA de compras) da el Saldo técnico del mes. Si da positivo,
// hay que pagarlo a AFIP y no se traslada nada. Si da negativo (el crédito
// superó al débito), ese saldo queda a favor y se resta del saldo técnico del
// mes siguiente — por eso el saldo a favor que se arrastra nunca es negativo.

export interface PosicionIvaMes {
  mes: string
  saldoAFavorAnterior: number
  saldoAFavorAnteriorEsManual: boolean
  debitoFiscal: number
  debitoFiscalEsManual: boolean
  creditoFiscal: number
  creditoFiscalEsManual: boolean
  saldoTecnico: number
  saldoAPagar: number
  saldoAFavor: number
}

/** Ediciones manuales por mes ("YYYY-MM") — para cuando no cargaste el IVA comprobante por
 * comprobante y preferís poner directamente el débito/crédito fiscal del mes, o para corregir el
 * saldo a favor arrastrado (por ejemplo, el saldo real que traías de antes de usar FinCorp). */
export interface IvaManualMes {
  debitoFiscal?: number
  creditoFiscal?: number
  saldoAFavorAnterior?: number
}

/** Posición de IVA mes a mes, arrastrando el saldo a favor de un mes al siguiente. Cualquier valor
 * cargado a mano en `manual` pisa el que sale de sumar el IVA de los comprobantes. */
export function calcularPosicionIvaPorMes(
  facturas: Factura[],
  manual: Record<string, IvaManualMes> = {},
): PosicionIvaMes[] {
  const porMes = new Map<string, { debito: number; credito: number }>()
  for (const f of facturas) {
    const mes = f.fecha.slice(0, 7)
    const actual = porMes.get(mes) ?? { debito: 0, credito: 0 }
    if (f.tipo === 'emitida') actual.debito += ivaConSigno(f)
    else actual.credito += ivaConSigno(f)
    porMes.set(mes, actual)
  }
  // Los meses que solo tienen una edición manual (sin comprobantes cargados) también aparecen.
  for (const mes of Object.keys(manual)) {
    if (!porMes.has(mes)) porMes.set(mes, { debito: 0, credito: 0 })
  }

  let saldoAFavorAnteriorCalculado = 0
  return [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, { debito, credito }]) => {
      const overrideMes = manual[mes] ?? {}
      const debitoFiscalEsManual = overrideMes.debitoFiscal !== undefined
      const debitoFiscal = debitoFiscalEsManual ? overrideMes.debitoFiscal! : debito
      const creditoFiscalEsManual = overrideMes.creditoFiscal !== undefined
      const creditoFiscal = creditoFiscalEsManual ? overrideMes.creditoFiscal! : credito
      const saldoAFavorAnteriorEsManual = overrideMes.saldoAFavorAnterior !== undefined
      const saldoAFavorAnterior = saldoAFavorAnteriorEsManual
        ? overrideMes.saldoAFavorAnterior!
        : saldoAFavorAnteriorCalculado

      const saldoTecnico = saldoAFavorAnterior + creditoFiscal - debitoFiscal
      const saldoAPagar = Math.max(0, -saldoTecnico)
      const saldoAFavor = Math.max(0, saldoTecnico)
      const fila: PosicionIvaMes = {
        mes,
        saldoAFavorAnterior,
        saldoAFavorAnteriorEsManual,
        debitoFiscal,
        debitoFiscalEsManual,
        creditoFiscal,
        creditoFiscalEsManual,
        saldoTecnico,
        saldoAPagar,
        saldoAFavor,
      }
      saldoAFavorAnteriorCalculado = saldoAFavor
      return fila
    })
}

// ---------------------------------------------------------------------------
// Posición de Ingresos Brutos - La Pampa (Premium)
// ---------------------------------------------------------------------------
//
// A diferencia del IVA, Ingresos Brutos no tiene débito/crédito fiscal: es un
// porcentaje fijo (alícuota) sobre lo facturado en el mes (neto de IVA), del
// que se restan las retenciones/percepciones que ya te hicieron los clientes.
// No arrastra saldo de un mes a otro (a diferencia de la Posición de IVA).

export const ALICUOTA_IIBB_DEFAULT = 3

export interface IngresosBrutosManualMes {
  alicuotaPct?: number
  retenciones?: number
}

export interface PosicionIngresosBrutosMes {
  mes: string
  baseImponible: number
  alicuotaPct: number
  alicuotaPctEsManual: boolean
  impuestoDeterminado: number
  retenciones: number
  retencionesEsManual: boolean
  saldoAPagar: number
  saldoAFavor: number
}

/** Posición de Ingresos Brutos mes a mes: base imponible (ventas netas de IVA) × alícuota, menos
 * las retenciones del mes — ambas editables a mano, sin arrastre de saldo entre meses. */
export function calcularPosicionIngresosBrutosPorMes(
  facturas: Factura[],
  manual: Record<string, IngresosBrutosManualMes> = {},
): PosicionIngresosBrutosMes[] {
  const basePorMes = new Map<string, number>()
  for (const f of facturas) {
    if (f.tipo !== 'emitida') continue
    const mes = f.fecha.slice(0, 7)
    basePorMes.set(mes, (basePorMes.get(mes) ?? 0) + montoNetoConSigno(f))
  }
  for (const mes of Object.keys(manual)) {
    if (!basePorMes.has(mes)) basePorMes.set(mes, 0)
  }

  return [...basePorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, baseImponible]) => {
      const overrideMes = manual[mes] ?? {}
      const alicuotaPctEsManual = overrideMes.alicuotaPct !== undefined
      const alicuotaPct = alicuotaPctEsManual ? overrideMes.alicuotaPct! : ALICUOTA_IIBB_DEFAULT
      const retencionesEsManual = overrideMes.retenciones !== undefined
      const retenciones = retencionesEsManual ? overrideMes.retenciones! : 0
      const impuestoDeterminado = baseImponible * (alicuotaPct / 100)
      const saldo = impuestoDeterminado - retenciones
      return {
        mes,
        baseImponible,
        alicuotaPct,
        alicuotaPctEsManual,
        impuestoDeterminado,
        retenciones,
        retencionesEsManual,
        saldoAPagar: Math.max(0, saldo),
        saldoAFavor: Math.max(0, -saldo),
      }
    })
}

// ---------------------------------------------------------------------------
// Alertas automáticas (Premium)
// ---------------------------------------------------------------------------

export type SeveridadAlerta = 'critical' | 'warning'

export interface Alerta {
  id: string
  severidad: SeveridadAlerta
  mensaje: string
}

export function generarAlertas(input: {
  margenOperativo: number
  runwayMeses: number
  proyeccion: FilaProyeccion[]
  deudas: Deuda[]
  facturas: Factura[]
  /** Cheques (plan Full) — para avisar de rechazados sin resolver y próximos a vencer. */
  cheques?: Cheque[]
  /** Productos de Stock (plan Full) — para avisar de los que están bajo su stock mínimo. */
  productos?: Producto[]
}): Alerta[] {
  const alertas: Alerta[] = []
  const { margenOperativo, runwayMeses, proyeccion, deudas, facturas, cheques = [], productos = [] } = input

  if (margenOperativo < 0) {
    alertas.push({ id: 'margen-negativo', severidad: 'critical', mensaje: 'Estás perdiendo plata cada mes: tus gastos superan tus ingresos.' })
  }

  if (runwayMeses < 3) {
    alertas.push({ id: 'runway-critico', severidad: 'critical', mensaje: `Tu caja se agotaría en ${runwayMeses.toFixed(1)} meses si el ingreso cayera a cero.` })
  } else if (runwayMeses < 6) {
    alertas.push({ id: 'runway-bajo', severidad: 'warning', mensaje: `Tu runway de caja es de solo ${runwayMeses.toFixed(1)} meses.` })
  }

  const mesQuiebre = proyeccion.find((f) => f.saldo < 0)?.mes
  if (mesQuiebre) {
    alertas.push({ id: 'quiebre-proyectado', severidad: 'critical', mensaje: `Según la proyección actual, te quedás sin caja en el mes ${mesQuiebre}.` })
  }

  const hoy = new Date()
  const enSieteDias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000)
  for (const d of deudas) {
    if (!d.proximoVencimiento) continue
    const fecha = new Date(d.proximoVencimiento)
    if (fecha >= hoy && fecha <= enSieteDias) {
      alertas.push({
        id: `deuda-vence-${d.id}`,
        severidad: 'warning',
        mensaje: `"${d.concepto}" vence el ${fecha.toLocaleDateString('es-AR')}.`,
      })
    }
  }

  if (facturas.length > 0) {
    const { margenBruto } = calcularMargenBrutoTotal(facturas)
    if (margenBruto < 0) {
      alertas.push({
        id: 'margen-bruto-negativo',
        severidad: 'warning',
        mensaje:
          'Según tus comprobantes, compraste más de lo que facturaste en el período cargado (margen bruto negativo). Esto no implica necesariamente un quiebre de caja: si esas compras las estás pagando en cuotas, el impacto real en tu caja se reparte en el tiempo — revisá el runway y la proyección para ver tu situación real.',
      })
    }
  }

  const chequesRechazados = cheques.filter((c) => c.estado === 'rechazado')
  if (chequesRechazados.length > 0) {
    const total = chequesRechazados.reduce((s, c) => s + c.monto, 0)
    alertas.push({
      id: 'cheques-rechazados',
      severidad: 'critical',
      mensaje: `Tenés ${chequesRechazados.length} cheque${chequesRechazados.length === 1 ? '' : 's'} rechazado${chequesRechazados.length === 1 ? '' : 's'} por ${formatoMoneda(total)} sin resolver.`,
    })
  }
  for (const c of cheques) {
    if (c.estado !== 'cartera') continue
    const fecha = new Date(`${c.fechaCobro}T00:00:00`)
    if (fecha >= hoy && fecha <= enSieteDias) {
      alertas.push({
        id: `cheque-vence-${c.id}`,
        severidad: 'warning',
        mensaje: `Cheque ${c.tipo === 'recibido' ? 'a cobrar' : 'a pagar'} de ${formatoMoneda(c.monto)} (${c.contraparte}) vence el ${fecha.toLocaleDateString('es-AR')}.`,
      })
    }
  }

  const bajoMinimo = listarProductosBajoMinimo(productos)
  if (bajoMinimo.length > 0) {
    alertas.push({
      id: 'stock-bajo-minimo',
      severidad: 'warning',
      mensaje: `${bajoMinimo.length} producto${bajoMinimo.length === 1 ? '' : 's'} en Stock por debajo del mínimo: ${bajoMinimo
        .slice(0, 3)
        .map((p) => p.nombre)
        .join(', ')}${bajoMinimo.length > 3 ? '…' : ''}.`,
    })
  }

  return alertas
}

// ---------------------------------------------------------------------------
// Cheques (Premium)
// ---------------------------------------------------------------------------
//
// Cheques de terceros que recibiste (activo: los tenés en cartera hasta
// depositarlos/cobrarlos) y cheques propios que emitiste (pasivo: siguen
// "vivos" hasta que el que los recibió los cobra). Junto con la caja y las
// cuentas bancarias, es la base para armar un balance contable a fin de año.

export type TipoCheque = 'recibido' | 'emitido'
/** "vendido" (descontado en un banco antes de la fecha de cobro) solo aplica a los recibidos: un
 * cheque que emitiste vos no lo "vendés", el que lo tiene lo cobra o lo descuenta en su propio
 * banco, y eso no te afecta a vos más que en la fecha en que se debita de tu cuenta. */
export type EstadoCheque = 'cartera' | 'cobrado' | 'vendido' | 'rechazado'

/** Estados válidos según el tipo de cheque — "vendido" solo tiene sentido para los recibidos. */
export function estadosChequeDisponibles(tipo: TipoCheque): EstadoCheque[] {
  return tipo === 'recibido' ? ['cartera', 'cobrado', 'vendido', 'rechazado'] : ['cartera', 'cobrado', 'rechazado']
}

/** Misma idea de "se hizo efectivo" tiene nombres distintos según el lado: a un cheque que
 * recibiste lo "cobrás" vos, a uno que emitiste lo "paga" el banco cuando el que lo tiene lo
 * presenta. */
export function etiquetaEstadoCheque(estado: EstadoCheque, tipo: TipoCheque): string {
  switch (estado) {
    case 'cartera':
      return 'En cartera'
    case 'cobrado':
      return tipo === 'emitido' ? 'Pagado' : 'Cobrado'
    case 'vendido':
      return 'Vendido (descontado)'
    case 'rechazado':
      return 'Rechazado'
  }
}

export interface Cheque {
  id: string
  tipo: TipoCheque
  numero?: string
  banco: string
  contraparte: string
  monto: number
  fechaEmision: string
  /** Fecha en la que se puede cobrar/se acredita — para cheques diferidos. */
  fechaCobro: string
  estado: EstadoCheque
  /** Comisión/interés que cobró el banco por descontarlo antes de la fecha de cobro — solo
   * aplica con estado "vendido". */
  comisionDescuento?: number
  /** Facturas de Comprobantes que este cheque abona (ventas si es recibido, compras si es
   * emitido). Al vincularlas quedan marcadas como cumplidas con medioPago "cheque" y dejan de
   * listarse por separado en Cobranzas y pagos — el cheque las representa a todas juntas ahí. */
  facturasIds?: string[]
  /** Caja o cuenta bancaria donde entra/sale la plata cuando el cheque se cobra o se paga (estado
   * "cobrado" o "vendido") — ver MovimientoTesoreria. Se puede elegir antes o después del cambio
   * de estado. */
  cuentaId?: string
}

/** Cuánto entró realmente a la cuenta por este cheque: si se vendió (descontó), el monto menos la
 * comisión que se llevó el banco; si no, el monto completo. */
export function montoNetoCheque(c: Cheque): number {
  return c.estado === 'vendido' ? c.monto - (c.comisionDescuento ?? 0) : c.monto
}

export interface TotalesCheques {
  recibidosEnCartera: number
  emitidosEnCartera: number
  saldoNetoCheques: number
  totalComisionesDescuento: number
}

/** Totales de cheques todavía "vivos" (en cartera): los recibidos suman a favor (son un activo que
 * todavía no se hizo caja), los emitidos restan (una obligación pendiente de que se cobre). Los
 * vendidos ya salieron de cartera (se convirtieron en caja, menos la comisión del banco). */
export function calcularTotalesCheques(cheques: Cheque[]): TotalesCheques {
  const recibidosEnCartera = cheques
    .filter((c) => c.tipo === 'recibido' && c.estado === 'cartera')
    .reduce((s, c) => s + c.monto, 0)
  const emitidosEnCartera = cheques
    .filter((c) => c.tipo === 'emitido' && c.estado === 'cartera')
    .reduce((s, c) => s + c.monto, 0)
  const totalComisionesDescuento = cheques
    .filter((c) => c.estado === 'vendido')
    .reduce((s, c) => s + (c.comisionDescuento ?? 0), 0)
  return {
    recibidosEnCartera,
    emitidosEnCartera,
    saldoNetoCheques: recibidosEnCartera - emitidosEnCartera,
    totalComisionesDescuento,
  }
}

// ---------------------------------------------------------------------------
// Sueldos y cargas sociales (Full): nómina básica de empleados
// ---------------------------------------------------------------------------
//
// Terminología estándar de un recibo de sueldo argentino: al sueldo bruto se le descuentan los
// aportes personales del empleado (jubilación + obra social + PAMI, ~17%) para llegar al neto de
// bolsillo. La empresa paga ADEMÁS dos cosas distintas sobre ese mismo bruto, que NO son lo
// mismo: las contribuciones patronales (~24%, Dto. 814/2001 — jubilación, PAMI y obra social a
// cargo del empleador, van al sistema de seguridad social) y otras cargas sociales adicionales
// (~3% de referencia — ART, seguro de vida obligatorio, cuota sindical patronal si el convenio la
// exige — que no son "contribuciones" en sentido técnico pero sí un costo laboral más). El costo
// real de cada empleado es el bruto más ambas.

export const CONTRIBUCIONES_PATRONALES_PCT_DEFAULT = 24
export const CARGAS_SOCIALES_ADICIONALES_PCT_DEFAULT = 3

/** Sobre qué se calcula un descuento. La diferencia importa: jubilación y PAMI se calculan solo
 * sobre lo remunerativo, mientras que obra social y los aportes de convenio toman también las
 * sumas no remunerativas. */
export type BaseDescuento = 'remunerativo' | 'total'

export const BASE_DESCUENTO_LABEL: Record<BaseDescuento, string> = {
  remunerativo: 'Remunerativo',
  total: 'Remunerativo + no remunerativo',
}

/** Una línea de haberes del recibo: el básico va aparte, acá van antigüedad, presentismo, los
 * acuerdos no remunerativos, etc. */
export interface ConceptoHaber {
  id: string
  descripcion: string
  monto: number
  /** Los no remunerativos no pagan jubilación ni PAMI ni generan contribuciones patronales. */
  remunerativo: boolean
}

export interface DescuentoEmpleado {
  id: string
  descripcion: string
  porcentaje: number
  base: BaseDescuento
}

/** Los tres descuentos que lleva cualquier recibo en relación de dependencia. Los de convenio
 * (S.E.C., F.A.E.C. y S., cuota sindical, etc.) se agregan aparte porque cambian según la
 * actividad. */
export const DESCUENTOS_DEFAULT: Omit<DescuentoEmpleado, 'id'>[] = [
  { descripcion: 'Jubilación', porcentaje: 11, base: 'remunerativo' },
  { descripcion: 'Ley 19.032 (PAMI)', porcentaje: 3, base: 'remunerativo' },
  { descripcion: 'Obra social', porcentaje: 3, base: 'total' },
]

/** Parte del costo de un empleado que se imputa a un sector — un mismo empleado puede repartirse
 * entre varios (60% Metalúrgica, 40% Service). Lo que no se asigna no cae en ningún sector. */
export interface AsignacionSector {
  sectorId: string
  porcentaje: number
}

/** Datos fijos de la empresa que el recibo de sueldo tiene que llevar por el art. 140 de la LCT. */
export interface DatosEmpleador {
  cuit: string
  domicilio: string
  /** Localidad donde se abona — "lugar de pago" del recibo. */
  lugarPago: string
}

export const DATOS_EMPLEADOR_VACIOS: DatosEmpleador = { cuit: '', domicilio: '', lugarPago: '' }

export interface Empleado {
  id: string
  nombre: string
  /** CUIL del trabajador (art. 140 inc. c LCT). */
  cuil?: string
  /** Fecha de ingreso, obligatoria en el recibo (art. 140 inc. c LCT). */
  fechaIngreso?: string
  legajo?: string
  /** Sueldo básico de convenio — el resto de los haberes van en `conceptos`. */
  sueldoBruto: number
  /** Categoría/convenio, solo informativo (ej. "Administrativo A — CCT 130/75"). */
  categoria?: string
  /** Antigüedad, presentismo, acuerdos no remunerativos y demás líneas del recibo. */
  conceptos?: ConceptoHaber[]
  /** Descuentos al empleado. Si no está definido se usan los de DESCUENTOS_DEFAULT. */
  descuentos?: DescuentoEmpleado[]
  /** % que la empresa aporta al sistema de seguridad social (Dto. 814/2001), sobre lo remunerativo. */
  contribucionesPatronalesPct: number
  /** % del bruto de otras cargas sociales a cargo de la empresa que NO son contribución
   * previsional — ART, seguro de vida obligatorio, cuota sindical patronal, etc. */
  cargasSocialesAdicionalesPct: number
  /** Un empleado inactivo (de baja) queda en el historial pero no suma a la nómina vigente. */
  activo: boolean
  /** Cómo se reparte su costo entre sectores — ver calcularMargenPorSector. */
  asignaciones?: AsignacionSector[]
}

export interface DescuentoCalculado extends DescuentoEmpleado {
  /** Sobre cuánto se aplicó el porcentaje — es la columna "Base" del recibo. */
  montoBase: number
  monto: number
}

export interface CostoEmpleado {
  empleado: Empleado
  /** Básico + conceptos remunerativos: la base de jubilación y de las contribuciones. */
  remunerativo: number
  noRemunerativo: number
  brutoTotal: number
  descuentos: DescuentoCalculado[]
  totalDescuentos: number
  /** Lo que cobra de bolsillo: remunerativo + no remunerativo − descuentos. */
  sueldoNeto: number
  contribucionesPatronales: number
  cargasSocialesAdicionales: number
  /** Lo que le cuesta a la empresa: todos los haberes + contribuciones + otras cargas sociales. */
  costoEmpresa: number
}

/** Reproduce un recibo de sueldo: separa haberes remunerativos de no remunerativos, aplica cada
 * descuento sobre la base que le corresponde, y suma lo que la empresa paga por encima. */
export function calcularCostoEmpleado(e: Empleado): CostoEmpleado {
  const conceptos = e.conceptos ?? []
  const remunerativo = e.sueldoBruto + conceptos.filter((c) => c.remunerativo).reduce((s, c) => s + c.monto, 0)
  const noRemunerativo = conceptos.filter((c) => !c.remunerativo).reduce((s, c) => s + c.monto, 0)
  const brutoTotal = remunerativo + noRemunerativo

  const definiciones = e.descuentos ?? DESCUENTOS_DEFAULT.map((d, i) => ({ ...d, id: `default-${i}` }))
  const descuentos: DescuentoCalculado[] = definiciones.map((d) => {
    const montoBase = d.base === 'remunerativo' ? remunerativo : brutoTotal
    return { ...d, montoBase, monto: montoBase * (d.porcentaje / 100) }
  })
  const totalDescuentos = descuentos.reduce((s, d) => s + d.monto, 0)

  // Las sumas no remunerativas existen justamente para no generar contribuciones patronales.
  const contribucionesPatronales = remunerativo * (e.contribucionesPatronalesPct / 100)
  const cargasSocialesAdicionales =
    remunerativo * ((e.cargasSocialesAdicionalesPct ?? CARGAS_SOCIALES_ADICIONALES_PCT_DEFAULT) / 100)

  return {
    empleado: e,
    remunerativo,
    noRemunerativo,
    brutoTotal,
    descuentos,
    totalDescuentos,
    sueldoNeto: brutoTotal - totalDescuentos,
    contribucionesPatronales,
    cargasSocialesAdicionales,
    costoEmpresa: brutoTotal + contribucionesPatronales + cargasSocialesAdicionales,
  }
}

export interface NominaTotal {
  cantidadActivos: number
  totalRemunerativo: number
  totalNoRemunerativo: number
  totalBruto: number
  totalNeto: number
  totalContribucionesPatronales: number
  totalCargasSocialesAdicionales: number
  totalCostoEmpresa: number
}

/** Totales de la nómina vigente (solo empleados activos) — el total de costoEmpresa es lo que se
 * usa como "real" automático de la categoría Sueldos en Presupuesto vs. Real y en el Dashboard. */
export function calcularNominaTotal(empleados: Empleado[]): NominaTotal {
  const costos = empleados.filter((e) => e.activo).map(calcularCostoEmpleado)
  return {
    cantidadActivos: costos.length,
    totalRemunerativo: costos.reduce((s, c) => s + c.remunerativo, 0),
    totalNoRemunerativo: costos.reduce((s, c) => s + c.noRemunerativo, 0),
    totalBruto: costos.reduce((s, c) => s + c.brutoTotal, 0),
    totalNeto: costos.reduce((s, c) => s + c.sueldoNeto, 0),
    totalContribucionesPatronales: costos.reduce((s, c) => s + c.contribucionesPatronales, 0),
    totalCargasSocialesAdicionales: costos.reduce((s, c) => s + c.cargasSocialesAdicionales, 0),
    totalCostoEmpresa: costos.reduce((s, c) => s + c.costoEmpresa, 0),
  }
}

// Pagar la nómina son dos egresos distintos, en fechas distintas: primero los netos a cada
// empleado (hasta el 4° día hábil del mes siguiente) y después todo lo que va a AFIP/ART/sindicato
// —aportes retenidos + contribuciones + ART y demás— con el F.931 (vence alrededor del día 15).
// Sumados dan exactamente el costo empresa, así que la caja nunca queda desbalanceada.
// No hay una entidad "pago de sueldos" guardada aparte: el MovimientoTesoreria con origen
// "sueldo" ES el registro, y su origenId dice de qué mes y concepto es.

export type ConceptoPagoSueldos = 'netos' | 'cargas' | 'aguinaldoNetos' | 'aguinaldoCargas'

export const CONCEPTO_PAGO_SUELDOS_LABEL: Record<ConceptoPagoSueldos, string> = {
  netos: 'Sueldos netos al personal',
  cargas: 'Cargas sociales (F.931, ART y sindicato)',
  aguinaldoNetos: 'Aguinaldo (SAC) al personal',
  aguinaldoCargas: 'Cargas sociales del aguinaldo',
}

/** Día en que se estima cada pago, para ubicarlo en el calendario semanal. Los sueldos del mes y
 * sus cargas se pagan al mes siguiente; el aguinaldo se paga dentro del mismo mes que vence. */
const DIA_ESTIMADO_PAGO: Record<ConceptoPagoSueldos, number> = {
  netos: 4,
  cargas: 15,
  aguinaldoNetos: 30,
  aguinaldoCargas: 15,
}
const PAGO_EN_MES_SIGUIENTE: Record<ConceptoPagoSueldos, boolean> = {
  netos: true,
  cargas: true,
  aguinaldoNetos: false,
  aguinaldoCargas: true,
}

// ---------------------------------------------------------------------------
// Aguinaldo / SAC
// ---------------------------------------------------------------------------
//
// El sueldo anual complementario se paga en dos cuotas: la primera vence el 30 de junio y la
// segunda el 18 de diciembre, y cada una es la mitad de la mejor remuneración del semestre. Como
// acá solo se guarda la nómina vigente (no hay histórico de sueldos mes a mes), se calcula sobre
// el sueldo bruto actual, que es la mejor aproximación disponible. El SAC también paga aportes y
// contribuciones, así que se trata igual que un medio sueldo extra.

/** Meses en los que vence cada cuota del aguinaldo. */
export const MESES_AGUINALDO = [6, 12]

export function mesTieneAguinaldo(mesISO: string): boolean {
  return MESES_AGUINALDO.includes(Number(mesISO.split('-')[1]))
}

/** El aguinaldo es la mitad de la remuneración de cada empleado, con sus mismos descuentos y
 * contribuciones. Las sumas no remunerativas no entran en el cálculo del SAC. */
export function calcularAguinaldo(empleados: Empleado[]): NominaTotal {
  return calcularNominaTotal(
    empleados.map((e) => ({
      ...e,
      sueldoBruto: e.sueldoBruto / 2,
      conceptos: (e.conceptos ?? [])
        .filter((c) => c.remunerativo)
        .map((c) => ({ ...c, monto: c.monto / 2 })),
    })),
  )
}

/**
 * En cuáles de los próximos meses cae el aguinaldo y cuánto pega, para que la proyección de caja
 * muestre el bache de junio y diciembre en vez de asumir doce meses iguales. El índice 0 es el mes
 * que viene, que es donde arranca la proyección.
 */
export function gastosAguinaldoProyectados(costoAguinaldo: number, meses: number, desde = new Date()): number[] {
  if (costoAguinaldo <= 0) return []
  return Array.from({ length: meses }, (_, i) => {
    const mes = new Date(desde.getFullYear(), desde.getMonth() + 1 + i, 1).getMonth() + 1
    return MESES_AGUINALDO.includes(mes) ? costoAguinaldo : 0
  })
}

/** Identifica unívocamente el pago de un concepto de un mes, para no duplicarlo ni perderle el rastro. */
export function idOrigenPagoSueldos(mes: string, concepto: ConceptoPagoSueldos): string {
  return `${mes}:${concepto}`
}

export interface PagoSueldos {
  concepto: ConceptoPagoSueldos
  mes: string
  monto: number
  fechaEstimada: string
  pagado: boolean
  /** El MovimientoTesoreria que lo registra, si ya se pagó — para poder deshacerlo. */
  movimientoId?: string
}

/**
 * Los dos pagos que genera la nómina de un mes, con su fecha estimada y si ya se registraron como
 * salida de alguna caja o cuenta. Con la nómina vacía no hay nada que pagar.
 */
export function calcularPagosSueldos(
  nomina: NominaTotal,
  mes: string,
  movimientosTesoreria: MovimientoTesoreria[],
  /** Nómina con la que se calcula el aguinaldo — solo aporta pagos en junio y diciembre. */
  aguinaldo?: NominaTotal,
): PagoSueldos[] {
  if (nomina.cantidadActivos === 0) return []
  const [anio, mesNumero] = mes.split('-').map(Number)
  const montos: Partial<Record<ConceptoPagoSueldos, number>> = {
    netos: nomina.totalNeto,
    cargas: nomina.totalCostoEmpresa - nomina.totalNeto,
  }
  if (aguinaldo && aguinaldo.cantidadActivos > 0 && mesTieneAguinaldo(mes)) {
    montos.aguinaldoNetos = aguinaldo.totalNeto
    montos.aguinaldoCargas = aguinaldo.totalCostoEmpresa - aguinaldo.totalNeto
  }

  return (Object.keys(montos) as ConceptoPagoSueldos[]).map((concepto) => {
    // Con mesNumero (1-12) sin restar 1, Date ya apunta al mes siguiente; restando 1, al mismo.
    const mesDelPago = PAGO_EN_MES_SIGUIENTE[concepto] ? mesNumero : mesNumero - 1
    const dia = concepto === 'aguinaldoNetos' && mesNumero === 12 ? 18 : DIA_ESTIMADO_PAGO[concepto]
    const fecha = new Date(anio, mesDelPago, dia)
    const movimiento = movimientosTesoreria.find(
      (m) => m.origen === 'sueldo' && m.origenId === idOrigenPagoSueldos(mes, concepto),
    )
    return {
      concepto,
      mes,
      monto: montos[concepto]!,
      fechaEstimada: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`,
      pagado: movimiento !== undefined,
      movimientoId: movimiento?.id,
    }
  })
}

// ---------------------------------------------------------------------------
// Ingresos y gastos diarios (Básico)
// ---------------------------------------------------------------------------
//
// Un registro simple día a día pensado para negocios chicos / monotributistas
// que no facturan con el detalle de Salud financiera (sin IVA, sin cuotas):
// cada ingreso (venta) o gasto se carga con su monto y fecha, y los ingresos
// además con qué se cobró — para saber cuánto entró en efectivo vs. digital.

export type TipoMovimientoDiario = 'ingreso' | 'gasto'
export type MedioCobro = 'efectivo' | 'transferencia' | 'qr' | 'debito' | 'credito'

export const MEDIOS_COBRO_LABEL: Record<MedioCobro, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  qr: 'QR',
  debito: 'Débito',
  credito: 'Crédito',
}

export interface MovimientoDiario {
  id: string
  tipo: TipoMovimientoDiario
  concepto: string
  monto: number
  fecha: string
  /** Con qué se cobró — solo aplica a ingresos (ventas), no a gastos. */
  medioCobro?: MedioCobro
}

export interface ResumenMovimientosDiarios {
  totalIngresos: number
  totalGastos: number
  saldo: number
}

export function calcularResumenMovimientosDiarios(movimientos: MovimientoDiario[]): ResumenMovimientosDiarios {
  let totalIngresos = 0
  let totalGastos = 0
  for (const m of movimientos) {
    if (m.tipo === 'ingreso') totalIngresos += m.monto
    else totalGastos += m.monto
  }
  return { totalIngresos, totalGastos, saldo: totalIngresos - totalGastos }
}

export interface TotalPorMedioCobro {
  medio: MedioCobro
  monto: number
}

/** Cuánto entró (solo ingresos) por cada medio de cobro — para ver de un vistazo cuánto fue en
 * efectivo contra cuánto fue digital (transferencia, QR, débito, crédito). */
export function calcularTotalesPorMedioCobro(movimientos: MovimientoDiario[]): TotalPorMedioCobro[] {
  const totales = new Map<MedioCobro, number>()
  for (const m of movimientos) {
    if (m.tipo !== 'ingreso' || !m.medioCobro) continue
    totales.set(m.medioCobro, (totales.get(m.medioCobro) ?? 0) + m.monto)
  }
  return [...totales.entries()]
    .map(([medio, monto]) => ({ medio, monto }))
    .sort((a, b) => b.monto - a.monto)
}

// ---------------------------------------------------------------------------
// Indicadores de cobro y pago: DSO, DPO y aging (Premium)
// ---------------------------------------------------------------------------
//
// Son los indicadores que cualquier CFO mira primero para saber si el negocio
// está financiando a sus clientes (cobra tarde) o si vive de financiarse con
// sus proveedores (paga tarde) — y en qué antigüedad están las facturas
// pendientes, para priorizar la gestión de cobranza.

export interface IndicadoresCobroPago {
  /** Días de Ventas Pendientes de Cobro: en promedio, cuántos días de venta representa lo que
   * todavía no cobraste. */
  dso: number
  /** Días de Compras Pendientes de Pago: análogo a DSO, del lado de tus proveedores. */
  dpo: number
  /** DSO - DPO: cuántos días netos estás financiando de tu bolsillo (positivo) o financiándote
   * con tus proveedores (negativo). */
  cicloConversionEfectivo: number
  cuentasPorCobrar: number
  cuentasPorPagar: number
  hayDatos: boolean
}

/** DSO/DPO estándar: (saldo pendiente / ventas o compras promedio mensual) × 30 días. El saldo
 * pendiente ya descuenta los pagos parciales imputados desde Cuentas corrientes. */
export function calcularDSOyDPO(facturas: Factura[], pagos: Pago[] = []): IndicadoresCobroPago {
  const cuentasPorCobrar = facturas
    .filter((f) => f.tipo === 'emitida' && !f.cumplido)
    .reduce((s, f) => s + saldoPendienteConSigno(f, pagos), 0)
  const cuentasPorPagar = facturas
    .filter((f) => f.tipo === 'recibida' && !f.cumplido)
    .reduce((s, f) => s + saldoPendienteConSigno(f, pagos), 0)
  const promedioVentas = calcularPromedioVentasMensual(facturas)
  const promedioCompras = calcularPromedioComprasMensual(facturas)
  const dso = promedioVentas.hayDatos && promedioVentas.promedio > 0 ? Math.max(0, (cuentasPorCobrar / promedioVentas.promedio) * 30) : 0
  const dpo = promedioCompras.hayDatos && promedioCompras.promedio > 0 ? Math.max(0, (cuentasPorPagar / promedioCompras.promedio) * 30) : 0
  return {
    dso,
    dpo,
    cicloConversionEfectivo: dso - dpo,
    cuentasPorCobrar,
    cuentasPorPagar,
    hayDatos: promedioVentas.hayDatos || promedioCompras.hayDatos,
  }
}

export interface TramoAging {
  etiqueta: string
  monto: number
  cantidad: number
}

export interface AgingCuentas {
  cobrar: TramoAging[]
  pagar: TramoAging[]
}

const TRAMOS_AGING = [
  { etiqueta: 'Al día', min: -Infinity, max: 0 },
  { etiqueta: '1-30 días vencido', min: 1, max: 30 },
  { etiqueta: '31-60 días vencido', min: 31, max: 60 },
  { etiqueta: '61-90 días vencido', min: 61, max: 90 },
  { etiqueta: 'Más de 90 días vencido', min: 91, max: Infinity },
]

function calcularAgingPorTipo(facturas: Factura[], pagos: Pago[], tipo: TipoFactura, hoyISO: string): TramoAging[] {
  const hoy = new Date(`${hoyISO}T00:00:00`).getTime()
  const tramos = TRAMOS_AGING.map((t) => ({ etiqueta: t.etiqueta, monto: 0, cantidad: 0 }))
  for (const f of facturas) {
    if (f.tipo !== tipo || f.cumplido) continue
    const saldo = saldoPendienteConSigno(f, pagos)
    if (saldo === 0) continue // ya se terminó de pagar de a partes, aunque no se haya tildado cumplido
    const vencimiento = new Date(`${f.fechaEstimadaCobroPago ?? f.fecha}T00:00:00`).getTime()
    const diasVencido = Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24))
    const idx = TRAMOS_AGING.findIndex((t) => diasVencido >= t.min && diasVencido <= t.max)
    const tramo = tramos[idx === -1 ? 0 : idx]
    tramo.monto += saldo
    tramo.cantidad += 1
  }
  return tramos
}

/** Facturas pendientes (no cumplidas) agrupadas por antigüedad de vencimiento, tanto para lo que
 * falta cobrar (emitidas) como para lo que falta pagar (recibidas). Usa el saldo pendiente, no el
 * monto completo, si ya se imputaron pagos parciales desde Cuentas corrientes. */
export function calcularAgingCuentas(
  facturas: Factura[],
  pagos: Pago[] = [],
  hoyISO = new Date().toISOString().slice(0, 10),
): AgingCuentas {
  return {
    cobrar: calcularAgingPorTipo(facturas, pagos, 'emitida', hoyISO),
    pagar: calcularAgingPorTipo(facturas, pagos, 'recibida', hoyISO),
  }
}

// ---------------------------------------------------------------------------
// Cuentas corrientes (Premium): saldo por cliente/proveedor e imputación de pagos parciales
// ---------------------------------------------------------------------------

export interface FacturaConSaldo extends Factura {
  montoPagado: number
  saldo: number
}

export interface CuentaCorrienteContraparte {
  contraparte: string
  totalFacturado: number
  totalPagado: number
  saldo: number
  /** Solo las facturas todavía con saldo, ordenadas de la más vieja a la más nueva (para FIFO). */
  facturas: FacturaConSaldo[]
  /** Remitos/presupuestos todavía sin facturar de esta misma cuenta, con lo ya anticipado — ver
   * RemitosPresupuestos. Se muestran acá para ver la exposición total con el cliente/proveedor,
   * pero "Registrar pago" (FIFO) solo se aplica a las facturas: los anticipos de un remito se
   * registran desde su propia solapa. */
  remitos: RemitoConSaldo[]
}

/** Agrupa por cliente (emitidas) o proveedor (recibidas) tanto las facturas no cumplidas con
 * saldo como los remitos/presupuestos todavía sin facturar, para armar la cuenta corriente
 * completa de cada uno. Las notas de crédito/débito no entran (no se pagan de a partes) y las
 * facturas ya saldadas del todo por pagos parciales tampoco, aunque no se hayan tildado
 * "cumplida" a mano todavía. */
export function agruparCuentaCorriente(
  facturas: Factura[],
  pagos: Pago[],
  remitos: RemitoPresupuesto[],
  anticipos: Anticipo[],
  tipo: TipoFactura,
): CuentaCorrienteContraparte[] {
  const facturasPorContraparte = new Map<string, Factura[]>()
  for (const f of facturas) {
    if (f.tipo !== tipo || f.tipoComprobante !== 'factura' || f.cumplido) continue
    const lista = facturasPorContraparte.get(f.contraparte) ?? []
    lista.push(f)
    facturasPorContraparte.set(f.contraparte, lista)
  }
  const remitosPorContraparte = new Map<string, RemitoPresupuesto[]>()
  for (const r of remitos) {
    if (r.tipo !== tipo || r.estado !== 'pendiente') continue
    const lista = remitosPorContraparte.get(r.contraparte) ?? []
    lista.push(r)
    remitosPorContraparte.set(r.contraparte, lista)
  }

  const contrapartes = new Set([...facturasPorContraparte.keys(), ...remitosPorContraparte.keys()])
  const resultado: CuentaCorrienteContraparte[] = []
  for (const contraparte of contrapartes) {
    const facturasConSaldo: FacturaConSaldo[] = (facturasPorContraparte.get(contraparte) ?? [])
      .map((f) => {
        const montoPagado = calcularMontoPagado(f.id, pagos)
        return { ...f, montoPagado, saldo: Math.max(0, f.monto - montoPagado) }
      })
      .filter((f) => f.saldo > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const remitosConSaldo: RemitoConSaldo[] = (remitosPorContraparte.get(contraparte) ?? [])
      .map((r) => {
        const montoAnticipado = calcularMontoAnticipado(r.id, anticipos)
        return { ...r, montoAnticipado, saldo: Math.max(0, r.monto - montoAnticipado) }
      })
      .filter((r) => r.saldo > 0)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    if (facturasConSaldo.length === 0 && remitosConSaldo.length === 0) continue
    resultado.push({
      contraparte,
      totalFacturado: facturasConSaldo.reduce((s, f) => s + f.monto, 0) + remitosConSaldo.reduce((s, r) => s + r.monto, 0),
      totalPagado:
        facturasConSaldo.reduce((s, f) => s + f.montoPagado, 0) + remitosConSaldo.reduce((s, r) => s + r.montoAnticipado, 0),
      saldo: facturasConSaldo.reduce((s, f) => s + f.saldo, 0) + remitosConSaldo.reduce((s, r) => s + r.saldo, 0),
      facturas: facturasConSaldo,
      remitos: remitosConSaldo,
    })
  }
  return resultado.sort((a, b) => b.saldo - a.saldo)
}

export interface ResultadoImputacion {
  pagos: Pago[]
  /** Ids de las facturas que quedaron totalmente saldadas con esta imputación. */
  facturaIdsCubiertas: string[]
}

/**
 * Reparte un pago genérico a cuenta entre las facturas pendientes de un cliente/proveedor, de la
 * más vieja a la más nueva (FIFO) — así un pago parcial grande se va imputando solo sin tener que
 * elegir factura por factura. Si el monto supera el saldo total pendiente, el excedente no se
 * aplica a ninguna factura (no se inventa un saldo a favor sin una factura que lo respalde).
 */
export function imputarPagoAFIFO(
  facturasPendientes: FacturaConSaldo[],
  monto: number,
  fecha: string,
  medioPago: MedioPago | undefined,
  generarId: () => string,
  cuentaId?: string,
): ResultadoImputacion {
  const pagos: Pago[] = []
  const facturaIdsCubiertas: string[] = []
  let restante = monto
  for (const f of facturasPendientes) {
    if (restante <= 0) break
    const aplicar = Math.min(restante, f.saldo)
    if (aplicar <= 0) continue
    pagos.push({ id: generarId(), facturaId: f.id, monto: aplicar, fecha, medioPago, cuentaId })
    if (aplicar >= f.saldo) facturaIdsCubiertas.push(f.id)
    restante -= aplicar
  }
  return { pagos, facturaIdsCubiertas }
}

// ---------------------------------------------------------------------------
// Remitos y presupuestos (Premium): anticipos antes de facturar un trabajo largo
// ---------------------------------------------------------------------------
//
// Para una empresa industrial que primero entrega un remito (o pasa un presupuesto), cobra un
// anticipo, y recién factura todo junto al terminar el trabajo. Un remito/presupuesto NO es un
// comprobante fiscal — no suma a ventas/compras netas, IVA ni margen bruto — es solo un
// seguimiento del compromiso hasta que se emite la factura real, momento en el que se vincula
// para que los anticipos ya cobrados pasen a ser pagos de esa factura (y no se cobren dos veces).

export type TipoDocumentoAnticipo = 'remito' | 'presupuesto'

export interface LineaProducto {
  /** Si es un producto de Stock — mueve inventario al guardar el remito. */
  productoId?: string
  /** Para líneas sin producto (mano de obra, flete, otros costos de un trabajo industrial) — no
   * mueven stock, solo suman al monto del remito. Obligatorio cuando no hay productoId. */
  descripcion?: string
  cantidad: number
  precioUnitario: number
}

export interface RemitoPresupuesto {
  id: string
  /** "emitida" = a un cliente (vas a cobrar), "recibida" = de un proveedor (vas a pagar). */
  tipo: TipoFactura
  tipoDocumento: TipoDocumentoAnticipo
  contraparte: string
  monto: number
  fecha: string
  numero?: string
  /** "facturado" una vez vinculado a la factura real — ver vincularRemitoAFactura. */
  estado: 'pendiente' | 'facturado'
  facturaId?: string
  /** Líneas de producto opcionales — solo tienen efecto en el stock si tipoDocumento es
   * "remito" (un presupuesto todavía no movió nada). Si están cargadas, el monto del remito se
   * calcula solo a partir de ellas (ver calcularMontoDesdeLineas). */
  lineas?: LineaProducto[]
  /** División o centro de costo del negocio al que pertenece este remito — ver Sector y
   * calcularMargenPorSector. */
  sectorId?: string
}

export interface Anticipo {
  id: string
  remitoId: string
  monto: number
  fecha: string
  medioPago?: MedioPago
  chequeId?: string
  /** Caja o cuenta bancaria donde entró/salió la plata del anticipo — ver MovimientoTesoreria. */
  cuentaId?: string
}

export function calcularMontoAnticipado(remitoId: string, anticipos: Anticipo[]): number {
  return anticipos.filter((a) => a.remitoId === remitoId).reduce((s, a) => s + a.monto, 0)
}

export function calcularSaldoRemito(r: RemitoPresupuesto, anticipos: Anticipo[]): number {
  return Math.max(0, r.monto - calcularMontoAnticipado(r.id, anticipos))
}

export interface RemitoConSaldo extends RemitoPresupuesto {
  montoAnticipado: number
  saldo: number
}

/** Remitos/presupuestos todavía sin facturar, de un cliente o proveedor, con lo ya anticipado y
 * el saldo — de más viejo a más nuevo. */
export function listarRemitosPendientes(
  remitos: RemitoPresupuesto[],
  anticipos: Anticipo[],
  tipo: TipoFactura,
): RemitoConSaldo[] {
  return remitos
    .filter((r) => r.tipo === tipo && r.estado === 'pendiente')
    .map((r) => {
      const montoAnticipado = calcularMontoAnticipado(r.id, anticipos)
      return { ...r, montoAnticipado, saldo: Math.max(0, r.monto - montoAnticipado) }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export interface ResultadoVinculacion {
  pagos: Pago[]
  /** Si los anticipos ya transferidos, sumados a lo que la factura ya tuviera pagado, cubren el
   * total facturado — para poder marcarla cumplida de una vez. */
  facturaCubierta: boolean
}

/**
 * Vincula un remito/presupuesto a la factura real emitida al terminar el trabajo: convierte cada
 * anticipo ya cobrado/pagado en un pago contra esa factura (mismo monto, fecha y medio), para que
 * el saldo de la factura ya refleje lo adelantado.
 */
export function vincularRemitoAFactura(
  anticiposDelRemito: Anticipo[],
  factura: Factura,
  pagosExistentes: Pago[],
  generarId: () => string,
): ResultadoVinculacion {
  const pagos: Pago[] = anticiposDelRemito.map((a) => ({
    id: generarId(),
    facturaId: factura.id,
    monto: a.monto,
    fecha: a.fecha,
    medioPago: a.medioPago,
    chequeId: a.chequeId,
    // La plata del anticipo ya entró/salió de la cuenta cuando se registró — acá solo se copia el
    // dato para que quede visible en qué cuenta se cobró/pagó, sin generar un movimiento nuevo.
    cuentaId: a.cuentaId,
  }))
  const totalPagado = calcularMontoPagado(factura.id, pagosExistentes) + pagos.reduce((s, p) => s + p.monto, 0)
  return { pagos, facturaCubierta: totalPagado >= factura.monto }
}

/** Suma cantidad × precio unitario de cada línea — el monto de un remito con líneas de producto
 * se calcula siempre así, en vez de tipearlo a mano. */
export function calcularMontoDesdeLineas(lineas: LineaProducto[]): number {
  return lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0)
}

// ---------------------------------------------------------------------------
// Stock (Full): catálogo de productos y sus movimientos de entrada/salida/ajuste
// ---------------------------------------------------------------------------
//
// Vive separado de Facturas (que sigue siendo un monto único, sin líneas) — el punto natural
// para descontar o sumar stock es el Remito, porque es el documento que efectivamente acompaña
// la mercadería que se entrega o se recibe. Un Presupuesto no mueve nada todavía.

export interface Producto {
  id: string
  codigo?: string
  nombre: string
  unidad?: string
  /** Último costo de compra conocido (no es promedio ponderado, para mantenerlo simple). */
  costoUnitario: number
  precioVenta?: number
  stockActual: number
  /** Si se define, por debajo de este número el producto aparece como "bajo stock". */
  stockMinimo?: number
}

export type TipoMovimientoStock = 'entrada' | 'salida' | 'ajuste'

export interface MovimientoStock {
  id: string
  productoId: string
  tipo: TipoMovimientoStock
  /** Siempre positiva en "entrada"/"salida" (el signo lo da el tipo); en "ajuste" puede ser
   * negativa, para poder corregir tanto de más como de menos. */
  cantidad: number
  fecha: string
  motivo?: string
  /** Solo en "entrada": si se carga, actualiza el costoUnitario del producto (último costo). */
  costoUnitario?: number
  /** Si este movimiento se generó solo al guardar un remito con líneas de producto. */
  remitoId?: string
}

/** Cuánto suma o resta un movimiento al stock — entradas suman, salidas restan, y un ajuste ya
 * viene con el signo que corresponda. */
function deltaDeMovimiento(mov: MovimientoStock): number {
  if (mov.tipo === 'entrada') return mov.cantidad
  if (mov.tipo === 'salida') return -mov.cantidad
  return mov.cantidad
}

/** Aplica un movimiento a la lista de productos (no muta el array recibido). */
export function aplicarMovimientoStock(productos: Producto[], mov: MovimientoStock): Producto[] {
  return productos.map((p) => {
    if (p.id !== mov.productoId) return p
    return {
      ...p,
      stockActual: p.stockActual + deltaDeMovimiento(mov),
      costoUnitario: mov.tipo === 'entrada' && mov.costoUnitario !== undefined ? mov.costoUnitario : p.costoUnitario,
    }
  })
}

/** Deshace un movimiento (al eliminarlo) — no revierte el costoUnitario, para no complicar el
 * historial de costos por una corrección puntual. */
export function revertirMovimientoStock(productos: Producto[], mov: MovimientoStock): Producto[] {
  return productos.map((p) => (p.id === mov.productoId ? { ...p, stockActual: p.stockActual - deltaDeMovimiento(mov) } : p))
}

/** Valor total del inventario a costo (stock × costo unitario de cada producto). */
export function calcularValorInventario(productos: Producto[]): number {
  return productos.reduce((s, p) => s + p.stockActual * p.costoUnitario, 0)
}

/** Productos con stock en o por debajo de su mínimo definido. */
export function listarProductosBajoMinimo(productos: Producto[]): Producto[] {
  return productos.filter((p) => p.stockMinimo !== undefined && p.stockActual <= p.stockMinimo)
}

/**
 * Genera los movimientos de stock que corresponden a un remito con líneas de producto: si es
 * "emitida" (a un cliente) sale mercadería, si es "recibida" (de un proveedor) entra. Un
 * presupuesto, o un remito sin líneas, no generan nada.
 */
export function generarMovimientosDeRemito(remito: RemitoPresupuesto, generarId: () => string): MovimientoStock[] {
  if (remito.tipoDocumento !== 'remito' || !remito.lineas || remito.lineas.length === 0) return []
  const tipo: TipoMovimientoStock = remito.tipo === 'emitida' ? 'salida' : 'entrada'
  const motivo = `Remito${remito.numero ? ` ${remito.numero}` : ''} — ${remito.contraparte}`
  // Las líneas sin producto (mano de obra, flete, otros costos) suman al monto pero no mueven stock.
  return remito.lineas
    .filter((l): l is LineaProducto & { productoId: string } => Boolean(l.productoId))
    .map((l) => ({
      id: generarId(),
      productoId: l.productoId,
      tipo,
      cantidad: l.cantidad,
      fecha: remito.fecha,
      motivo,
      costoUnitario: tipo === 'entrada' ? l.precioUnitario : undefined,
      remitoId: remito.id,
    }))
}

// ---------------------------------------------------------------------------
// Márgenes por sector (Full): ingreso, costo y ganancia agrupados por sector
// ---------------------------------------------------------------------------
//
// Un Sector es una división o centro de costo del negocio (ej. "Metalúrgica", "Instalaciones",
// "Service") que se asigna a cada Remito al cargarlo. Con eso se puede ver cuánto factura,
// cuánto cuesta y cuánto deja de ganancia cada sector. Solo mira remitos (tipoDocumento ===
// "remito"), nunca presupuestos — un presupuesto todavía no es un compromiso real, mismo
// criterio que generarMovimientosDeRemito con el stock.

export interface Sector {
  id: string
  nombre: string
}

export interface MargenSector {
  sector: Sector
  ingreso: number
  costoCompras: number
  costoLineas: number
  /** Costo mensual de la nómina asignada a este sector — ver AsignacionSector. */
  costoNomina: number
  costoTotal: number
  ganancia: number
  margenPct: number
  cantidadRemitos: number
  /** Remitos emitidos del sector sin líneas cargadas: su costo de venta no se puede separar del
   * monto facturado, así que la ganancia de ese remito queda sobrestimada en el total. */
  remitosSinLineas: number
}

/**
 * Ingreso = remitos emitidos (a un cliente) del sector. Costo = remitos recibidos (de un
 * proveedor) del sector, más el costo de las líneas de producto de los remitos emitidos (al
 * costoUnitario de Stock, no al precio facturado), más el costo mensual de la nómina asignada a
 * ese sector. Las líneas sin producto (mano de obra, flete, otros costos) se cuentan al mismo
 * precio facturado, así que dan margen cero por sí solas — el costo real de esa mano de obra
 * entra por la nómina.
 *
 * El costo de la nómina es mensual, así que quien llama tiene que pasar los remitos de UN mes
 * para que ingreso y costo hablen del mismo período.
 */
export function calcularMargenPorSector(
  sectores: Sector[],
  remitos: RemitoPresupuesto[],
  productos: Producto[],
  /** Nómina vigente: cada empleado suma a los sectores donde esté asignado, según su porcentaje. */
  empleados: Empleado[] = [],
): MargenSector[] {
  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const activos = empleados.filter((e) => e.activo)

  return sectores.map((sector) => {
    const delSector = remitos.filter((r) => r.tipoDocumento === 'remito' && r.sectorId === sector.id)
    const emitidos = delSector.filter((r) => r.tipo === 'emitida')
    const recibidos = delSector.filter((r) => r.tipo === 'recibida')

    const ingreso = emitidos.reduce((s, r) => s + r.monto, 0)
    const costoCompras = recibidos.reduce((s, r) => s + r.monto, 0)
    let costoLineas = 0
    let remitosSinLineas = 0
    for (const r of emitidos) {
      if (!r.lineas || r.lineas.length === 0) {
        remitosSinLineas += 1
        continue
      }
      for (const l of r.lineas) {
        if (l.productoId) {
          costoLineas += (productoPorId.get(l.productoId)?.costoUnitario ?? 0) * l.cantidad
        } else {
          costoLineas += l.precioUnitario * l.cantidad
        }
      }
    }

    const costoNomina = activos.reduce((total, e) => {
      const porcentaje = (e.asignaciones ?? []).find((a) => a.sectorId === sector.id)?.porcentaje ?? 0
      return total + calcularCostoEmpleado(e).costoEmpresa * (porcentaje / 100)
    }, 0)

    const costoTotal = costoCompras + costoLineas + costoNomina
    const ganancia = ingreso - costoTotal
    return {
      sector,
      ingreso,
      costoCompras,
      costoLineas,
      costoNomina,
      costoTotal,
      ganancia,
      margenPct: ingreso > 0 ? (ganancia / ingreso) * 100 : 0,
      cantidadRemitos: delSector.length,
      remitosSinLineas,
    }
  })
}

// ---------------------------------------------------------------------------
// Tendencia mensual de margen (Premium)
// ---------------------------------------------------------------------------

export interface TendenciaMensual {
  mes: string
  ventasNetas: number
  comprasNetas: number
  margenPct: number
}

/** Igual que calcularResumenMensual, sumando el margen (%) de cada mes por separado — para ver la
 * tendencia mes a mes, no solo el total acumulado del período (ver calcularMargenBrutoTotal). */
export function calcularTendenciaMensual(facturas: Factura[]): TendenciaMensual[] {
  return calcularResumenMensual(facturas).map((r) => ({
    ...r,
    margenPct: r.ventasNetas > 0 ? ((r.ventasNetas - r.comprasNetas) / r.ventasNetas) * 100 : 0,
  }))
}

// ---------------------------------------------------------------------------
// Comentarios automáticos de desvío (Premium)
// ---------------------------------------------------------------------------

export interface ComentarioDesvio {
  categoria: string
  desvioMonto: number
  desvioPct: number
  direccion: 'exceso' | 'ahorro'
}

/** Las categorías con mayor desvío (en $) del mes, para explicar en 1-2 líneas por qué se movió el
 * total — igual que haría un CFO al presentar el Presupuesto vs. Real, en vez de solo mostrar la
 * tabla de números. */
export function generarComentariosDesvio(desvios: DesvioCategoria[], top = 3): ComentarioDesvio[] {
  return desvios
    .filter((d) => Math.abs(d.desvioMonto) > 0)
    .sort((a, b) => Math.abs(b.desvioMonto) - Math.abs(a.desvioMonto))
    .slice(0, top)
    .map((d) => ({
      categoria: d.label,
      desvioMonto: d.desvioMonto,
      desvioPct: d.desvioPct,
      direccion: d.desvioMonto > 0 ? 'exceso' : 'ahorro',
    }))
}

// ---------------------------------------------------------------------------
// Escenarios de proyección de caja (Premium)
// ---------------------------------------------------------------------------

export interface EscenarioProyeccion {
  nombre: 'pesimista' | 'base' | 'optimista'
  filas: FilaProyeccion[]
}

/** Tres variantes de la misma proyección: pesimista (10% menos ingresos, 10% más gastos, 2 puntos
 * menos de crecimiento), base (los valores tal cual se cargaron) y optimista (lo inverso) — un CFO
 * casi nunca presenta una proyección con un solo número. */
export function proyectarFlujoCajaEscenarios(
  saldoInicial: number,
  ingresos: number,
  gastosTotales: number,
  meses: number,
  tasaCrecimientoMensualPct = 0,
  gastosExtraPorMes: number[] = [],
): EscenarioProyeccion[] {
  // El aguinaldo no se negocia ni se recorta según cómo venga el año: entra igual en los tres
  // escenarios, sin el ±10% que se le aplica al resto de los gastos.
  return [
    {
      nombre: 'pesimista',
      filas: proyectarFlujoCaja(saldoInicial, ingresos * 0.9, gastosTotales * 1.1, meses, tasaCrecimientoMensualPct - 2, gastosExtraPorMes),
    },
    {
      nombre: 'base',
      filas: proyectarFlujoCaja(saldoInicial, ingresos, gastosTotales, meses, tasaCrecimientoMensualPct, gastosExtraPorMes),
    },
    {
      nombre: 'optimista',
      filas: proyectarFlujoCaja(saldoInicial, ingresos * 1.1, gastosTotales * 0.95, meses, tasaCrecimientoMensualPct + 2, gastosExtraPorMes),
    },
  ]
}

// ---------------------------------------------------------------------------
// Recomendaciones automáticas (Premium)
// ---------------------------------------------------------------------------
//
// La diferencia entre un reporte de contador y uno de CFO: no solo decir qué
// pasó (eso ya lo hacen las alertas), sino qué hacer al respecto.

export type PrioridadRecomendacion = 'alta' | 'media'

export interface Recomendacion {
  id: string
  prioridad: PrioridadRecomendacion
  texto: string
}

export function generarRecomendaciones(input: {
  margenOperativo: number
  runwayMeses: number
  proyeccion: FilaProyeccion[]
  deudas: Deuda[]
  dso: number
  dpo: number
  hayDatosCobroPago: boolean
}): Recomendacion[] {
  const recomendaciones: Recomendacion[] = []
  const { margenOperativo, runwayMeses, proyeccion, deudas, dso, dpo, hayDatosCobroPago } = input

  if (margenOperativo < 0) {
    recomendaciones.push({
      id: 'reducir-gastos',
      prioridad: 'alta',
      texto: 'Revisá tus gastos: hoy gastás más de lo que facturás. Priorizá recortar gastos variables antes que los fijos.',
    })
  }

  if (runwayMeses < 3) {
    recomendaciones.push({
      id: 'asegurar-caja',
      prioridad: 'alta',
      texto: 'Con menos de 3 meses de runway, evitá comprometer nuevos gastos fijos y negociá plazos más largos con tus proveedores.',
    })
  }

  const mesQuiebre = proyeccion.find((f) => f.saldo < 0)?.mes
  if (mesQuiebre) {
    recomendaciones.push({
      id: 'anticipar-quiebre',
      prioridad: 'alta',
      texto: `Tu proyección muestra caja negativa en el mes ${mesQuiebre}: conseguí una línea de crédito o acelerá cobranzas antes de esa fecha.`,
    })
  }

  if (hayDatosCobroPago && dso > 0 && dpo >= 0 && dso > dpo + 15) {
    recomendaciones.push({
      id: 'mejorar-cobranza',
      prioridad: 'media',
      texto: `Cobrás en promedio a los ${dso.toFixed(0)} días y pagás a los ${dpo.toFixed(0)}: estás financiando a tus clientes. Acortá los plazos de cobro o pedí anticipos.`,
    })
  }

  if (deudas.some((d) => d.proximoVencimiento)) {
    recomendaciones.push({
      id: 'revisar-vencimientos',
      prioridad: 'media',
      texto: 'Tenés deudas con vencimiento próximo: confirmá que la caja proyectada las cubre antes de que llegue la fecha.',
    })
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push({
      id: 'todo-en-orden',
      prioridad: 'media',
      texto: 'Tus indicadores están en buen estado. Mantené el monitoreo mensual de margen, runway y cobranzas para sostenerlo.',
    })
  }

  return recomendaciones
}
