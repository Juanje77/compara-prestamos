// El estado de resultados del ejercicio, armado con lo que ya está cargado.
//
// Va por DEVENGADO: cada comprobante pesa en el período de su fecha, se haya cobrado o no. Lo
// cobrado lo mira Cobranzas y pagos; mezclar los dos criterios en un estado de resultados es el
// error clásico, y da un número que no es ni una cosa ni la otra.
//
// Y va SIN IVA. El IVA no es ingreso ni gasto: se cobra y se paga por cuenta del fisco. De ahí
// sale el riesgo más serio de esta pantalla, que está contemplado abajo: si un responsable
// inscripto carga sus comprobantes sin discriminar el IVA, el sistema no puede distinguir ese
// caso de un monotributista cuyos importes son netos de verdad, y las ventas quedarían infladas
// un 21%. Por eso se informa cuántos comprobantes no traen IVA discriminado, para que quien lee
// el estado sepa si puede confiar en él.

import {
  CATEGORIAS_GASTO,
  calcularCostoEmpleado,
  montoNetoConSigno,
  type ClasificacionesProveedores,
  type Empleado,
  type Factura,
  type MovimientoStock,
  type Producto,
} from './cfo'
import { amortizacionesDelAnio, type ResumenAmortizaciones } from './amortizaciones'

/** Qué se incluye: todo lo que pasó, o solo lo que tiene respaldo fiscal. */
export type CriterioResultados = 'gestion' | 'fiscal'

/** Con qué se calculó el costo de ventas, que no siempre se puede elegir. */
export type CriterioCosto = 'stock' | 'compras'

export interface LineaGasto {
  key: string
  label: string
  monto: number
}

export interface EstadoResultados {
  anio: number
  criterio: CriterioResultados
  ventasNetas: number
  costoVentas: number
  criterioCosto: CriterioCosto
  resultadoBruto: number
  /** Margen bruto sobre ventas, en porcentaje. */
  margenBrutoPct: number
  sueldos: number
  gastos: LineaGasto[]
  totalGastos: number
  amortizaciones: number
  resultadoOperativo: number
  /** Negativo: comisiones por descontar cheques. Es lo único financiero que el sistema conoce. */
  resultadosFinancieros: number
  resultadoAntesDeImpuestos: number
  impuestos: number
  resultadoNeto: number
  /** Cuántos comprobantes del período no traen IVA discriminado — ver el comentario de arriba. */
  comprobantesSinIva: number
  /** Cuánto de las ventas viene de comprobantes internos. Solo con criterio "gestion". */
  ventasSinFactura: number
  amortizacionesDetalle: ResumenAmortizaciones
}

function delAnio(f: Factura, anio: number): boolean {
  return f.fecha.startsWith(String(anio))
}

/** El neto del comprobante, con el signo que corresponde (las notas de crédito restan). */
function neto(f: Factura): number {
  return montoNetoConSigno(f)
}

/**
 * El costo de ventas por las salidas de stock valorizadas.
 *
 * Es el criterio correcto —mide lo que salió, no lo que se compró— pero solo sirve para quien
 * lleva Stock con los costos al día. Se valoriza al último costo conocido del producto, que es lo
 * que el sistema guarda: no hay costeo promedio ponderado ni PEPS.
 */
function costoPorSalidasDeStock(movimientos: MovimientoStock[], productos: Producto[], anio: number): number {
  const costoPorProducto = new Map(productos.map((p) => [p.id, p.costoUnitario]))
  return movimientos
    .filter((m) => m.tipo === 'salida' && m.fecha.startsWith(String(anio)))
    .reduce((s, m) => s + m.cantidad * (costoPorProducto.get(m.productoId) ?? 0), 0)
}

export interface EntradaEstadoResultados {
  anio: number
  criterio: CriterioResultados
  facturas: Factura[]
  clasificaciones: ClasificacionesProveedores
  empleados: Empleado[]
  bienes: Parameters<typeof amortizacionesDelAnio>[0]
  productos?: Producto[]
  movimientosStock?: MovimientoStock[]
  /** Comisiones pagadas por descontar cheques en el período. */
  comisionesCheques?: number
  /** IIBB y monotributo del período, que se calculan en sus propias pantallas. */
  impuestos?: number
}

