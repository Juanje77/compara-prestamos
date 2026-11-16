// La chequera puesta sobre una línea de tiempo: cuándo cae cada cheque y con cuánta caja quedás
// después de cada semana.
//
// La lista de cheques contesta "qué cheques tengo". No contesta la pregunta que de verdad
// preocupa, que es "¿llego a cubrir los de la semana que viene?". Para eso hace falta verlos
// repartidos en el tiempo, separados por lado —los que cobrás arriba, los que pagás abajo— y con
// el saldo arrastrado: una semana apenas negativa no asusta, y cuatro seguidas son el mes en que
// no se llega.
//
// Solo entran los cheques en cartera. Un cheque cobrado, vendido o rechazado ya no va a caer: la
// plata del cobrado ya está en la cuenta (y contarla de nuevo sería sumarla dos veces), la del
// vendido entró cuando se descontó, y el rechazado directamente no entra.

import type { Cheque } from './cfo'
import { indiceDeSemana, obtenerProximasSemanas, type RangoSemana } from './semanas'

export interface LadoSemana {
  total: number
  cheques: Cheque[]
}

export interface TramoCheques {
  semana: RangoSemana
  /** Los que cobrás: cheques recibidos todavía en cartera. */
  recibidos: LadoSemana
  /** Los que pagás: cheques emitidos todavía en cartera. */
  emitidos: LadoSemana
  /** Lo que deja la semana por sí sola. */
  neto: number
  /** Cómo queda la caja al final de esta semana, arrastrando las anteriores. */
  saldoAcumulado: number
}

export interface LineaDeTiempoCheques {
  tramos: TramoCheques[]
  /** En cartera con fecha ya pasada: o no se depositaron, o nadie actualizó el estado. En los dos
   * casos hay que mirarlos, así que van aparte y no escondidos en la primera semana. */
  vencidos: Cheque[]
  /** Más allá del horizonte. No se detallan, pero se avisa que existen: un cheque a cinco meses
   * no deja de ser plata comprometida por no entrar en la pantalla. */
  masAdelante: Cheque[]
  saldoInicial: number
  /** El primer tramo donde el acumulado queda en rojo, o null. Es el aviso que importa. */
  primerTramoEnRojo: number | null
  hayCheques: boolean
}

/** Solo lo que todavía puede caer. Ver el comentario de arriba. */
export function chequesPendientes(cheques: Cheque[]): Cheque[] {
  return cheques.filter((c) => c.estado === 'cartera')
}

export function armarLineaDeTiempoCheques(
  cheques: Cheque[],
  saldoInicial = 0,
  cantidadSemanas = 13,
  hoy: Date = new Date(),
): LineaDeTiempoCheques {
  const semanas = obtenerProximasSemanas(cantidadSemanas, hoy)
  const tramos: TramoCheques[] = semanas.map((semana) => ({
    semana,
    recibidos: { total: 0, cheques: [] },
    emitidos: { total: 0, cheques: [] },
    neto: 0,
    saldoAcumulado: 0,
  }))
  const vencidos: Cheque[] = []
  const masAdelante: Cheque[] = []

  const pendientes = chequesPendientes(cheques)
  for (const cheque of pendientes) {
    const idx = indiceDeSemana(cheque.fechaCobro, semanas)
    if (idx === null) {
      const fecha = new Date(`${cheque.fechaCobro}T00:00:00`)
      if (fecha < semanas[0].inicio) vencidos.push(cheque)
      else masAdelante.push(cheque)
      continue
    }
    const lado = cheque.tipo === 'recibido' ? tramos[idx].recibidos : tramos[idx].emitidos
    lado.total += cheque.monto
    lado.cheques.push(cheque)
  }

  // El acumulado va en una pasada aparte, para no depender del orden en que vengan los cheques.
  let acumulado = saldoInicial
  let primerTramoEnRojo: number | null = null
  tramos.forEach((t, i) => {
    t.recibidos.cheques.sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))
    t.emitidos.cheques.sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))
    t.neto = t.recibidos.total - t.emitidos.total
    acumulado += t.neto
    t.saldoAcumulado = acumulado
    if (acumulado < 0 && primerTramoEnRojo === null) primerTramoEnRojo = i
  })

  vencidos.sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))
  masAdelante.sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))

  return {
    tramos,
    vencidos,
    masAdelante,
    saldoInicial,
    primerTramoEnRojo,
    hayCheques: pendientes.length > 0,
  }
}
