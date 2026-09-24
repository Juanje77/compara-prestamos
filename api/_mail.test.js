import { describe, expect, it } from 'vitest'
import { plantillaCodigo } from './_mail.js'

describe('plantillaCodigo', () => {
  const { asunto, texto, html } = plantillaCodigo('483920', 10)

  it('pone el código en el asunto, para leerlo desde la notificación sin abrir el mail', () => {
    expect(asunto).toContain('483920')
  })

  it('el código aparece en las dos versiones del cuerpo', () => {
    expect(texto).toContain('483920')
    expect(html).toContain('483920')
  })

  it('dice cuánto dura y que es de un solo uso', () => {
    expect(texto).toContain('10 minutos')
    expect(texto).toContain('una sola vez')
  })

  it('avisa qué hacer si no fuiste vos', () => {
    expect(texto).toMatch(/no estabas intentando entrar/i)
    expect(texto).toMatch(/cambiá tu contraseña/i)
  })

  it('no trae links: un mail de segundo factor con botones es lo que imita el phishing', () => {
    expect(html).not.toMatch(/<a\s/i)
    expect(texto).not.toMatch(/https?:\/\//)
  })
})
