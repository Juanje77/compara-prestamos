import type { Movimiento } from './movimientosSemana'

export interface RangoSemana {
  inicio: Date
  fin: Date
  label: string
  labelCorto: string
}

const FORMATO_CORTO: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }

function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

/** Las próximas N semanas (lunes a domingo), empezando por la semana actual. */
export function obtenerProximasSemanas(cantidad = 4, hoy: Date = new Date()): RangoSemana[] {
  const primeraSemana = inicioDeSemana(hoy)
  const semanas: RangoSemana[] = []

  for (let i = 0; i < cantidad; i++) {
    const inicio = new Date(primeraSemana)
    inicio.setDate(inicio.getDate() + i * 7)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + 6)

    semanas.push({
      inicio,
      fin,
      label: `Semana ${i + 1} (${inicio.toLocaleDateString('es-AR', FORMATO_CORTO)} al ${fin.toLocaleDateString('es-AR', FORMATO_CORTO)})`,
      labelCorto: `Sem. ${i + 1}`,
    })
  }

  return semanas
}

function aFecha(fechaISO: string): Date {
  const f = new Date(`${fechaISO}T00:00:00`)
  f.setHours(0, 0, 0, 0)
  return f
}

/** Índice de la semana (0-based) a la que pertenece la fecha, o null si cae fuera del rango de semanas. */
export function indiceDeSemana(fechaISO: string, semanas: RangoSemana[]): number | null {
  const fecha = aFecha(fechaISO)
  const idx = semanas.findIndex((s) => fecha >= s.inicio && fecha <= s.fin)
  return idx === -1 ? null : idx
}

export interface TotalesSemana {
  cobros: number
  pagos: number
  /** Lo que deja la semana por sí sola: cobros menos pagos. */
  saldo: number
  /** El saldo de esta semana más el de todas las anteriores, incluido lo que venía de arrastre.
   * Es el número que dice cómo termina la caja al final de esta semana, que es distinto de cómo
   * le fue a la semana: una semana buena puede seguir dejando un acumulado en rojo. */
  saldoAcumulado: number
}

export interface AgrupacionSemanal {
  semanas: RangoSemana[]
  totalesPorSemana: TotalesSemana[]
  vencidos: Movimiento[]
  aFuturo: Movimiento[]
  /** El saldo con el que arrancó el acumulado, para poder mostrarlo en pantalla. */
  saldoInicial: number
}

/**
 * Agrupa movimientos en las próximas N semanas según su fecha; lo que cae antes/después queda
 * aparte.
 *
 * Cada semana trae dos números distintos y los dos importan: el saldo propio (cómo le fue a esa
 * semana) y el acumulado, que arrastra lo que viene de antes. Mirar solo el saldo propio engaña:
 * cuatro semanas apenas negativas se ven inofensivas una por una, y juntas son el mes en que no
 * se llega a fin de mes.
 */
export function agruparPorSemana(
  movimientos: Movimiento[],
  cantidadSemanas = 4,
  hoy: Date = new Date(),
  /** Con qué saldo arranca el acumulado — típicamente lo vencido que todavía no se movió. */
  saldoInicial = 0,
): AgrupacionSemanal {
  const semanas = obtenerProximasSemanas(cantidadSemanas, hoy)
  const totalesPorSemana: TotalesSemana[] = semanas.map(() => ({ cobros: 0, pagos: 0, saldo: 0, saldoAcumulado: 0 }))
  const vencidos: Movimiento[] = []
  const aFuturo: Movimiento[] = []

  for (const m of movimientos) {
    const idx = indiceDeSemana(m.fecha, semanas)
    if (idx === null) {
      if (aFecha(m.fecha) < semanas[0].inicio) vencidos.push(m)
      else aFuturo.push(m)
      continue
    }
    if (m.tipo === 'cobro') totalesPorSemana[idx].cobros += m.monto
    else totalesPorSemana[idx].pagos += m.monto
    totalesPorSemana[idx].saldo = totalesPorSemana[idx].cobros - totalesPorSemana[idx].pagos
  }

  // El acumulado se calcula al final, de una pasada: si se fuera sumando dentro del bucle de
  // arriba, dependería del orden en que vienen los movimientos.
  let acumulado = saldoInicial
  for (const t of totalesPorSemana) {
    acumulado += t.saldo
    t.saldoAcumulado = acumulado
  }

  return { semanas, totalesPorSemana, vencidos, aFuturo, saldoInicial }
}
