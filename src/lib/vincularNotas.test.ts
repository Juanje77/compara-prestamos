import { describe, expect, it } from 'vitest'
import { candidatasParaNota, sugerirVinculoNota, vincularNotasDeCredito } from './vincularNotas'
import type { Factura } from './cfo'

function f(p: Partial<Factura> & { id: string }): Factura {
  return {
    tipo: 'emitida', tipoComprobante: 'factura', contraparte: 'Distribuidora Sur SA',
    monto: 121_000, fecha: '2026-10-01', ...p,
  } as Factura
}
const nota = (p: Partial<Factura> & { id: string }) => f({ tipoComprobante: 'nota_credito', fecha: '2026-11-01', ...p })

describe('candidatasParaNota', () => {
  it('solo facturas del mismo lado, contraparte y moneda, anteriores a la nota', () => {
    const facturas = [
      f({ id: 'ok' }),
      f({ id: 'otroLado', tipo: 'recibida' }),
      f({ id: 'otraContraparte', contraparte: 'Ferretería Oeste' }),
      f({ id: 'otraMoneda', moneda: 'USD' }),
      f({ id: 'posterior', fecha: '2026-12-01' }),
      f({ id: 'esNota', tipoComprobante: 'nota_credito' }),
    ]
    const n = nota({ id: 'n' })
    expect(candidatasParaNota(n, facturas).map((x) => x.id)).toEqual(['ok'])
  })

  it('no le importan los puntos ni las mayúsculas del nombre', () => {
    // "DISTRIBUIDORA SUR S.A." y "Distribuidora Sur SA" son la misma empresa escrita distinto.
    const facturas = [f({ id: 'a', contraparte: 'DISTRIBUIDORA SUR S.A.' })]
    expect(candidatasParaNota(nota({ id: 'n' }), facturas)).toHaveLength(1)
  })

  it('una nota del mismo día que la factura sí la puede corregir', () => {
    expect(candidatasParaNota(nota({ id: 'n', fecha: '2026-10-01' }), [f({ id: 'a' })])).toHaveLength(1)
  })
})

describe('sugerirVinculoNota', () => {
  it('prefiere la factura del mismo importe: es la anulación total', () => {
    const facturas = [
      f({ id: 'parecida', monto: 500_000, fecha: '2026-10-20' }),
      f({ id: 'exacta', monto: 121_000, fecha: '2026-10-05' }),
    ]
    expect(sugerirVinculoNota(nota({ id: 'n', monto: 121_000 }), facturas)).toBe('exacta')
  })

  it('sin importe exacto, la más reciente anterior con saldo suficiente', () => {
    const facturas = [
      f({ id: 'vieja', monto: 500_000, fecha: '2026-09-01' }),
      f({ id: 'reciente', monto: 500_000, fecha: '2026-10-20' }),
    ]
    expect(sugerirVinculoNota(nota({ id: 'n', monto: 50_000 }), facturas)).toBe('reciente')
  })

  it('no vincula si la nota es más grande que cualquier factura', () => {
    // Ahí ya no corrige una factura puntual, y elegir una sería inventar.
    expect(sugerirVinculoNota(nota({ id: 'n', monto: 900_000 }), [f({ id: 'a', monto: 100_000 })])).toBe(null)
  })

  it('no vincula cuando no hay ninguna candidata', () => {
    expect(sugerirVinculoNota(nota({ id: 'n' }), [])).toBe(null)
  })

  it('descuenta lo que otra nota ya acreditó de esa factura', () => {
    const facturas = [
      f({ id: 'a', monto: 100_000, fecha: '2026-10-01' }),
      nota({ id: 'vieja', monto: 80_000, comprobanteAsociadoId: 'a', fecha: '2026-10-15' }),
    ]
    // Quedan 20.000 vivos: una nota de 50.000 ya no entra ahí.
    expect(sugerirVinculoNota(nota({ id: 'n', monto: 50_000 }), facturas)).toBe(null)
    expect(sugerirVinculoNota(nota({ id: 'n', monto: 20_000 }), facturas)).toBe('a')
  })
})

describe('vincularNotasDeCredito', () => {
  it('vincula las que puede y deja el resto como estaba', () => {
    const facturas = [
      f({ id: 'fa', monto: 121_000, fecha: '2026-10-01' }),
      nota({ id: 'n1', monto: 121_000 }),
      nota({ id: 'n2', monto: 999_999, contraparte: 'Nadie' }),
    ]
    const r = vincularNotasDeCredito(facturas)
    expect(r.vinculadas).toBe(1)
    expect(r.facturas.find((x) => x.id === 'n1')?.comprobanteAsociadoId).toBe('fa')
    expect(r.facturas.find((x) => x.id === 'n2')?.comprobanteAsociadoId).toBeUndefined()
  })

  it('no toca una nota que ya tenía su factura puesta a mano', () => {
    const facturas = [
      f({ id: 'fa', monto: 121_000, fecha: '2026-10-01' }),
      f({ id: 'fb', monto: 121_000, fecha: '2026-10-02' }),
      nota({ id: 'n1', monto: 121_000, comprobanteAsociadoId: 'fa' }),
    ]
    const r = vincularNotasDeCredito(facturas)
    expect(r.vinculadas).toBe(0)
    expect(r.facturas.find((x) => x.id === 'n1')?.comprobanteAsociadoId).toBe('fa')
  })

  it('dos notas sobre la misma factura no la sobrepasan entre las dos', () => {
    const facturas = [
      f({ id: 'fa', monto: 100_000, fecha: '2026-10-01' }),
      nota({ id: 'n1', monto: 70_000, fecha: '2026-10-10' }),
      nota({ id: 'n2', monto: 70_000, fecha: '2026-10-20' }),
    ]
    const r = vincularNotasDeCredito(facturas)
    // La primera se lleva la factura; la segunda ya no entra y queda sin vincular.
    expect(r.facturas.find((x) => x.id === 'n1')?.comprobanteAsociadoId).toBe('fa')
    expect(r.facturas.find((x) => x.id === 'n2')?.comprobanteAsociadoId).toBeUndefined()
    expect(r.vinculadas).toBe(1)
  })

  it('devuelve el mismo arreglo cuando no hay nada que vincular', () => {
    const facturas = [f({ id: 'fa' })]
    expect(vincularNotasDeCredito(facturas).facturas).toBe(facturas)
  })
})
