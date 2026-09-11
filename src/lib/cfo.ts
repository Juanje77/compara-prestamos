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
}

/** Compara lo presupuestado (categorías) contra lo realmente gastado/ingresado en el mes. */
export function calcularDesvios(categorias: CategoriaGasto[], real: Record<string, number>): DesvioCategoria[] {
  return categorias.map((c) => {
    const montoReal = real[c.key] ?? 0
    const desvioMonto = montoReal - c.monto
    const desvioPct = c.monto > 0 ? (desvioMonto / c.monto) * 100 : montoReal > 0 ? 100 : 0
    return { key: c.key, label: c.label, presupuestado: c.monto, real: montoReal, desvioMonto, desvioPct }
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
}

/**
 * Monto con signo: las notas de crédito restan (una compra que se anula, o una venta que no se
 * concretó/se anuló), las facturas y notas de débito (recargos) suman — tanto en emitidas como
 * en recibidas.
 */
export function montoConSigno(f: Factura): number {
  return f.tipoComprobante === 'nota_credito' ? -f.monto : f.monto
}

export interface ResumenMensual {
  mes: string
  ventasNetas: number
  comprasNetas: number
  margenBruto: number
  margenBrutoPct: number
}

/** Ventas y compras netas por mes (ya con notas de crédito/débito aplicadas), y margen bruto. */
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
    .map(([mes, { ventas, compras }]) => ({
      mes,
      ventasNetas: ventas,
      comprasNetas: compras,
      margenBruto: ventas - compras,
      margenBrutoPct: ventas > 0 ? ((ventas - compras) / ventas) * 100 : 0,
    }))
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

export interface PesoNotas {
  pctNotasEmitidas: number
  pctNotasRecibidas: number
  totalNotaCreditoEmitida: number
  totalNotaDebitoEmitida: number
  totalNotaCreditoRecibida: number
  totalNotaDebitoRecibida: number
}

/** Qué porcentaje de lo facturado en bruto corresponde a notas de crédito/débito (ajustes). */
export function calcularPesoNotas(facturas: Factura[]): PesoNotas {
  const sum = (tipo: TipoFactura, tc: TipoComprobante) =>
    facturas.filter((f) => f.tipo === tipo && f.tipoComprobante === tc).reduce((s, f) => s + f.monto, 0)

  const totalNotaCreditoEmitida = sum('emitida', 'nota_credito')
  const totalNotaDebitoEmitida = sum('emitida', 'nota_debito')
  const totalNotaCreditoRecibida = sum('recibida', 'nota_credito')
  const totalNotaDebitoRecibida = sum('recibida', 'nota_debito')
  const brutoEmitidas = sum('emitida', 'factura') + totalNotaDebitoEmitida + totalNotaCreditoEmitida
  const brutoRecibidas = sum('recibida', 'factura') + totalNotaDebitoRecibida + totalNotaCreditoRecibida

  return {
    pctNotasEmitidas: brutoEmitidas > 0 ? ((totalNotaCreditoEmitida + totalNotaDebitoEmitida) / brutoEmitidas) * 100 : 0,
    pctNotasRecibidas: brutoRecibidas > 0 ? ((totalNotaCreditoRecibida + totalNotaDebitoRecibida) / brutoRecibidas) * 100 : 0,
    totalNotaCreditoEmitida,
    totalNotaDebitoEmitida,
    totalNotaCreditoRecibida,
    totalNotaDebitoRecibida,
  }
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

  const resumenMensual = calcularResumenMensual(facturas)
  const ultimoMes = resumenMensual[resumenMensual.length - 1]
  if (ultimoMes && ultimoMes.margenBruto < 0) {
    alertas.push({
      id: 'margen-bruto-negativo',
      severidad: 'critical',
      mensaje: `Según tus comprobantes, en ${ultimoMes.mes} compraste más de lo que facturaste (margen bruto negativo).`,
    })
  }

  const pesoNotas = calcularPesoNotas(facturas)
  if (pesoNotas.pctNotasEmitidas > 15) {
    alertas.push({
      id: 'notas-emitidas-altas',
      severidad: 'warning',
      mensaje: `El ${pesoNotas.pctNotasEmitidas.toFixed(0)}% de tu facturación emitida son notas de crédito/débito (ventas anuladas o recargos) — vale la pena revisar por qué.`,
    })
  }

  return alertas
}
