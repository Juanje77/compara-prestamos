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
  saldo: number
}

export interface AgrupacionSemanal {
  semanas: RangoSemana[]
  totalesPorSemana: TotalesSemana[]
  vencidos: Movimiento[]
  aFuturo: Movimiento[]
}

/** Agrupa movimientos en las próximas N semanas según su fecha; lo que cae antes/después queda aparte. */
export function agruparPorSemana(movimientos: Movimiento[], cantidadSemanas = 4, hoy: Date = new Date()): AgrupacionSemanal {
  const semanas = obtenerProximasSemanas(cantidadSemanas, hoy)
  const totalesPorSemana: TotalesSemana[] = semanas.map(() => ({ cobros: 0, pagos: 0, saldo: 0 }))
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

  return { semanas, totalesPorSemana, vencidos, aFuturo }
}
