import { describe, expect, it } from 'vitest'
import { sinUndefined } from './sinUndefined'

describe('sinUndefined', () => {
  it('saca la clave del campo opcional que quedó sin valor', () => {
    const movimiento = { id: 'm1', monto: 1000, concepto: undefined }
    expect(sinUndefined(movimiento)).toEqual({ id: 'm1', monto: 1000 })
    expect('concepto' in sinUndefined(movimiento)).toBe(false)
  })

  it('limpia adentro de los arreglos, que es donde aparece en la práctica', () => {
    const datos = { cheques: [{ id: 'c1', facturaId: undefined, monto: 50 }] }
    expect(sinUndefined(datos)).toEqual({ cheques: [{ id: 'c1', monto: 50 }] })
  })

  it('no toca null, cero ni la cadena vacía: son valores, no ausencia', () => {
    const datos = { a: null, b: 0, c: '', d: false }
    expect(sinUndefined(datos)).toEqual(datos)
  })

  it('deja igual lo que ya está limpio, con todo su anidamiento', () => {
    const datos = { cuentas: [{ id: 'c1', saldo: 10, meta: { banco: 'Nación' } }], version: 3 }
    expect(sinUndefined(datos)).toEqual(datos)
  })

  it('no desarma un Date', () => {
    const fecha = new Date('2026-01-15T00:00:00Z')
    expect(sinUndefined({ fecha }).fecha).toBe(fecha)
  })
})
