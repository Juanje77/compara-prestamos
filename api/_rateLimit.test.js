import { beforeEach, describe, expect, it } from 'vitest'
import { dentroDelLimite, ipDe, reiniciarLimites } from './_rateLimit.js'

const LIMITE = { maximo: 3, ventanaMs: 60_000 }

beforeEach(reiniciarLimites)

describe('ipDe', () => {
  it('toma la primera IP de x-forwarded-for, que es la del cliente', () => {
    expect(ipDe({ headers: { 'x-forwarded-for': '200.1.2.3, 10.0.0.1' } })).toBe('200.1.2.3')
  })

  it('cae al socket si no hay cabecera', () => {
    expect(ipDe({ headers: {}, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1')
  })

  it('nunca devuelve vacío, para no juntar a todos en la misma clave', () => {
    expect(ipDe({ headers: {} })).toBe('desconocida')
    expect(ipDe({ headers: { 'x-forwarded-for': '  ' } })).toBe('desconocida')
  })
})

describe('dentroDelLimite', () => {
  it('deja pasar hasta el máximo y después corta', () => {
    for (let i = 0; i < 3; i++) expect(dentroDelLimite('bcra:ip', LIMITE).permitido).toBe(true)
    expect(dentroDelLimite('bcra:ip', LIMITE).permitido).toBe(false)
  })

  it('cuenta por separado a cada clave', () => {
    for (let i = 0; i < 3; i++) dentroDelLimite('bcra:unaIp', LIMITE)
    expect(dentroDelLimite('bcra:otraIp', LIMITE).permitido).toBe(true)
  })

  it('vuelve a permitir cuando pasó la ventana', () => {
    const inicio = 1_000_000
    for (let i = 0; i < 3; i++) dentroDelLimite('bcra:ip', LIMITE, inicio)
    expect(dentroDelLimite('bcra:ip', LIMITE, inicio + 59_000).permitido).toBe(false)
    expect(dentroDelLimite('bcra:ip', LIMITE, inicio + 60_001).permitido).toBe(true)
  })

  it('informa cuántos pedidos quedan', () => {
    expect(dentroDelLimite('bcra:ip', LIMITE).restantes).toBe(2)
    expect(dentroDelLimite('bcra:ip', LIMITE).restantes).toBe(1)
  })

  it('no se queda con los contadores vencidos', () => {
    const inicio = 1_000_000
    dentroDelLimite('vieja', LIMITE, inicio)
    // Al pasar la ventana, el contador de "vieja" se limpia con el próximo pedido de cualquiera.
    dentroDelLimite('nueva', LIMITE, inicio + 60_001)
    expect(dentroDelLimite('vieja', LIMITE, inicio + 60_001).restantes).toBe(2)
  })
})
