import { describe, expect, it } from 'vitest'
import { asignarSectorHabitual, sectorHabitualDe } from './sectorHabitual'
import type { Factura } from './cfo'

function f(p: Partial<Factura> & { id: string }): Factura {
  return {
    tipo: 'recibida', tipoComprobante: 'factura', contraparte: 'Aceros del Sur SRL',
    monto: 100_000, fecha: '2026-10-01', ...p,
  } as Factura
}

describe('sectorHabitualDe', () => {
  it('devuelve el sector con el que se cargó antes a esa contraparte', () => {
    expect(sectorHabitualDe('Aceros del Sur SRL', 'recibida', [f({ id: 'a', sectorId: 'metal' })])).toBe('metal')
  })

  it('no le importan los acentos ni la puntuación del nombre', () => {
    const cargadas = [f({ id: 'a', contraparte: 'ACEROS DEL SUR S.R.L.', sectorId: 'metal' })]
    expect(sectorHabitualDe('Aceros del Sur SRL', 'recibida', cargadas)).toBe('metal')
  })

  it('gana el más repetido, no el más reciente', () => {
    // Una clasificación equivocada una vez no debería cambiar el criterio de todas las que vienen.
    const cargadas = [
      f({ id: 'a', sectorId: 'metal', fecha: '2026-08-01' }),
      f({ id: 'b', sectorId: 'metal', fecha: '2026-09-01' }),
      f({ id: 'c', sectorId: 'obra', fecha: '2026-10-01' }),
    ]
    expect(sectorHabitualDe('Aceros del Sur SRL', 'recibida', cargadas)).toBe('metal')
  })

  it('empatados, gana el de la factura más nueva: ahí sí cambió el criterio', () => {
    const cargadas = [
      f({ id: 'a', sectorId: 'metal', fecha: '2026-08-01' }),
      f({ id: 'b', sectorId: 'obra', fecha: '2026-10-01' }),
    ]
    expect(sectorHabitualDe('Aceros del Sur SRL', 'recibida', cargadas)).toBe('obra')
  })

  it('no mezcla los dos lados: el mismo nombre puede ser cliente y proveedor', () => {
    const cargadas = [f({ id: 'a', tipo: 'emitida', sectorId: 'ventas' })]
    expect(sectorHabitualDe('Aceros del Sur SRL', 'recibida', cargadas)).toBe(null)
    expect(sectorHabitualDe('Aceros del Sur SRL', 'emitida', cargadas)).toBe('ventas')
  })

  it('ignora las que no tienen sector puesto', () => {
    expect(sectorHabitualDe('Aceros del Sur SRL', 'recibida', [f({ id: 'a' })])).toBe(null)
  })

  it('una contraparte nueva no tiene sector habitual', () => {
    expect(sectorHabitualDe('Proveedor Nuevo', 'recibida', [f({ id: 'a', sectorId: 'metal' })])).toBe(null)
  })

  it('un nombre vacío no engancha con nada', () => {
    expect(sectorHabitualDe('', 'recibida', [f({ id: 'a', contraparte: '', sectorId: 'metal' })])).toBe(null)
  })
})

describe('asignarSectorHabitual', () => {
  const cargadas = [
    f({ id: 'a', contraparte: 'Aceros del Sur SRL', sectorId: 'metal' }),
    f({ id: 'b', contraparte: 'Pinturas Norte', tipo: 'emitida', sectorId: 'ventas' }),
  ]

  it('clasifica las nuevas según lo que ya había', () => {
    const nuevas: { tipo: Factura['tipo']; contraparte: string; sectorId?: string }[] = [
      { tipo: 'recibida', contraparte: 'ACEROS DEL SUR SRL' },
    ]
    const r = asignarSectorHabitual(nuevas, cargadas)
    expect(r.comprobantes[0].sectorId).toBe('metal')
    expect(r.clasificados).toBe(1)
  })

  it('no pisa el sector que el comprobante ya traía', () => {
    const nuevas = [{ tipo: 'recibida' as const, contraparte: 'Aceros del Sur SRL', sectorId: 'obra' }]
    const r = asignarSectorHabitual(nuevas, cargadas)
    expect(r.comprobantes[0].sectorId).toBe('obra')
    expect(r.clasificados).toBe(0)
  })

  it('deja sin sector al que no se puede deducir, en vez de ponerle cualquiera', () => {
    const nuevas: { tipo: Factura['tipo']; contraparte: string; sectorId?: string }[] = [
      { tipo: 'recibida', contraparte: 'Proveedor Nuevo' },
    ]
    const r = asignarSectorHabitual(nuevas, cargadas)
    expect(r.comprobantes[0].sectorId).toBeUndefined()
    expect(r.clasificados).toBe(0)
  })
})
