import { describe, expect, it } from 'vitest'
import {
  PREFIJO_CHEQUE,
  PREFIJO_FACTURA,
  PREFIJO_SUELDO,
  calcularPosicionFinanciera,
  origenDeMovimiento,
} from './posicionFinanciera'
import type { Movimiento } from './movimientosSemana'
import { agruparPorSemana } from './semanas'

function mov(id: string, tipo: 'cobro' | 'pago', monto: number, cumplido = false): Movimiento {
  return { id, tipo, concepto: 'x', monto, fecha: '2026-10-12', cumplido }
}

describe('origenDeMovimiento', () => {
  it('reconoce de dónde viene cada movimiento', () => {
    expect(origenDeMovimiento(`${PREFIJO_FACTURA}f1`)).toBe('factura')
    expect(origenDeMovimiento(`${PREFIJO_CHEQUE}c1`)).toBe('cheque')
    expect(origenDeMovimiento(`${PREFIJO_SUELDO}2026-10:netos`)).toBe('sueldo')
  })

  it('lo cargado a mano no lleva prefijo', () => {
    expect(origenDeMovimiento('1760000000-ab12cd')).toBe('manual')
  })
})

describe('calcularPosicionFinanciera', () => {
  const movimientos = [
    mov(`${PREFIJO_CHEQUE}c1`, 'cobro', 300000),
    mov(`${PREFIJO_FACTURA}f1`, 'cobro', 500000),
    mov('manual-1', 'cobro', 50000),
    mov(`${PREFIJO_FACTURA}f2`, 'pago', 200000),
    mov(`${PREFIJO_CHEQUE}c2`, 'pago', 100000),
    mov(`${PREFIJO_SUELDO}2026-10:netos`, 'pago', 400000),
    mov('manual-2', 'pago', 25000),
  ]

  it('desglosa lo que falta cobrar por su origen', () => {
    const p = calcularPosicionFinanciera(1000000, movimientos)
    expect(p.aCobrar).toMatchObject({ cheques: 300000, facturas: 500000, sueldos: 0, otros: 50000, total: 850000 })
  })

  it('desglosa lo que falta pagar, con los sueldos aparte', () => {
    const p = calcularPosicionFinanciera(1000000, movimientos)
    expect(p.aPagar).toMatchObject({ cheques: 100000, facturas: 200000, sueldos: 400000, otros: 25000, total: 725000 })
  })

  it('el disponible proyectado es la caja más todo lo que falta cobrar', () => {
    expect(calcularPosicionFinanciera(1000000, movimientos).disponibleProyectado).toBe(1850000)
  })

  it('la posición neta le resta todo lo que falta pagar', () => {
    expect(calcularPosicionFinanciera(1000000, movimientos).posicionNeta).toBe(1125000)
  })

  it('lo ya cobrado o pagado no se proyecta: esa plata ya se movió', () => {
    const conCumplidos = [...movimientos, mov(`${PREFIJO_FACTURA}f9`, 'cobro', 9999999, true)]
    expect(calcularPosicionFinanciera(0, conCumplidos).aCobrar.total).toBe(850000)
  })

  it('sin Tesorería la caja es cero y la posición sigue teniendo sentido', () => {
    const p = calcularPosicionFinanciera(0, movimientos)
    expect(p.disponibleProyectado).toBe(850000)
    expect(p.posicionNeta).toBe(125000)
  })

  it('la posición neta puede dar negativa, que es justo lo que hay que ver venir', () => {
    const p = calcularPosicionFinanciera(0, [mov('m1', 'cobro', 100), mov('m2', 'pago', 500)])
    expect(p.posicionNeta).toBe(-400)
  })

  it('sin nada cargado, todo en cero', () => {
    const p = calcularPosicionFinanciera(0, [])
    expect(p.posicionNeta).toBe(0)
    expect(p.aCobrar.total).toBe(0)
    expect(p.aPagar.total).toBe(0)
  })

  it('el total de cada lado es la suma de su desglose', () => {
    const p = calcularPosicionFinanciera(1000000, movimientos)
    for (const lado of [p.aCobrar, p.aPagar]) {
      expect(lado.cheques + lado.facturas + lado.sueldos + lado.otros).toBe(lado.total)
    }
  })
})

