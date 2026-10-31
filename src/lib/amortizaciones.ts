// Amortización de los bienes de uso, lineal y por meses.
//
// Lineal porque es lo que usa cualquier PyME y lo que acepta la práctica impositiva: el valor se
// reparte en partes iguales a lo largo de la vida útil. Por meses y no por años porque un bien
// comprado en septiembre no amortiza el ejercicio entero — la regla del año completo de alta es
// una convención impositiva que no todos aplican, así que acá se cuenta lo que realmente pasó.
//
// Lo que no tiene fecha de alta o vida útil cargada NO amortiza. Es a propósito: inventar una
// vida útil por el tipo de bien daría un número que el contador no puso y que después aparece en
// un estado de resultados como si fuera suyo.

import type { Bien } from './cfo'

export interface AmortizacionBien {
  bien: Bien
  /** Cuota anual completa: valor / vida útil. */
  cuotaAnual: number
  /** Meses del período en los que el bien estuvo de alta. */
  mesesEnElPeriodo: number
  /** Lo que le toca al período. */
  delPeriodo: number
  /** Acumulada desde el alta hasta el final del período, topeada al valor del bien. */
  acumulada: number
  /** Valor residual al final del período. */
  residual: number
}

function mesesEntre(desde: Date, hasta: Date): number {
  if (hasta <= desde) return 0
  return (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth())
}

/**
 * La amortización de un bien en un año calendario.
 *
 * Un bien dado de alta a mitad de año amortiza solo los meses que estuvo; uno que ya terminó su
 * vida útil no amortiza más, y su residual queda en cero en vez de irse a negativo.
 */
export function amortizarBien(bien: Bien, anio: number): AmortizacionBien | null {
  if (!bien.fechaAlta || !bien.vidaUtilAnios || bien.vidaUtilAnios <= 0) return null

  const alta = new Date(`${bien.fechaAlta}T00:00:00`)
  if (Number.isNaN(alta.getTime())) return null

  const inicioEjercicio = new Date(anio, 0, 1)
  const finEjercicio = new Date(anio + 1, 0, 1)
  const cuotaAnual = bien.valorEstimado / bien.vidaUtilAnios
  const cuotaMensual = cuotaAnual / 12
  const vidaEnMeses = bien.vidaUtilAnios * 12

  // Los meses amortizables que caen dentro del ejercicio: desde el alta (o el 1 de enero, lo que
  // sea más tarde) hasta el fin del ejercicio o el fin de la vida útil, lo que llegue primero.
  const finVidaUtil = new Date(alta)
  finVidaUtil.setMonth(finVidaUtil.getMonth() + vidaEnMeses)
  const desde = alta > inicioEjercicio ? alta : inicioEjercicio
  const hasta = finVidaUtil < finEjercicio ? finVidaUtil : finEjercicio
  const mesesEnElPeriodo = Math.max(0, mesesEntre(desde, hasta))

  const delPeriodo = Math.min(cuotaMensual * mesesEnElPeriodo, bien.valorEstimado)
  const mesesDesdeElAlta = Math.min(Math.max(0, mesesEntre(alta, hasta)), vidaEnMeses)
  const acumulada = Math.min(cuotaMensual * mesesDesdeElAlta, bien.valorEstimado)

  return {
    bien,
    cuotaAnual,
    mesesEnElPeriodo,
    delPeriodo,
    acumulada,
    residual: Math.max(0, bien.valorEstimado - acumulada),
  }
}

export interface ResumenAmortizaciones {
  detalle: AmortizacionBien[]
  totalDelPeriodo: number
  /** Bienes sin fecha de alta o sin vida útil, que por eso no amortizan. Se cuentan para poder
   * avisarlo: un estado de resultados sin amortizaciones porque faltan datos no es lo mismo que
   * uno sin amortizaciones porque no hay bienes. */
  sinDatos: Bien[]
}

export function amortizacionesDelAnio(bienes: Bien[], anio: number): ResumenAmortizaciones {
  const detalle: AmortizacionBien[] = []
  const sinDatos: Bien[] = []

  for (const b of bienes) {
    const a = amortizarBien(b, anio)
    if (a) detalle.push(a)
    else sinDatos.push(b)
  }

  return {
    detalle,
    totalDelPeriodo: detalle.reduce((s, a) => s + a.delPeriodo, 0),
    sinDatos,
  }
}
