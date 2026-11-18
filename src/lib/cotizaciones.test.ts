import { beforeEach, describe, expect, it } from 'vitest'

// Los tests corren en Node, sin navegador, y la caché usa localStorage. Un sustituto en memoria
// alcanza: lo que se prueba es qué se guarda, no el almacenamiento del navegador.
const almacen = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => void almacen.set(k, v),
    removeItem: (k: string) => void almacen.delete(k),
    clear: () => almacen.clear(),
  },
})

const { aPesos, guardarCache, leerCache, parsearCotizaciones, tipoDeCambio } = await import('./cotizaciones')
type Cotizacion = import('./cotizaciones').Cotizacion

const MEP: Cotizacion = { casa: 'bolsa', compra: 1000, venta: 1100, actualizado: '2026-11-18T12:00:00Z' }

describe('parsearCotizaciones', () => {
  it('lee la respuesta de la API', () => {
    const c = parsearCotizaciones([
      { moneda: 'USD', casa: 'oficial', nombre: 'Oficial', compra: 900, venta: 950, fechaActualizacion: '2026-11-18T12:00:00Z' },
      { moneda: 'USD', casa: 'bolsa', nombre: 'Bolsa', compra: 1000, venta: 1100, fechaActualizacion: '2026-11-18T12:00:00Z' },
    ])
    expect(c.oficial?.venta).toBe(950)
    expect(c.bolsa?.compra).toBe(1000)
  })

  it('ignora las casas que no usamos, sin romperse', () => {
    const c = parsearCotizaciones([{ casa: 'cripto', compra: 1, venta: 2 }, { casa: 'tarjeta', compra: 1, venta: 2 }])
    expect(Object.keys(c)).toEqual([])
  })

  it('descarta una cotización en cero o negativa', () => {
    // Convertir con cero deja todos los saldos en cero, que es peor que no tener el dato.
    const c = parsearCotizaciones([
      { casa: 'blue', compra: 0, venta: 1200 },
      { casa: 'oficial', compra: 900, venta: -5 },
    ])
    expect(c.blue).toBeUndefined()
    expect(c.oficial).toBeUndefined()
  })

  it('aguanta cualquier cosa que venga de un tercero', () => {
    expect(parsearCotizaciones(null)).toEqual({})
    expect(parsearCotizaciones({ error: 'mantenimiento' })).toEqual({})
    expect(parsearCotizaciones([null, 'texto', 42])).toEqual({})
    expect(parsearCotizaciones([{ casa: 'blue', compra: 'mil', venta: 'mil cien' }])).toEqual({})
  })
})

describe('tipoDeCambio', () => {
  it('valúa el activo a la compra y el pasivo a la venta', () => {
    // Lo que tenés, a lo que te darían por venderlo; lo que debés, a lo que te costaría comprarlo.
    expect(tipoDeCambio(MEP, 'activo')).toBe(1000)
    expect(tipoDeCambio(MEP, 'pasivo')).toBe(1100)
  })
})

describe('aPesos', () => {
  it('deja los pesos como están', () => {
    expect(aPesos(5000, 'ARS', MEP)).toEqual({ monto: 5000, convertido: true })
  })

  it('un importe sin moneda es en pesos — todo lo cargado antes de los dólares', () => {
    expect(aPesos(5000, undefined, MEP)).toEqual({ monto: 5000, convertido: true })
    // Y no se toca ni cuando no hay cotización: no depende de ella.
    expect(aPesos(5000, undefined, null)).toEqual({ monto: 5000, convertido: true })
  })

  it('convierte los dólares según el lado', () => {
    expect(aPesos(100, 'USD', MEP, 'activo').monto).toBe(100_000)
    expect(aPesos(100, 'USD', MEP, 'pasivo').monto).toBe(110_000)
  })

  it('sin cotización avisa que no convirtió, en vez de inventar un número', () => {
    expect(aPesos(100, 'USD', null)).toEqual({ monto: 100, convertido: false })
  })
})

describe('caché', () => {
  beforeEach(() => localStorage.clear())

  it('guarda y recupera con el día', () => {
    guardarCache({ bolsa: MEP }, '2026-11-18')
    expect(leerCache()).toEqual({ dia: '2026-11-18', cotizaciones: { bolsa: MEP } })
  })

  it('devuelve null si lo guardado no sirve', () => {
    localStorage.setItem('compara-prestamos.cotizaciones', '{ roto')
    expect(leerCache()).toBe(null)
    localStorage.setItem('compara-prestamos.cotizaciones', JSON.stringify({ dia: 5 }))
    expect(leerCache()).toBe(null)
  })
})
