// Monotributo: en qué categoría estás y en cuál vas a quedar en la próxima recategorización.
//
// La tabla la publica ARCA y se actualiza dos veces al año, junto con la recategorización de
// febrero y agosto. Por eso vive acá, en un solo lugar, con su fecha de vigencia a la vista: una
// tabla vieja no da error, da un número equivocado, que es peor. Si al abrir la pantalla la fecha
// de vigencia quedó atrás, hay que actualizar TABLA_MONOTRIBUTO y MONOTRIBUTO_VIGENTE_DESDE.
//
// El total de cada categoría no se guarda: se suma (impuesto integrado + SIPA + obra social). Así
// no puede quedar desincronizado de sus partes al actualizar la tabla, y el test compara esa suma
// contra los totales que publica ARCA, que es lo que atrapa un error de tipeo.

import { montoConSigno, type Factura, type TipoFactura } from './cfo'

export type ActividadMonotributo = 'servicios' | 'muebles'

export const ACTIVIDAD_MONOTRIBUTO_LABEL: Record<ActividadMonotributo, string> = {
  servicios: 'Locaciones y prestaciones de servicios',
  muebles: 'Venta de cosas muebles',
}

export interface CategoriaMonotributo {
  id: string
  /** Tope de ingresos brutos de los últimos 12 meses. */
  ingresosBrutos: number
  /** Tope de superficie afectada a la actividad, en m². */
  superficieM2: number
  /** Tope de energía eléctrica consumida en 12 meses, en kW. */
  energiaKw: number
  /** Tope de alquileres devengados en 12 meses. */
  alquileres: number
  impuestoIntegrado: Record<ActividadMonotributo, number>
  aportesSipa: number
  aportesObraSocial: number
}

/** Desde cuándo rige la tabla de abajo. Se muestra en pantalla para que se note si quedó vieja. */
export const MONOTRIBUTO_VIGENTE_DESDE = '2026-08-01'

/** Tope de precio unitario para venta de cosas muebles. Es el mismo en todas las categorías, así
 * que no sirve para categorizar: es una causal de exclusión — vender algo más caro que esto deja
 * al contribuyente afuera del régimen. */
export const PRECIO_UNITARIO_MAXIMO = 716840.77

export const TABLA_MONOTRIBUTO: CategoriaMonotributo[] = [
  { id: 'A', ingresosBrutos: 12009410.45, superficieM2: 30, energiaKw: 3330, alquileres: 2792886.15, impuestoIntegrado: { servicios: 5585.77, muebles: 5585.77 }, aportesSipa: 18246.86, aportesObraSocial: 25694.55 },
  { id: 'B', ingresosBrutos: 17595182.74, superficieM2: 45, energiaKw: 5000, alquileres: 2792886.15, impuestoIntegrado: { servicios: 10612.98, muebles: 10612.98 }, aportesSipa: 20071.55, aportesObraSocial: 25694.55 },
  { id: 'C', ingresosBrutos: 24670494.31, superficieM2: 60, energiaKw: 6700, alquileres: 3816944.41, impuestoIntegrado: { servicios: 18246.86, muebles: 16757.32 }, aportesSipa: 22078.71, aportesObraSocial: 25694.55 },
  { id: 'D', ingresosBrutos: 30628651.43, superficieM2: 85, energiaKw: 10000, alquileres: 3816944.41, impuestoIntegrado: { servicios: 29790.79, muebles: 27742.67 }, aportesSipa: 24286.58, aportesObraSocial: 30535.56 },
  { id: 'E', ingresosBrutos: 36028231.33, superficieM2: 110, energiaKw: 13000, alquileres: 4841002.66, impuestoIntegrado: { servicios: 55857.73, muebles: 44313.79 }, aportesSipa: 26715.24, aportesObraSocial: 37238.48 },
  { id: 'F', ingresosBrutos: 45151659.41, superficieM2: 150, energiaKw: 16500, alquileres: 4841002.66, impuestoIntegrado: { servicios: 78573.2, muebles: 57719.64 }, aportesSipa: 29386.76, aportesObraSocial: 42824.25 },
  { id: 'G', ingresosBrutos: 53995798.87, superficieM2: 200, energiaKw: 20000, alquileres: 5771964.69, impuestoIntegrado: { servicios: 142995.76, muebles: 71497.87 }, aportesSipa: 41141.46, aportesObraSocial: 46175.72 },
  { id: 'H', ingresosBrutos: 81924660.37, superficieM2: 200, energiaKw: 20000, alquileres: 8378658.45, impuestoIntegrado: { servicios: 409623.31, muebles: 204811.64 }, aportesSipa: 57598.04, aportesObraSocial: 55485.33 },
  { id: 'I', ingresosBrutos: 91699761.9, superficieM2: 200, energiaKw: 20000, alquileres: 8378658.45, impuestoIntegrado: { servicios: 814591.79, muebles: 325836.71 }, aportesSipa: 80637.26, aportesObraSocial: 68518.81 },
  { id: 'J', ingresosBrutos: 105012519.2, superficieM2: 200, energiaKw: 20000, alquileres: 8378658.45, impuestoIntegrado: { servicios: 977510.14, muebles: 391004.07 }, aportesSipa: 112892.16, aportesObraSocial: 76897.46 },
  { id: 'K', ingresosBrutos: 126610838.75, superficieM2: 200, energiaKw: 20000, alquileres: 8378658.45, impuestoIntegrado: { servicios: 1368514.2, muebles: 456171.4 }, aportesSipa: 158049.02, aportesObraSocial: 87882.82 },
]

