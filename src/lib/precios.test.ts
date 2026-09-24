import { describe, expect, it } from 'vitest'
import { PRECIOS, ahorroMensual, porcentajeDescuento } from './precios'

describe('precios de los planes', () => {
  it('cada plan cuesta más que el anterior', () => {
    expect(PRECIOS.premium.precio).toBeGreaterThan(PRECIOS.basico.precio)
    expect(PRECIOS.full.precio).toBeGreaterThan(PRECIOS.premium.precio)
  })

  it('ningún precio de lista es menor que el que se cobra: eso sería un descuento al revés', () => {
    for (const p of Object.values(PRECIOS)) {
      if (p.precioLista !== undefined) expect(p.precioLista).toBeGreaterThan(p.precio)
    }
  })

  it('todos los planes muestran el mismo descuento, así la promoción se entiende de una', () => {
    const descuentos = Object.values(PRECIOS).map(porcentajeDescuento)
    expect(new Set(descuentos).size).toBe(1)
  })
})

describe('porcentajeDescuento', () => {
  it('calcula el descuento contra el precio de lista', () => {
    expect(porcentajeDescuento({ precio: 20000, precioLista: 30000 })).toBe(33)
  })

  it('sin precio de lista no hay descuento que mostrar', () => {
    expect(porcentajeDescuento({ precio: 20000 })).toBe(0)
  })

  it('un precio de lista que no supera al vigente no es una promoción', () => {
    expect(porcentajeDescuento({ precio: 20000, precioLista: 20000 })).toBe(0)
    expect(porcentajeDescuento({ precio: 20000, precioLista: 15000 })).toBe(0)
  })
})

describe('ahorroMensual', () => {
  it('es la diferencia contra el precio de lista', () => {
    expect(ahorroMensual({ precio: 20000, precioLista: 30000 })).toBe(10000)
  })

  it('sin promoción, no hay ahorro', () => {
    expect(ahorroMensual({ precio: 20000 })).toBe(0)
  })
})
