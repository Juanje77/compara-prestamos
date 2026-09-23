import { describe, expect, it } from 'vitest'
import { negocioDataTieneCarga } from './negocioData'

/**
 * Esta función es la red de seguridad de la sincronización: decide si una pantalla tiene datos
 * propios que defender. Si diera "true" con un negocio vacío, un dispositivo recién abierto podría
 * descartar lo que el usuario cargó en otra computadora — que es exactamente el error que vino a
 * evitar.
 */
describe('negocioDataTieneCarga', () => {
  it('sin datos guardados es false', () => {
    expect(negocioDataTieneCarga(null)).toBe(false)
    expect(negocioDataTieneCarga(undefined)).toBe(false)
    expect(negocioDataTieneCarga({})).toBe(false)
  })

  it('las listas vacías no cuentan como carga', () => {
    expect(negocioDataTieneCarga({ facturas: [], cuentas: [], deudas: [], empleados: [] })).toBe(false)
  })

  it('los valores por defecto del formulario tampoco: vienen con el negocio vacío', () => {
    expect(negocioDataTieneCarga({ ingresos: 1000000, meses: 12, tasaCrecimiento: 5, nombreNegocio: 'Mi negocio' })).toBe(
      false,
    )
  })

  it('un solo comprobante ya es carga', () => {
    const facturas = [
      { id: 'f1', tipo: 'emitida' as const, tipoComprobante: 'factura' as const, contraparte: 'Cliente', monto: 1000, fecha: '2026-09-23' },
    ]
    expect(negocioDataTieneCarga({ facturas })).toBe(true)
  })

  it('también cuenta lo que no son comprobantes, como una cuenta de tesorería', () => {
    expect(negocioDataTieneCarga({ cuentas: [{ id: 'c1', nombre: 'Banco Nación', saldo: 0 }] })).toBe(true)
  })
})
