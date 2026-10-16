import { describe, expect, it } from 'vitest'
import { configuracionDeMail, plantillaCodigo } from './_mail.js'

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

describe('configuracionDeMail', () => {
  const smtp = { SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'avisos@ejemplo.com.ar', SMTP_PASS: 'clave' }

  it('sin nada configurado no manda: no es un error, es que todavía no se cargó', () => {
    expect(configuracionDeMail({}).transporte).toBe('ninguno')
  })

  it('usa SMTP cuando hay casilla propia', () => {
    expect(configuracionDeMail(smtp).transporte).toBe('smtp')
  })

  it('SMTP le gana a Resend: si alguien configuró su casilla, es la que quiere usar', () => {
    expect(configuracionDeMail({ ...smtp, RESEND_API_KEY: 're_x' }).transporte).toBe('smtp')
  })

  it('cae en Resend cuando no hay SMTP', () => {
    expect(configuracionDeMail({ RESEND_API_KEY: 're_x' }).transporte).toBe('resend')
  })

  it('no toma un SMTP a medias: sin contraseña no se puede autenticar', () => {
    expect(configuracionDeMail({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@b.com' }).transporte).toBe('ninguno')
  })

  it('el puerto por defecto es 587, con STARTTLS y no TLS directo', () => {
    const c = configuracionDeMail(smtp)
    expect(c.puerto).toBe(587)
    expect(c.seguro).toBe(false)
  })

  it('el 465 sí es TLS desde el saludo', () => {
    // Ponerlo al revés no da un error claro: se queda colgado hasta que corta por tiempo.
    expect(configuracionDeMail({ ...smtp, SMTP_PORT: '465' }).seguro).toBe(true)
  })

  it('si no dicen el remitente, usa el usuario de la casilla', () => {
    expect(configuracionDeMail(smtp).remitente).toBe('avisos@ejemplo.com.ar')
  })

  it('MAIL_FROM manda sobre todo lo demás', () => {
    expect(configuracionDeMail({ ...smtp, MAIL_FROM: 'FinCorp <no-responder@ejemplo.com.ar>' }).remitente).toBe(
      'FinCorp <no-responder@ejemplo.com.ar>',
    )
  })

  it('sigue tomando RESEND_FROM, que es como se llamaba antes', () => {
    expect(configuracionDeMail({ RESEND_API_KEY: 're_x', RESEND_FROM: 'F <a@b.com>' }).remitente).toBe('F <a@b.com>')
  })
})
