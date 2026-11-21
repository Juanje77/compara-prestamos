import { describe, expect, it } from 'vitest'
import { filtrarCheques, normalizar } from './filtrarCheques'
import type { Cheque } from './cfo'

function cheque(p: Partial<Cheque> & { id: string }): Cheque {
  return {
    tipo: 'recibido', banco: 'Nación', contraparte: 'Cliente', monto: 100_000,
    fechaEmision: '2026-11-01', fechaCobro: '2026-12-01', estado: 'cartera', ...p,
  } as Cheque
}

describe('normalizar', () => {
  it('ignora acentos, mayúsculas y puntos', () => {
    expect(normalizar('NACIÓN')).toBe('nacion')
    expect(normalizar('1.234')).toBe('1 234')
  })
})

describe('filtrarCheques', () => {
  const cheques = [
    cheque({ id: 'a', tipo: 'recibido', contraparte: 'Metalúrgica Sur', banco: 'Galicia', numero: '1234', monto: 400_000, fechaCobro: '2026-12-10' }),
    cheque({ id: 'b', tipo: 'emitido', contraparte: 'Proveedor Acero', banco: 'Nación', numero: '9876', monto: 50_000, fechaCobro: '2026-12-01' }),
    cheque({ id: 'c', tipo: 'recibido', contraparte: 'Cliente Norte', banco: 'Santander', monto: 4_000, fechaCobro: '2026-12-05', estado: 'entregado', endosadoA: 'Ferretería Oeste' }),
  ]

  it('sin filtros devuelve todo, ordenado por fecha de cobro', () => {
    expect(filtrarCheques(cheques).map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('filtra por tipo', () => {
    expect(filtrarCheques(cheques, { tipo: 'emitido' }).map((c) => c.id)).toEqual(['b'])
    expect(filtrarCheques(cheques, { tipo: 'recibido' }).map((c) => c.id)).toEqual(['c', 'a'])
  })

  it('busca por nombre sin que importen los acentos', () => {
    expect(filtrarCheques(cheques, { busqueda: 'metalurgica' }).map((c) => c.id)).toEqual(['a'])
  })

  it('busca por banco, por número y por a quién se endosó', () => {
    expect(filtrarCheques(cheques, { busqueda: 'galicia' }).map((c) => c.id)).toEqual(['a'])
    expect(filtrarCheques(cheques, { busqueda: '9876' }).map((c) => c.id)).toEqual(['b'])
    expect(filtrarCheques(cheques, { busqueda: 'ferreteria' }).map((c) => c.id)).toEqual(['c'])
  })

  it('busca por importe, y escribir más dígitos achica la lista', () => {
    expect(filtrarCheques(cheques, { busqueda: '400' }).map((c) => c.id).sort()).toEqual(['a', 'c'])
    expect(filtrarCheques(cheques, { busqueda: '400000' }).map((c) => c.id)).toEqual(['a'])
  })

  it('combina el tipo con la búsqueda', () => {
    expect(filtrarCheques(cheques, { tipo: 'recibido', busqueda: 'norte' }).map((c) => c.id)).toEqual(['c'])
    expect(filtrarCheques(cheques, { tipo: 'emitido', busqueda: 'norte' })).toEqual([])
  })

  it('una búsqueda que no encuentra nada devuelve vacío, no todo', () => {
    expect(filtrarCheques(cheques, { busqueda: 'xyz' })).toEqual([])
  })
})
