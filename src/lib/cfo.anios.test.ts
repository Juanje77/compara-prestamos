import { describe, expect, it } from 'vitest'
import { aniosConComprobantes, calcularTendenciaAnual, facturasDelAnio, type Factura } from './cfo'

function f(id: string, fecha: string, tipo: 'emitida' | 'recibida', monto: number): Factura {
  return { id, tipo, tipoComprobante: 'factura', contraparte: 'X', fecha, monto, iva: 0 } as Factura
}

const FACTURAS = [
  f('1', '2024-12-31', 'emitida', 100),
  f('2', '2025-01-01', 'emitida', 200),
  f('3', '2025-07-15', 'recibida', 50),
  f('4', '2025-12-31', 'emitida', 300),
  f('5', '2026-01-01', 'emitida', 400),
]

describe('aniosConComprobantes', () => {
  it('devuelve los años cargados, del más nuevo al más viejo', () => {
    expect(aniosConComprobantes(FACTURAS, new Date('2026-05-01'))).toEqual([2026, 2025, 2024])
  })

  it('incluye el año en curso aunque no haya nada cargado', () => {
    // Quien recién empieza tiene que poder pararse en este año; una lista sin él parece rota.
    expect(aniosConComprobantes([], new Date('2026-05-01'))).toEqual([2026])
  })

  it('no repite un año porque tenga muchos comprobantes', () => {
    expect(aniosConComprobantes(FACTURAS, new Date('2025-05-01'))).toEqual([2026, 2025, 2024])
  })
})

describe('facturasDelAnio', () => {
  it('toma el año calendario exacto, con los bordes adentro', () => {
    expect(facturasDelAnio(FACTURAS, 2025).map((x) => x.id)).toEqual(['2', '3', '4'])
  })

  it('deja afuera el 31 de diciembre anterior y el 1 de enero siguiente', () => {
    const ids = facturasDelAnio(FACTURAS, 2025).map((x) => x.id)
    expect(ids).not.toContain('1')
    expect(ids).not.toContain('5')
  })

  it('un año sin nada devuelve vacío, no todo', () => {
    expect(facturasDelAnio(FACTURAS, 2020)).toEqual([])
  })
})

describe('calcularTendenciaAnual', () => {
  const anual = calcularTendenciaAnual(FACTURAS, 2025)

  it('siempre son doce meses, de enero a diciembre', () => {
    expect(anual).toHaveLength(12)
    expect(anual[0].mes).toBe('2025-01')
    expect(anual[11].mes).toBe('2025-12')
  })

  it('los meses sin movimiento van en cero y no se saltean', () => {
    // Si se saltearan, dos años tendrían distinta cantidad de filas y no se podrían comparar.
    expect(anual[1]).toEqual({ mes: '2025-02', ventasNetas: 0, comprasNetas: 0, margenPct: 0 })
  })

  it('pone cada comprobante en su mes', () => {
    expect(anual[0].ventasNetas).toBe(200)
    expect(anual[6].comprasNetas).toBe(50)
    expect(anual[11].ventasNetas).toBe(300)
  })

  it('no se lleva nada de otro año', () => {
    const total = anual.reduce((t, r) => t + r.ventasNetas, 0)
    expect(total).toBe(500)
  })

  it('un año vacío igual devuelve los doce meses', () => {
    expect(calcularTendenciaAnual([], 2030)).toHaveLength(12)
  })
})