// ---------------------------------------------------------------------------
// Que los dos números de la pantalla cierren entre sí
// ---------------------------------------------------------------------------
//
// En Cobranzas y pagos conviven la posición financiera ("te queda") y la caja proyectada de cada
// semana. Son la misma cuenta mirada de dos formas, así que tienen que dar lo mismo cuando no hay
// nada fuera de la ventana de semanas. Si alguien cambia una de las dos, este test lo avisa.

describe('la caja proyectada de la última semana coincide con la posición', () => {
  const HOY = new Date(2026, 9, 12)
  const CAJA = 1000000

  function enSemana(dias: number): string {
    const d = new Date(HOY)
    d.setDate(d.getDate() + dias)
    return d.toISOString().slice(0, 10)
  }

  it('con todo dentro de las cuatro semanas, los dos números son el mismo', () => {
    const movimientos = [
      { ...mov(`${PREFIJO_CHEQUE}c1`, 'cobro', 300000), fecha: enSemana(1) },
      { ...mov(`${PREFIJO_FACTURA}f1`, 'cobro', 500000), fecha: enSemana(9) },
      { ...mov(`${PREFIJO_SUELDO}2026-10:netos`, 'pago', 400000), fecha: enSemana(16) },
      { ...mov('manual-1', 'pago', 25000), fecha: enSemana(20) },
    ]
    const posicion = calcularPosicionFinanciera(CAJA, movimientos)
    const { totalesPorSemana } = agruparPorSemana(movimientos, 4, HOY, CAJA)
    expect(totalesPorSemana[3].saldoAcumulado).toBe(posicion.posicionNeta)
  })

  it('lo vencido sin cobrar entra en los dos lados por igual', () => {
    const movimientos = [
      { ...mov('vencido-1', 'cobro', 150000), fecha: '2026-09-01' },
      { ...mov('manual-1', 'pago', 50000), fecha: enSemana(2) },
    ]
    const posicion = calcularPosicionFinanciera(CAJA, movimientos)
    const vencidoPendiente = 150000
    const { totalesPorSemana } = agruparPorSemana(movimientos, 4, HOY, CAJA + vencidoPendiente)
    expect(totalesPorSemana[3].saldoAcumulado).toBe(posicion.posicionNeta)
  })
})

describe('el detalle de cada renglón', () => {
  const p = calcularPosicionFinanciera(1000000, [
    mov(`${PREFIJO_CHEQUE}c1`, 'cobro', 300000),
    mov(`${PREFIJO_CHEQUE}c3`, 'cobro', 120000),
    mov(`${PREFIJO_FACTURA}f1`, 'cobro', 500000),
    mov('manual-1', 'cobro', 50000),
    mov(`${PREFIJO_SUELDO}2026-10:netos`, 'pago', 400000),
    mov(`${PREFIJO_FACTURA}f9`, 'pago', 90000, true),
  ])

  it('guarda los movimientos que componen cada número', () => {
    // Sin esto, un total que no cierra no hay forma de revisarlo.
    const sumaCheques = p.aCobrar.detalle.cheque.reduce((s, m) => s + m.monto, 0)
    expect(sumaCheques).toBe(p.aCobrar.cheques)
  })

  it('cada movimiento pendiente aparece en un solo renglón', () => {
    const todos = [...Object.values(p.aCobrar.detalle), ...Object.values(p.aPagar.detalle)].flat()
    expect(new Set(todos.map((m) => m.id)).size).toBe(todos.length)
  })

  it('lo ya cumplido no aparece en ningún detalle', () => {
    const todos = [...Object.values(p.aCobrar.detalle), ...Object.values(p.aPagar.detalle)].flat()
    expect(todos.every((m) => !m.cumplido)).toBe(true)
  })
})
