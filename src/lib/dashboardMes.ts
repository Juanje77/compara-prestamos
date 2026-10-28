// El mes en curso contra el anterior, para el Dashboard.
//
// Un número solo no dice nada: "margen 22%" se lee distinto si veníamos de 18 que si veníamos de
// 30. Acá se arma el par —este mes y el anterior— y la variación entre los dos, que es lo que
// convierte cinco números sueltos en cinco tendencias.
//
// Todo sale de lo que ya está cargado: comprobantes para lo facturado, pagos para lo que
// efectivamente se movió. No hay ningún dato nuevo que el usuario tenga que cargar.

import { montoConSigno, type Factura, type Pago } from './cfo'

export interface ResumenMes {
  /** YYYY-MM */
  mes: string
  /** Ventas netas facturadas en el mes (las notas de crédito restan). */
  facturado: number
  /** Compras netas del mes. */
  comprado: number
  /** Lo que entró: pagos recibidos de facturas emitidas. */
  cobrado: number
  /** Lo que salió: pagos hechos sobre facturas recibidas. */
  pagado: number
  /** facturado - comprado. */
  margen: number
  /** El margen como porcentaje de lo facturado. 0 si no se facturó nada: un porcentaje sobre
   * cero no existe, y mostrar 100% o -100% sería inventar una tendencia. */
  margenPct: number
}

/** El mes de una fecha ISO (YYYY-MM-DD → YYYY-MM). */
export function mesDe(fechaISO: string): string {
  return fechaISO.slice(0, 7)
}

/** El mes anterior a uno dado, cruzando el año cuando corresponde. */
export function mesAnterior(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  return m === 1 ? `${anio - 1}-12` : `${anio}-${String(m - 1).padStart(2, '0')}`
}

/**
 * Lo que pasó en un mes.
 *
 * Facturado y cobrado son cosas distintas y por eso van separados: se puede tener un mes
 * excelente de ventas y no haber visto un peso. Es, de hecho, la diferencia que más problemas de
 * caja explica.
 *
 * Los comprobantes internos quedan afuera de lo facturado —no son comprobantes fiscales, mismo
 * criterio que IVA, Ingresos Brutos y Monotributo—, pero sus pagos sí cuentan en lo cobrado:
 * la plata entró igual, tenga o no respaldo fiscal.
 */
export function resumenDelMes(facturas: Factura[], pagos: Pago[], mes: string): ResumenMes {
  let facturado = 0
  let comprado = 0
  const tipoPorFactura = new Map<string, Factura>()

  for (const f of facturas) {
    tipoPorFactura.set(f.id, f)
    if (mesDe(f.fecha) !== mes || f.esInterna) continue
    if (f.tipo === 'emitida') facturado += montoConSigno(f)
    else comprado += montoConSigno(f)
  }

  let cobrado = 0
  let pagado = 0
  for (const p of pagos) {
    if (mesDe(p.fecha) !== mes) continue
    const factura = tipoPorFactura.get(p.facturaId)
    // Un pago sin su factura no se cuenta: no se sabe si entró o salió, y adivinarlo sería
    // sumarlo del lado equivocado.
    if (!factura) continue
    if (factura.tipo === 'emitida') cobrado += p.monto
    else pagado += p.monto
  }

  const margen = facturado - comprado
  return {
    mes,
    facturado,
    comprado,
    cobrado,
    pagado,
    margen,
    margenPct: facturado > 0 ? (margen / facturado) * 100 : 0,
  }
}

export interface Variacion {
  /** La diferencia en valor absoluto, con signo. */
  diferencia: number
  /** El cambio porcentual, o null cuando no se puede calcular. */
  porcentaje: number | null
  /** 'sube' | 'baja' | 'igual'. Separado del signo porque quien lo muestra decide si subir es
   * bueno (ventas) o malo (deuda) — eso no lo sabe este archivo. */
  direccion: 'sube' | 'baja' | 'igual'
}

/**
 * Cuánto cambió un número respecto del anterior.
 *
 * El porcentaje es null cuando el valor anterior es cero: pasar de 0 a 100 no es "100% más" ni
 * "infinito por ciento", es simplemente que antes no había nada. Mostrar un número ahí sería
 * inventar una magnitud. Quien lo dibuja muestra "nuevo" en su lugar.
 *
 * También es null cuando el anterior es negativo: el porcentaje de cambio sobre una base negativa
 * da un signo al revés del sentido real —pasar de -100 a -50 da -50%, y en realidad mejoró—, y un
 * número que se lee al revés es peor que ninguno.
 */
export function variacion(actual: number, anterior: number): Variacion {
  const diferencia = actual - anterior
  const direccion = diferencia > 0 ? 'sube' : diferencia < 0 ? 'baja' : 'igual'
  if (anterior <= 0) return { diferencia, porcentaje: null, direccion }
  return { diferencia, porcentaje: (diferencia / anterior) * 100, direccion }
}