export function calcularEstadoResultados({
  anio,
  criterio,
  facturas,
  clasificaciones,
  empleados,
  bienes,
  productos = [],
  movimientosStock = [],
  comisionesCheques = 0,
  impuestos = 0,
}: EntradaEstadoResultados): EstadoResultados {
  // Con criterio fiscal quedan afuera los comprobantes internos: no existen para ARCA. Con
  // criterio de gestión entran, porque son plata que entró de verdad.
  const delPeriodo = facturas.filter((f) => delAnio(f, anio) && (criterio === 'gestion' || !f.esInterna))

  const emitidas = delPeriodo.filter((f) => f.tipo === 'emitida')
  const recibidas = delPeriodo.filter((f) => f.tipo === 'recibida')

  const ventasNetas = emitidas.reduce((s, f) => s + neto(f), 0)
  const ventasSinFactura = criterio === 'gestion' ? emitidas.filter((f) => f.esInterna).reduce((s, f) => s + neto(f), 0) : 0

  // Las compras clasificadas como mercadería o insumos son el costo; el resto son gastos. Un
  // proveedor sin clasificar cae en "otros", que es donde menos daño hace: no infla el costo de
  // ventas ni, por lo tanto, el margen bruto.
  const esCosto = (f: Factura) => clasificaciones[f.contraparte] === 'insumos'
  const comprasDeMercaderia = recibidas.filter(esCosto).reduce((s, f) => s + neto(f), 0)

  // Las salidas de stock solo se usan si hay stock cargado de verdad: con el catálogo vacío
  // darían cero y el costo de ventas desaparecería, que es peor que usar las compras.
  const hayStock = productos.length > 0 && movimientosStock.length > 0
  const criterioCosto: CriterioCosto = hayStock ? 'stock' : 'compras'
  const costoVentas = hayStock ? costoPorSalidasDeStock(movimientosStock, productos, anio) : comprasDeMercaderia

  const resultadoBruto = ventasNetas - costoVentas

  // La nómina se devenga doce veces al año más el aguinaldo, que es un sueldo más repartido en
  // dos cuotas: trece sueldos en total.
  const sueldos = empleados
    .filter((e) => e.activo !== false)
    .reduce((s, e) => s + calcularCostoEmpleado(e).costoEmpresa * 13, 0)

  // El resto de las compras, agrupadas por la clasificación del proveedor. Los sueldos salen de
  // la nómina y no de acá, así que esa categoría se saltea: contarla dos veces sería duplicar el
  // mayor gasto de casi cualquier negocio.
  const gastos: LineaGasto[] = CATEGORIAS_GASTO.filter((c) => c.key !== 'insumos' && c.key !== 'sueldos').map((c) => ({
    key: c.key,
    label: c.label,
    monto: recibidas.filter((f) => clasificaciones[f.contraparte] === c.key).reduce((s, f) => s + neto(f), 0),
  }))
  const sinClasificar = recibidas
    .filter((f) => !clasificaciones[f.contraparte])
    .reduce((s, f) => s + neto(f), 0)
  if (sinClasificar !== 0) {
    const otros = gastos.find((g) => g.key === 'otros')
    if (otros) otros.monto += sinClasificar
    else gastos.push({ key: 'otros', label: 'Otros gastos', monto: sinClasificar })
  }

  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)
  const amortizacionesDetalle = amortizacionesDelAnio(bienes, anio)
  const amortizaciones = amortizacionesDetalle.totalDelPeriodo

  const resultadoOperativo = resultadoBruto - sueldos - totalGastos - amortizaciones
  // El `|| 0` evita el "-0" que sale de negar un cero y que se muestra como "-$ 0".
  const resultadosFinancieros = -comisionesCheques || 0
  const resultadoAntesDeImpuestos = resultadoOperativo + resultadosFinancieros

  return {
    anio,
    criterio,
    ventasNetas,
    costoVentas,
    criterioCosto,
    resultadoBruto,
    margenBrutoPct: ventasNetas > 0 ? (resultadoBruto / ventasNetas) * 100 : 0,
    sueldos,
    gastos,
    totalGastos,
    amortizaciones,
    resultadoOperativo,
    resultadosFinancieros,
    resultadoAntesDeImpuestos,
    impuestos,
    resultadoNeto: resultadoAntesDeImpuestos - impuestos,
    comprobantesSinIva: delPeriodo.filter((f) => !f.esInterna && (f.iva ?? 0) === 0).length,
    ventasSinFactura,
    amortizacionesDetalle,
  }
}