/** La cuota mensual completa: impuesto integrado de la actividad + jubilación + obra social. */
export function cuotaMensual(categoria: CategoriaMonotributo, actividad: ActividadMonotributo): number {
  return categoria.impuestoIntegrado[actividad] + categoria.aportesSipa + categoria.aportesObraSocial
}

/** Los parámetros que miden la actividad de los últimos 12 meses. Superficie, energía y alquileres
 * son opcionales porque no toda actividad los tiene (un servicio prestado a domicilio, por
 * ejemplo): lo que no se carga, no categoriza. */
export interface ParametrosMonotributo {
  ingresosBrutos: number
  superficieM2?: number
  energiaKw?: number
  alquileres?: number
}

export interface EncuadreMonotributo {
  /** La categoría que corresponde, o null si algún parámetro se pasa de la última y queda excluido. */
  categoria: CategoriaMonotributo | null
  /** Qué parámetros empujaron hasta esa categoría — puede ser más de uno si empatan. */
  determinantes: (keyof ParametrosMonotributo)[]
  /** Cuánto falta para pasar al escalón siguiente por ingresos, o null si ya está en la última. */
  margenHastaElSiguiente: number | null
  /** true si se pasó de la categoría más alta y ya no puede seguir en el régimen. */
  excedido: boolean
}

const PARAMETROS: { clave: keyof ParametrosMonotributo; tope: keyof CategoriaMonotributo }[] = [
  { clave: 'ingresosBrutos', tope: 'ingresosBrutos' },
  { clave: 'superficieM2', tope: 'superficieM2' },
  { clave: 'energiaKw', tope: 'energiaKw' },
  { clave: 'alquileres', tope: 'alquileres' },
]

/**
 * En qué categoría cae alguien con estos parámetros.
 *
 * La categoría no la define solo la facturación: cada parámetro exige su propia categoría mínima y
 * manda el más exigente. Alguien que factura poco pero alquila un local caro se categoriza por el
 * alquiler.
 */
export function encuadrar(parametros: ParametrosMonotributo): EncuadreMonotributo {
  let indice = 0
  let determinantes: (keyof ParametrosMonotributo)[] = []

  for (const { clave, tope } of PARAMETROS) {
    const valor = parametros[clave]
    if (valor === undefined) continue

    const minimo = TABLA_MONOTRIBUTO.findIndex((c) => valor <= (c[tope] as number))
    // -1 = no entra ni en la última categoría, así que queda excluido del régimen.
    if (minimo === -1) return { categoria: null, determinantes: [clave], margenHastaElSiguiente: null, excedido: true }

    if (minimo > indice) {
      indice = minimo
      determinantes = [clave]
    } else if (minimo === indice && minimo > 0) {
      determinantes.push(clave)
    }
  }

  const categoria = TABLA_MONOTRIBUTO[indice]
  const siguiente = TABLA_MONOTRIBUTO[indice + 1]
  return {
    categoria,
    // En la categoría más baja no hay nada que "empuje": no se marca ningún determinante.
    determinantes,
    margenHastaElSiguiente: siguiente ? categoria.ingresosBrutos - parametros.ingresosBrutos : null,
    excedido: false,
  }
}

