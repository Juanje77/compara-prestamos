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
): FilaProyeccion[] {
  const filas: FilaProyeccion[] = []
  let saldo = saldoInicial
  let ingresoMes = ingresos
  for (let mes = 1; mes <= meses; mes++) {
    saldo += ingresoMes - gastosTotales
    filas.push({ mes, ingresos: ingresoMes, gastos: gastosTotales, saldo })
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

/** DSO/DPO estándar: (saldo pendiente / ventas o compras promedio mensual) × 30 días. */
export function calcularDSOyDPO(facturas: Factura[]): IndicadoresCobroPago {
  const cuentasPorCobrar = facturas.filter((f) => f.tipo === 'emitida' && !f.cumplido).reduce((s, f) => s + montoConSigno(f), 0)
  const cuentasPorPagar = facturas.filter((f) => f.tipo === 'recibida' && !f.cumplido).reduce((s, f) => s + montoConSigno(f), 0)
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

function calcularAgingPorTipo(facturas: Factura[], tipo: TipoFactura, hoyISO: string): TramoAging[] {
  const hoy = new Date(`${hoyISO}T00:00:00`).getTime()
  const tramos = TRAMOS_AGING.map((t) => ({ etiqueta: t.etiqueta, monto: 0, cantidad: 0 }))
  for (const f of facturas) {
    if (f.tipo !== tipo || f.cumplido) continue
    const vencimiento = new Date(`${f.fechaEstimadaCobroPago ?? f.fecha}T00:00:00`).getTime()
    const diasVencido = Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24))
    const idx = TRAMOS_AGING.findIndex((t) => diasVencido >= t.min && diasVencido <= t.max)
    const tramo = tramos[idx === -1 ? 0 : idx]
    tramo.monto += montoConSigno(f)
    tramo.cantidad += 1
  }
  return tramos
}

/** Facturas pendientes (no cumplidas) agrupadas por antigüedad de vencimiento, tanto para lo que
 * falta cobrar (emitidas) como para lo que falta pagar (recibidas). */
export function calcularAgingCuentas(facturas: Factura[], hoyISO = new Date().toISOString().slice(0, 10)): AgingCuentas {
  return {
    cobrar: calcularAgingPorTipo(facturas, 'emitida', hoyISO),
    pagar: calcularAgingPorTipo(facturas, 'recibida', hoyISO),
  }
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
): EscenarioProyeccion[] {
  return [
    {
      nombre: 'pesimista',
      filas: proyectarFlujoCaja(saldoInicial, ingresos * 0.9, gastosTotales * 1.1, meses, tasaCrecimientoMensualPct - 2),
    },
    { nombre: 'base', filas: proyectarFlujoCaja(saldoInicial, ingresos, gastosTotales, meses, tasaCrecimientoMensualPct) },
    {
      nombre: 'optimista',
      filas: proyectarFlujoCaja(saldoInicial, ingresos * 1.1, gastosTotales * 0.95, meses, tasaCrecimientoMensualPct + 2),
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
