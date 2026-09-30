import { describe, expect, it } from 'vitest'
import { agruparPorSemana, indiceDeSemana, obtenerProximasSemanas } from './semanas'
import type { Movimiento } from './movimientosSemana'

// Un miércoles, para que la semana en curso tenga días antes y después de "hoy".
const HOY = new Date(2026, 8, 30)

function mov(tipo: 'cobro' | 'pago', monto: number, fecha: string): Movimiento {
  return { id: `${tipo}-${fecha}-${monto}`, tipo, concepto: 'x', monto, fecha, cumplido: false }
}

describe('obtenerProximasSemanas', () => {
  it('arranca el lunes de la semana en curso', () => {
    const [primera] = obtenerProximasSemanas(4, HOY)
    expect(primera.inicio.getDay()).toBe(1)
    expect(primera.inicio.getDate()).toBe(28)
  })

  it('cada semana termina el domingo', () => {
    for (const s of obtenerProximasSemanas(4, HOY)) expect(s.fin.getDay()).toBe(0)
  })

  it('un domingo pertenece a la semana que arrancó el lunes anterior', () => {
    const [primera] = obtenerProximasSemanas(1, new Date(2026, 9, 4))
    expect(primera.inicio.getDate()).toBe(28)
  })
})

describe('indiceDeSemana', () => {
  const semanas = obtenerProximasSemanas(4, HOY)

  it('ubica una fecha en su semana', () => {
    expect(indiceDeSemana('2026-09-30', semanas)).toBe(0)
    expect(indiceDeSemana('2026-10-06', semanas)).toBe(1)
  })

  it('devuelve null para lo que cae fuera del rango', () => {
    expect(indiceDeSemana('2026-09-20', semanas)).toBeNull()
    expect(indiceDeSemana('2026-12-01', semanas)).toBeNull()
  })
})

describe('agruparPorSemana', () => {
  it('suma cobros y pagos en la semana que corresponde', () => {
    const { totalesPorSemana } = agruparPorSemana(
      [mov('cobro', 100, '2026-09-30'), mov('pago', 40, '2026-10-01'), mov('cobro', 25, '2026-10-07')],
      4,
      HOY,
    )
    expect(totalesPorSemana[0]).toMatchObject({ cobros: 100, pagos: 40, saldo: 60 })
    expect(totalesPorSemana[1]).toMatchObject({ cobros: 25, pagos: 0, saldo: 25 })
  })

  it('el acumulado arrastra lo de las semanas anteriores', () => {
    const { totalesPorSemana } = agruparPorSemana(
      [mov('cobro', 100, '2026-09-30'), mov('pago', 30, '2026-10-06'), mov('pago', 50, '2026-10-13')],
      4,
      HOY,
    )
    expect(totalesPorSemana.map((t) => t.saldo)).toEqual([100, -30, -50, 0])
    expect(totalesPorSemana.map((t) => t.saldoAcumulado)).toEqual([100, 70, 20, 20])
  })

  it('una semana buena puede seguir dejando el acumulado en rojo', () => {
    const { totalesPorSemana } = agruparPorSemana(
      [mov('pago', 500, '2026-09-30'), mov('cobro', 100, '2026-10-06')],
      4,
      HOY,
    )
    expect(totalesPorSemana[1].saldo).toBe(100)
    expect(totalesPorSemana[1].saldoAcumulado).toBe(-400)
  })

  it('el saldo inicial entra en el acumulado desde la primera semana', () => {
    const { totalesPorSemana, saldoInicial } = agruparPorSemana([mov('cobro', 100, '2026-09-30')], 4, HOY, -250)
    expect(saldoInicial).toBe(-250)
    expect(totalesPorSemana[0].saldoAcumulado).toBe(-150)
    expect(totalesPorSemana[3].saldoAcumulado).toBe(-150)
  })

  it('sin movimientos, el acumulado es el saldo inicial en todas las semanas', () => {
    const { totalesPorSemana } = agruparPorSemana([], 4, HOY, -80)
    expect(totalesPorSemana.map((t) => t.saldoAcumulado)).toEqual([-80, -80, -80, -80])
  })

  it('no depende del orden en que vengan los movimientos', () => {
    const movimientos = [mov('pago', 30, '2026-10-06'), mov('cobro', 100, '2026-09-30'), mov('pago', 50, '2026-10-13')]
    const derecho = agruparPorSemana(movimientos, 4, HOY).totalesPorSemana.map((t) => t.saldoAcumulado)
    const alReves = agruparPorSemana([...movimientos].reverse(), 4, HOY).totalesPorSemana.map((t) => t.saldoAcumulado)
    expect(derecho).toEqual(alReves)
  })

  it('lo vencido y lo lejano quedan aparte, sin ensuciar las semanas', () => {
    const r = agruparPorSemana([mov('cobro', 100, '2026-09-01'), mov('pago', 70, '2026-12-01')], 4, HOY)
    expect(r.vencidos).toHaveLength(1)
    expect(r.aFuturo).toHaveLength(1)
    expect(r.totalesPorSemana.every((t) => t.saldo === 0)).toBe(true)
  })

  it('el acumulado de la última semana es el total del período', () => {
    const movimientos = [mov('cobro', 100, '2026-09-30'), mov('pago', 30, '2026-10-06'), mov('cobro', 10, '2026-10-20')]
    const r = agruparPorSemana(movimientos, 4, HOY, 5)
    const suma = r.totalesPorSemana.reduce((s, t) => s + t.saldo, 0) + r.saldoInicial
    expect(r.totalesPorSemana[3].saldoAcumulado).toBe(suma)
  })
})
