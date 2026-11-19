import { describe, expect, it } from 'vitest'
import { armarLineaDeTiempoCheques } from './lineaDeTiempoCheques'
import type { Cheque, EstadoCheque, TipoCheque } from './cfo'

// Un lunes, para que las semanas arranquen en un borde conocido.
const LUNES = new Date('2026-11-16T10:00:00')

function cheque(p: { id: string; tipo: TipoCheque; monto: number; fechaCobro: string; estado?: EstadoCheque }): Cheque {
  return {
    banco: 'Nación',
    contraparte: 'Alguien',
    fechaEmision: '2026-11-01',
    estado: 'cartera',
    ...p,
  }
}

describe('armarLineaDeTiempoCheques', () => {
  it('reparte cada cheque en la semana de su fecha de cobro, separando los dos lados', () => {
    const l = armarLineaDeTiempoCheques(
      [
        cheque({ id: 'a', tipo: 'recibido', monto: 100, fechaCobro: '2026-11-18' }),
        cheque({ id: 'b', tipo: 'emitido', monto: 40, fechaCobro: '2026-11-20' }),
        cheque({ id: 'c', tipo: 'emitido', monto: 60, fechaCobro: '2026-11-25' }),
      ],
      0,
      13,
      LUNES,
    )
    expect(l.tramos[0].recibidos.total).toBe(100)
    expect(l.tramos[0].emitidos.total).toBe(40)
    expect(l.tramos[0].neto).toBe(60)
    expect(l.tramos[1].emitidos.total).toBe(60)
  })

  it('arrastra el saldo desde la caja de hoy', () => {
    const l = armarLineaDeTiempoCheques(
      [
        cheque({ id: 'a', tipo: 'emitido', monto: 300, fechaCobro: '2026-11-18' }),
        cheque({ id: 'b', tipo: 'emitido', monto: 300, fechaCobro: '2026-11-25' }),
      ],
      1000,
      13,
      LUNES,
    )
    expect(l.tramos[0].saldoAcumulado).toBe(700)
    expect(l.tramos[1].saldoAcumulado).toBe(400)
    // Una semana sin cheques no cambia el acumulado, pero lo sigue mostrando.
    expect(l.tramos[2].saldoAcumulado).toBe(400)
  })

  it('avisa en qué semana la caja se da vuelta', () => {
    const l = armarLineaDeTiempoCheques(
      [
        cheque({ id: 'a', tipo: 'emitido', monto: 600, fechaCobro: '2026-11-18' }),
        cheque({ id: 'b', tipo: 'emitido', monto: 600, fechaCobro: '2026-11-25' }),
      ],
      1000,
      13,
      LUNES,
    )
    // La primera semana todavía da positivo (400); recién la segunda queda en rojo.
    expect(l.primerTramoEnRojo).toBe(1)
    expect(l.tramos[1].saldoAcumulado).toBe(-200)
  })

  it('sin ningún tramo en rojo no inventa una alarma', () => {
    const l = armarLineaDeTiempoCheques(
      [cheque({ id: 'a', tipo: 'recibido', monto: 500, fechaCobro: '2026-11-18' })],
      0,
      13,
      LUNES,
    )
    expect(l.primerTramoEnRojo).toBe(null)
  })

  it('deja aparte los que ya vencieron y siguen en cartera', () => {
    const l = armarLineaDeTiempoCheques(
      [cheque({ id: 'a', tipo: 'emitido', monto: 100, fechaCobro: '2026-10-30' })],
      0,
      13,
      LUNES,
    )
    expect(l.vencidos.map((c) => c.id)).toEqual(['a'])
    expect(l.tramos[0].emitidos.total).toBe(0)
  })

  it('no esconde lo que cae más allá del horizonte', () => {
    const l = armarLineaDeTiempoCheques(
      [cheque({ id: 'a', tipo: 'recibido', monto: 100, fechaCobro: '2027-06-01' })],
      0,
      13,
      LUNES,
    )
    expect(l.masAdelante.map((c) => c.id)).toEqual(['a'])
  })

  it('ignora los que ya se hicieron efectivos: su plata ya está en la cuenta', () => {
    const l = armarLineaDeTiempoCheques(
      [
        cheque({ id: 'a', tipo: 'recibido', monto: 100, fechaCobro: '2026-11-18', estado: 'cobrado' }),
        cheque({ id: 'b', tipo: 'recibido', monto: 100, fechaCobro: '2026-11-18', estado: 'vendido' }),
        cheque({ id: 'c', tipo: 'emitido', monto: 100, fechaCobro: '2026-11-18', estado: 'rechazado' }),
      ],
      0,
      13,
      LUNES,
    )
    expect(l.tramos[0].recibidos.total).toBe(0)
    expect(l.hayCheques).toBe(false)
  })

  it('un domingo cae en la semana que arrancó el lunes anterior', () => {
    const l = armarLineaDeTiempoCheques(
      [cheque({ id: 'a', tipo: 'recibido', monto: 100, fechaCobro: '2026-11-22' })],
      0,
      13,
      LUNES,
    )
    expect(l.tramos[0].recibidos.total).toBe(100)
  })

  it('ordena los cheques de cada semana por fecha', () => {
    const l = armarLineaDeTiempoCheques(
      [
        cheque({ id: 'tarde', tipo: 'recibido', monto: 10, fechaCobro: '2026-11-20' }),
        cheque({ id: 'temprano', tipo: 'recibido', monto: 10, fechaCobro: '2026-11-17' }),
      ],
      0,
      13,
      LUNES,
    )
    expect(l.tramos[0].recibidos.cheques.map((c) => c.id)).toEqual(['temprano', 'tarde'])
  })
})

describe('cheques endosados', () => {
  it('un cheque entregado sale de la línea de tiempo: ya no es tuyo', () => {
    const l = armarLineaDeTiempoCheques(
      [cheque({ id: 'a', tipo: 'recibido', monto: 500, fechaCobro: '2026-11-18', estado: 'entregado' })],
      0,
      13,
      LUNES,
    )
    expect(l.tramos[0].recibidos.total).toBe(0)
    expect(l.hayCheques).toBe(false)
  })
})
