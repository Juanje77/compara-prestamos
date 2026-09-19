import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { firmaWebhookValida, partesDeFirma, plantillaFirmada } from './_mercadopago.js'

const SECRETO = 'secreto-de-prueba'
const DATOS = { dataId: '123456', requestId: 'req-abc', ts: '1704908010' }

/** Firma como lo haría Mercado Pago, para no hardcodear un hash en el test. */
function firmar(secreto, datos) {
  const hmac = createHmac('sha256', secreto).update(plantillaFirmada(datos)).digest('hex')
  return `ts=${datos.ts},v1=${hmac}`
}

describe('partesDeFirma', () => {
  it('saca el ts y el v1 de la cabecera', () => {
    expect(partesDeFirma('ts=123,v1=abc')).toEqual({ ts: '123', v1: 'abc' })
  })

  it('tolera espacios, que Mercado Pago a veces manda', () => {
    expect(partesDeFirma('ts=123, v1=abc')).toEqual({ ts: '123', v1: 'abc' })
  })

  it('devuelve null si falta alguna parte o la cabecera no vino', () => {
    expect(partesDeFirma('ts=123')).toBeNull()
    expect(partesDeFirma('v1=abc')).toBeNull()
    expect(partesDeFirma('')).toBeNull()
    expect(partesDeFirma(undefined)).toBeNull()
  })
})

describe('plantillaFirmada', () => {
  it('arma la plantilla en el orden que espera Mercado Pago', () => {
    expect(plantillaFirmada(DATOS)).toBe('id:123456;request-id:req-abc;ts:1704908010;')
  })

  it('pasa a minúscula un id alfanumérico', () => {
    expect(plantillaFirmada({ ...DATOS, dataId: 'AbC123' })).toContain('id:abc123;')
  })

  it('omite entero el campo que no llegó', () => {
    expect(plantillaFirmada({ ts: '1', requestId: 'r' })).toBe('request-id:r;ts:1;')
  })
})

describe('firmaWebhookValida', () => {
  const cabeceras = { xSignature: firmar(SECRETO, DATOS), requestId: DATOS.requestId, dataId: DATOS.dataId }

  it('acepta una notificación firmada con el secreto correcto', () => {
    expect(firmaWebhookValida(SECRETO, cabeceras)).toBe(true)
  })

  it('rechaza una firmada con otro secreto', () => {
    expect(firmaWebhookValida('otro-secreto', cabeceras)).toBe(false)
  })

  it('rechaza si alguien cambió el id de la notificación', () => {
    expect(firmaWebhookValida(SECRETO, { ...cabeceras, dataId: '999999' })).toBe(false)
  })

  it('rechaza una firma inventada o mal formada', () => {
    expect(firmaWebhookValida(SECRETO, { ...cabeceras, xSignature: 'ts=1,v1=deadbeef' })).toBe(false)
    expect(firmaWebhookValida(SECRETO, { ...cabeceras, xSignature: 'cualquier cosa' })).toBe(false)
    expect(firmaWebhookValida(SECRETO, { ...cabeceras, xSignature: 'ts=1,v1=noesunhex' })).toBe(false)
  })

  it('sin secreto configurado no valida nada', () => {
    expect(firmaWebhookValida(undefined, cabeceras)).toBe(false)
    expect(firmaWebhookValida('', cabeceras)).toBe(false)
  })
})
