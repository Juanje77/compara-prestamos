export interface CuentaBancaria {
  id: string
  nombre: string
  saldo: number
}

export function calcularSaldoTotalBancos(cuentas: CuentaBancaria[]): number {
  return cuentas.reduce((s, c) => s + c.saldo, 0)
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

/** Runway de caja: meses que el saldo actual alcanza para cubrir los gastos totales si el ingreso cayera a cero. */
export function calcularRunwayMeses(saldoInicial: number, gastosTotales: number): number {
  if (gastosTotales <= 0) return Infinity
  return Math.max(0, saldoInicial / gastosTotales)
}

/** Cobertura de deuda: cuántas veces el ingreso mensual cubre la cuota de deuda mensual total. */
export function calcularCoberturaDeuda(ingresos: number, cuotaDeudaTotal: number): number {
  if (cuotaDeudaTotal <= 0) return Infinity
  return ingresos / cuotaDeudaTotal
}

export interface FilaProyeccion {
  mes: number
  saldo: number
}

/**
 * Proyección de saldo de caja mes a mes. Con `tasaCrecimientoMensualPct` en 0 (el valor por
 * defecto) es una proyección lineal simple, asumiendo ingresos y gastos constantes. Con una tasa
 * distinta de 0, los ingresos se ajustan ese porcentaje cada mes (función Premium).
 */
export function proyectarFlujoCaja(
  saldoInicial: number,
  ingresos: number,
  gastosTotales: number,
  meses: number,
  tasaCrecimientoMensualPct = 0,
): FilaProyeccion[] {
  const filas: FilaProyeccion[] = []
  let saldo = saldoInicial
  let ingresoMes = ingresos
  for (let mes = 1; mes <= meses; mes++) {
    saldo += ingresoMes - gastosTotales
    filas.push({ mes, saldo })
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

export interface VentasComprasMes {
  hayVentas: boolean
  hayCompras: boolean
  ventasNetas: number
  comprasNetas: number
}

/**
 * Ventas y compras netas cargadas para un mes puntual (formato "YYYY-MM"), con un flag de si hay
 * datos reales para cada lado — así el Dashboard puede usar el número real cuando existe, y la
 * estimación manual cuando no.
 */
export function calcularVentasComprasDelMes(facturas: Factura[], mesISO: string): VentasComprasMes {
  let ventasNetas = 0
  let comprasNetas = 0
  let hayVentas = false
  let hayCompras = false
  for (const f of facturas) {
    for (const cuota of distribuirEnCuotas(f)) {
      if (cuota.fecha.slice(0, 7) !== mesISO) continue
      if (f.tipo === 'emitida') {
        ventasNetas += cuota.monto
        hayVentas = true
      } else {
        comprasNetas += cuota.monto
        hayCompras = true
      }
    }
  }
  return { hayVentas, hayCompras, ventasNetas, comprasNetas }
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
}): Alerta[] {
  const alertas: Alerta[] = []
  const { margenOperativo, runwayMeses, proyeccion, deudas, facturas } = input

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

  return alertas
}
