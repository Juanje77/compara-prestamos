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
// Facturas y comprobantes (Premium)
// ---------------------------------------------------------------------------

export type TipoFactura = 'emitida' | 'recibida'
export type EstadoFactura = 'pendiente' | 'cobrada' | 'pagada' | 'vencida'

export interface Factura {
  id: string
  tipo: TipoFactura
  contraparte: string
  monto: number
  fechaEmision: string
  fechaVencimiento: string
  estado: EstadoFactura
}

/** Marca como "vencida" toda factura pendiente cuyo vencimiento ya pasó. */
export function actualizarVencimientos(facturas: Factura[]): Factura[] {
  const hoy = new Date().toISOString().slice(0, 10)
  return facturas.map((f) =>
    f.estado === 'pendiente' && f.fechaVencimiento && f.fechaVencimiento < hoy ? { ...f, estado: 'vencida' } : f,
  )
}

export interface TotalesFacturas {
  porCobrar: number
  porPagar: number
  vencidasCobrar: number
  vencidasPagar: number
}

export function calcularTotalesFacturas(facturas: Factura[]): TotalesFacturas {
  const abiertas = (tipo: TipoFactura) =>
    facturas.filter((f) => f.tipo === tipo && (f.estado === 'pendiente' || f.estado === 'vencida'))
  return {
    porCobrar: abiertas('emitida').reduce((s, f) => s + f.monto, 0),
    porPagar: abiertas('recibida').reduce((s, f) => s + f.monto, 0),
    vencidasCobrar: abiertas('emitida').filter((f) => f.estado === 'vencida').length,
    vencidasPagar: abiertas('recibida').filter((f) => f.estado === 'vencida').length,
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

  const { vencidasCobrar, vencidasPagar } = calcularTotalesFacturas(facturas)
  if (vencidasCobrar > 0) {
    alertas.push({ id: 'facturas-vencidas-cobrar', severidad: 'warning', mensaje: `Tenés ${vencidasCobrar} factura(s) emitida(s) vencida(s) sin cobrar.` })
  }
  if (vencidasPagar > 0) {
    alertas.push({ id: 'facturas-vencidas-pagar', severidad: 'critical', mensaje: `Tenés ${vencidasPagar} factura(s) recibida(s) vencida(s) sin pagar.` })
  }

  return alertas
}
