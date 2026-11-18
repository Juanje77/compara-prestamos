import { describe, expect, it } from 'vitest'
import { cuentasEnPesos, faltaCotizacion } from './convertirMonedas'
import type { CuentaBancaria } from './cfo'
import type { Cotizacion } from './cotizaciones'

const MEP: Cotizacion = { casa: 'bolsa', compra: 1000, venta: 1100, actualizado: '2026-11-18T12:00:00Z' }

const pesos: CuentaBancaria = { id: 'a', nombre: 'Caja', saldo: 500_000 }
const dolares: CuentaBancaria = { id: 'b', nombre: 'Caja USD', saldo: 10_000, moneda: 'USD' }

describe('cuentasEnPesos', () => {
  it('no toca una cuenta en pesos', () => {
    expect(cuentasEnPesos([pesos], MEP)).toEqual([pesos])
  })

  it('no toca lo cargado antes de que existieran los dólares', () => {
    // Sin `moneda` es pesos. Este es el caso de todas las cuentas que ya existen.
    const viejas = [{ id: 'x', nombre: 'Banco', saldo: 1_234_567 }]
    expect(cuentasEnPesos(viejas, MEP)).toEqual(viejas)
  })

  it('valúa los dólares a la compra: lo que te darían al venderlos', () => {
    const [c] = cuentasEnPesos([dolares], MEP)
    expect(c.saldo).toBe(10_000_000)
    expect(c.moneda).toBe('ARS')
  })

  it('devuelve el mismo arreglo cuando no hay nada en dólares', () => {
    // No es cosmético: evita recrear el arreglo en cada render y disparar recálculos.
    const cuentas = [pesos]
    expect(cuentasEnPesos(cuentas, MEP)).toBe(cuentas)
  })

  it('sin cotización deja el saldo en dólares como está, en vez de ponerlo en cero', () => {
    // Poner cero haría ver una caja vacía que no lo está. La pantalla avisa que falta la cotización.
    const [c] = cuentasEnPesos([dolares], null)
    expect(c.saldo).toBe(10_000)
  })

  it('convierte solo las de dólares cuando están mezcladas', () => {
    const r = cuentasEnPesos([pesos, dolares], MEP)
    expect(r.map((c) => c.saldo)).toEqual([500_000, 10_000_000])
  })

  it('convierte un descubierto en dólares con su signo', () => {
    const [c] = cuentasEnPesos([{ id: 'd', nombre: 'USD', saldo: -2_000, moneda: 'USD' }], MEP)
    expect(c.saldo).toBe(-2_000_000)
  })
})

describe('faltaCotizacion', () => {
  it('avisa solo si hay dólares y no hay cotización', () => {
    expect(faltaCotizacion([dolares], null)).toBe(true)
    expect(faltaCotizacion([dolares], MEP)).toBe(false)
    expect(faltaCotizacion([pesos], null)).toBe(false)
  })
})
