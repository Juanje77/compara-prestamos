import { describe, expect, it } from 'vitest'
import {
  PRECIO_UNITARIO_MAXIMO,
  TABLA_MONOTRIBUTO,
  cuotaMensual,
  encuadrar,
  proximaRecategorizacion,
} from './monotributo'

/**
 * Los totales tal como los publica ARCA. Acá no se recalculan: están copiados de la tabla oficial
 * para que, si al actualizarla se tipea mal un componente, el test lo cante en vez de dejar pasar
 * una cuota equivocada.
 */
const TOTALES_PUBLICADOS: Record<string, { servicios: number; muebles: number }> = {
  A: { servicios: 49527.18, muebles: 49527.18 },
  B: { servicios: 56379.08, muebles: 56379.08 },
  C: { servicios: 66020.12, muebles: 64530.58 },
  D: { servicios: 84612.93, muebles: 82564.81 },
  E: { servicios: 119811.45, muebles: 108267.51 },
  F: { servicios: 150784.21, muebles: 129930.65 },
  G: { servicios: 230312.94, muebles: 158815.05 },
  H: { servicios: 522706.68, muebles: 317895.01 },
  I: { servicios: 963747.86, muebles: 474992.78 },
  J: { servicios: 1167299.76, muebles: 580793.69 },
  K: { servicios: 1614446.04, muebles: 702103.24 },
}

describe('tabla del monotributo', () => {
  it('tiene las once categorías, de la A a la K', () => {
    expect(TABLA_MONOTRIBUTO.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'])
  })

  it('cada cuota calculada coincide con el total que publica ARCA', () => {
    for (const categoria of TABLA_MONOTRIBUTO) {
      const esperado = TOTALES_PUBLICADOS[categoria.id]
      expect(cuotaMensual(categoria, 'servicios')).toBeCloseTo(esperado.servicios, 2)
      expect(cuotaMensual(categoria, 'muebles')).toBeCloseTo(esperado.muebles, 2)
    }
  })

  it('los topes suben a medida que sube la categoría', () => {
    for (let i = 1; i < TABLA_MONOTRIBUTO.length; i++) {
      expect(TABLA_MONOTRIBUTO[i].ingresosBrutos).toBeGreaterThan(TABLA_MONOTRIBUTO[i - 1].ingresosBrutos)
      expect(TABLA_MONOTRIBUTO[i].superficieM2).toBeGreaterThanOrEqual(TABLA_MONOTRIBUTO[i - 1].superficieM2)
      expect(TABLA_MONOTRIBUTO[i].alquileres).toBeGreaterThanOrEqual(TABLA_MONOTRIBUTO[i - 1].alquileres)
    }
  })

  it('servicios nunca paga menos que venta de cosas muebles', () => {
    for (const c of TABLA_MONOTRIBUTO) {
      expect(cuotaMensual(c, 'servicios')).toBeGreaterThanOrEqual(cuotaMensual(c, 'muebles'))
    }
  })
})

describe('encuadrar', () => {
  it('con facturación chica cae en la primera categoría', () => {
    const r = encuadrar({ ingresosBrutos: 5_000_000 })
    expect(r.categoria?.id).toBe('A')
    expect(r.excedido).toBe(false)
  })

  it('justo en el tope todavía entra en esa categoría', () => {
    expect(encuadrar({ ingresosBrutos: 12009410.45 }).categoria?.id).toBe('A')
    expect(encuadrar({ ingresosBrutos: 12009410.46 }).categoria?.id).toBe('B')
  })

  it('manda el parámetro más exigente, no la facturación', () => {
    // Factura como para la A, pero paga un alquiler que solo entra a partir de la C.
    const r = encuadrar({ ingresosBrutos: 5_000_000, alquileres: 3_000_000 })
    expect(r.categoria?.id).toBe('C')
    expect(r.determinantes).toEqual(['alquileres'])
  })

  it('avisa cuando hay más de un parámetro empujando a la misma categoría', () => {
    // 20M de ingresos entra recién en C, y 55 m² también: los dos la determinan por igual.
    const r = encuadrar({ ingresosBrutos: 20_000_000, superficieM2: 55 })
    expect(r.categoria?.id).toBe('C')
    expect(r.determinantes).toEqual(['ingresosBrutos', 'superficieM2'])
  })

  it('lo que no se carga no categoriza', () => {
    expect(encuadrar({ ingresosBrutos: 5_000_000, superficieM2: undefined }).categoria?.id).toBe('A')
  })

  it('pasarse de la última categoría deja afuera del régimen', () => {
    const r = encuadrar({ ingresosBrutos: 130_000_000 })
    expect(r.excedido).toBe(true)
    expect(r.categoria).toBeNull()
  })

  it('también deja afuera si el que se pasa es otro parámetro', () => {
    expect(encuadrar({ ingresosBrutos: 5_000_000, energiaKw: 25_000 }).excedido).toBe(true)
  })

  it('dice cuánto falta para el próximo escalón', () => {
    const r = encuadrar({ ingresosBrutos: 12_000_000 })
    expect(r.margenHastaElSiguiente).toBeCloseTo(9410.45, 2)
  })

  it('en la última categoría no hay próximo escalón', () => {
    expect(encuadrar({ ingresosBrutos: 126_000_000 }).margenHastaElSiguiente).toBeNull()
  })
})

describe('proximaRecategorizacion', () => {
  it('desde enero, la siguiente es la de febrero', () => {
    expect(proximaRecategorizacion(new Date(2026, 0, 10))).toBe('2026-02-20')
  })

  it('desde marzo, la siguiente es la de agosto', () => {
    expect(proximaRecategorizacion(new Date(2026, 2, 1))).toBe('2026-08-20')
  })

  it('pasada la de agosto, salta a febrero del año que viene', () => {
    expect(proximaRecategorizacion(new Date(2026, 8, 20))).toBe('2027-02-20')
  })
})

describe('precio unitario máximo', () => {
  it('es el mismo en toda la tabla, así que no sirve para categorizar', () => {
    expect(PRECIO_UNITARIO_MAXIMO).toBe(716840.77)
  })
})