/**
 * Suma de los comprobantes fiscales de un tipo en los últimos 12 meses, que es la ventana que mira
 * la recategorización. Las notas de crédito restan.
 *
 * Los comprobantes internos quedan afuera, igual que en Posición de IVA y en Ingresos Brutos: no
 * son comprobantes fiscales. Quedan adentro tanto los cargados a mano como los importados del
 * Excel de ARCA, porque el importador no marca nada como interno.
 */
function totalUltimos12Meses(facturas: Factura[], tipo: TipoFactura, hasta: Date): number {
  const desde = new Date(hasta)
  desde.setFullYear(desde.getFullYear() - 1)
  const desdeISO = desde.toISOString().slice(0, 10)
  const hastaISO = hasta.toISOString().slice(0, 10)

  return facturas
    .filter((f) => f.tipo === tipo && !f.esInterna && f.fecha > desdeISO && f.fecha <= hastaISO)
    .reduce((total, f) => total + montoConSigno(f), 0)
}

/** Ingresos brutos de los últimos 12 meses: lo facturado a ARCA. Si se lo quiere pisar con otro
 * número, la pantalla lo deja cargar a mano. */
export function ingresosUltimos12Meses(facturas: Factura[], hasta: Date = new Date()): number {
  return totalUltimos12Meses(facturas, 'emitida', hasta)
}

/** Compras de los últimos 12 meses: solo lo que le facturaron al usuario, es decir los
 * comprobantes recibidos. Los gastos sin factura no entran, porque tampoco los ve ARCA. */
export function comprasUltimos12Meses(facturas: Factura[], hasta: Date = new Date()): number {
  return totalUltimos12Meses(facturas, 'recibida', hasta)
}

/** Qué proporción de las ventas tiene que estar respaldada por compras facturadas, según la
 * actividad. Es la misma relación que mira ARCA para detectar ventas no declaradas: quien revende
 * cosas muebles compra casi tanto como vende, mientras que un servicio casi no tiene compras. */
export const PROPORCION_MINIMA_COMPRAS: Record<ActividadMonotributo, number> = {
  muebles: 0.8,
  servicios: 0.4,
}

export interface RelacionComprasVentas {
  ventas: number
  compras: number
  /** compras / ventas, o null si no hubo ventas: sin ventas no hay contra qué medir. */
  proporcion: number | null
  /** La proporción mínima esperada para la actividad. */
  minima: number
  /** false solo cuando hubo ventas y las compras no llegan al mínimo. */
  cumple: boolean
  /** Cuánto más habría que tener en compras facturadas para llegar al mínimo. */
  faltante: number
}

/**
 * Relación entre compras facturadas y ventas de los últimos 12 meses.
 *
 * Es un control de coherencia, no una categoría: si las compras quedan muy por debajo de las
 * ventas, o falta cargar facturas de proveedores, o hay ventas que no se están respaldando con
 * compras — y eso es justamente lo que ARCA cruza.
 */
export function relacionComprasVentas(
  ventas: number,
  compras: number,
  actividad: ActividadMonotributo,
): RelacionComprasVentas {
  const minima = PROPORCION_MINIMA_COMPRAS[actividad]
  if (ventas <= 0) {
    return { ventas, compras, proporcion: null, minima, cumple: true, faltante: 0 }
  }
  const proporcion = compras / ventas
  return {
    ventas,
    compras,
    proporcion,
    minima,
    cumple: proporcion >= minima,
    faltante: Math.max(0, ventas * minima - compras),
  }
}

/** Lo que el usuario carga a mano en la pantalla de Monotributo y queda guardado con su negocio. */
export interface DatosMonotributo {
  actividad: ActividadMonotributo
  superficieM2?: number
  energiaKw?: number
  alquileres?: number
  /** Si se carga, reemplaza al total que sale de los comprobantes. */
  ingresosManual?: number
}

export const DATOS_MONOTRIBUTO_VACIOS: DatosMonotributo = { actividad: 'servicios' }

/** Los meses en los que hay que recategorizarse (1 = enero). */
export const MESES_RECATEGORIZACION = [2, 8]

/**
 * La próxima recategorización a partir de una fecha, como ISO (YYYY-MM-DD). Cae el día 20, que es
 * el vencimiento habitual del trámite.
 */
export function proximaRecategorizacion(desde: Date = new Date()): string {
  const anio = desde.getFullYear()
  for (const mes of MESES_RECATEGORIZACION) {
    const fecha = new Date(anio, mes - 1, 20)
    if (fecha > desde) return fecha.toISOString().slice(0, 10)
  }
  return new Date(anio + 1, MESES_RECATEGORIZACION[0] - 1, 20).toISOString().slice(0, 10)
}
