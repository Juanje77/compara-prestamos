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

import { chequesEnPesos, facturasEnPesos, pagosEnPesos, faltaCotizacionEnComprobantes, montoEnMonedaDe } from './convertirMonedas'
import type { Cheque, Factura, Pago } from './cfo'

function factura(p: Partial<Factura> & { id: string; tipo: Factura['tipo']; monto: number }): Factura {
  return { tipoComprobante: 'factura', contraparte: 'X', fecha: '2026-11-01', ...p } as Factura
}
function cheque(p: Partial<Cheque> & { id: string; tipo: Cheque['tipo']; monto: number }): Cheque {
  return { banco: 'Nación', contraparte: 'X', fechaEmision: '2026-11-01', fechaCobro: '2026-12-01', estado: 'cartera', ...p } as Cheque
}

describe('facturasEnPesos', () => {
  it('la emitida es un activo: se valúa a la compra', () => {
    const [f] = facturasEnPesos([factura({ id: 'a', tipo: 'emitida', monto: 1_000, moneda: 'USD' })], MEP)
    expect(f.monto).toBe(1_000_000)
  })

  it('la recibida es un pasivo: se valúa a la venta', () => {
    // Lo que te costaría comprar esos dólares para pagarla. No achicar lo que debés.
    const [f] = facturasEnPesos([factura({ id: 'b', tipo: 'recibida', monto: 1_000, moneda: 'USD' })], MEP)
    expect(f.monto).toBe(1_100_000)
  })

  it('convierte el IVA con el mismo tipo de cambio que el total', () => {
    // Si no, neto más IVA deja de dar el total.
    const [f] = facturasEnPesos([factura({ id: 'c', tipo: 'emitida', monto: 1_210, iva: 210, moneda: 'USD' })], MEP)
    expect(f.monto).toBe(1_210_000)
    expect(f.iva).toBe(210_000)
  })

  it('no toca lo que está en pesos', () => {
    const viejas = [factura({ id: 'd', tipo: 'emitida', monto: 500_000 })]
    expect(facturasEnPesos(viejas, MEP)).toBe(viejas)
  })
})

describe('chequesEnPesos', () => {
  it('el recibido se valúa a la compra y el emitido a la venta', () => {
    const r = chequesEnPesos(
      [cheque({ id: 'a', tipo: 'recibido', monto: 100, moneda: 'USD' }), cheque({ id: 'b', tipo: 'emitido', monto: 100, moneda: 'USD' })],
      MEP,
    )
    expect(r.map((c) => c.monto)).toEqual([100_000, 110_000])
  })

  it('convierte también la comisión de descuento', () => {
    const [c] = chequesEnPesos([cheque({ id: 'a', tipo: 'recibido', monto: 1_000, comisionDescuento: 50, moneda: 'USD' })], MEP)
    expect(c.comisionDescuento).toBe(50_000)
  })
})

describe('pagosEnPesos', () => {
  const enDolares = factura({ id: 'f1', tipo: 'emitida', monto: 1_000, moneda: 'USD' })
  const enPesos = factura({ id: 'f2', tipo: 'emitida', monto: 500_000 })

  it('convierte el pago con la moneda de su factura', () => {
    // Sin esto, el saldo saldría del monto en pesos menos el pago en dólares: la factura se vería
    // casi entera impaga.
    const pagos: Pago[] = [{ id: 'p1', facturaId: 'f1', monto: 300, fecha: '2026-11-05' }]
    expect(pagosEnPesos(pagos, [enDolares], MEP)[0].monto).toBe(300_000)
  })

  it('no toca el pago de una factura en pesos', () => {
    const pagos: Pago[] = [{ id: 'p2', facturaId: 'f2', monto: 100_000, fecha: '2026-11-05' }]
    expect(pagosEnPesos(pagos, [enDolares, enPesos], MEP)[0].monto).toBe(100_000)
  })

  it('deja como está el pago cuya factura no aparece', () => {
    const pagos: Pago[] = [{ id: 'p3', facturaId: 'borrada', monto: 999, fecha: '2026-11-05' }]
    expect(pagosEnPesos(pagos, [enDolares], MEP)[0].monto).toBe(999)
  })

  it('el saldo pendiente cierra después de convertir los dos lados', () => {
    const pagos: Pago[] = [{ id: 'p1', facturaId: 'f1', monto: 300, fecha: '2026-11-05' }]
    const [f] = facturasEnPesos([enDolares], MEP)
    const [p] = pagosEnPesos(pagos, [enDolares], MEP)
    expect(f.monto - p.monto).toBe(700_000)
  })
})

describe('faltaCotizacionEnComprobantes', () => {
  it('avisa solo si hay algo en dólares sin cotización', () => {
    const f = [factura({ id: 'a', tipo: 'emitida', monto: 1, moneda: 'USD' })]
    expect(faltaCotizacionEnComprobantes(f, [], null)).toBe(true)
    expect(faltaCotizacionEnComprobantes(f, [], MEP)).toBe(false)
    expect(faltaCotizacionEnComprobantes([], [], null)).toBe(false)
  })
})

describe('montoEnMonedaDe', () => {
  it('no toca nada si las dos son la misma moneda', () => {
    expect(montoEnMonedaDe(1000, 'ARS', 'ARS', MEP)).toBe(1000)
    expect(montoEnMonedaDe(100, 'USD', 'USD', MEP)).toBe(100)
    expect(montoEnMonedaDe(1000, undefined, 'ARS', MEP)).toBe(1000)
  })

  it('pasa dólares a pesos y pesos a dólares', () => {
    expect(montoEnMonedaDe(100, 'USD', 'ARS', MEP)).toBe(100_000)
    expect(montoEnMonedaDe(100_000, 'ARS', 'USD', MEP)).toBe(100)
  })

  it('ida y vuelta vuelve al mismo número', () => {
    const ida = montoEnMonedaDe(250, 'USD', 'ARS', MEP)
    expect(montoEnMonedaDe(ida, 'ARS', 'USD', MEP)).toBe(250)
  })

  it('sin cotización devuelve el importe sin tocar', () => {
    expect(montoEnMonedaDe(100, 'USD', 'ARS', null)).toBe(100)
  })
})
