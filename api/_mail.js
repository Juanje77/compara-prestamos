// Envío de mails transaccionales: por SMTP o por Resend, lo que esté configurado.
//
// Hay dos caminos porque hay dos situaciones. SMTP sirve cuando ya existe una casilla andando
// (el hosting, Google Workspace, Gmail) y no hay nada nuevo que dar de alta; Resend sirve cuando
// no hay ninguna y se quiere algo pensado para mails automáticos. Elegir uno u otro es cargar
// unas variables u otras — el resto del sistema no se entera.
//
// La plantilla se arma aparte del envío para poder testearla: lo que más importa de un mail de
// código es que el código se vea y que el texto no invite a reenviarlo a nadie.
const API_RESEND = 'https://api.resend.com/emails'

/**
 * Qué transporte usar, mirando qué variables hay cargadas.
 *
 * SMTP va primero: si alguien se tomó el trabajo de configurar una casilla propia, es la que
 * quiere usar. Que la decisión sea una función aparte es para poder testearla sin mandar nada.
 */
export function configuracionDeMail(env = process.env) {
  const remitente = env.MAIL_FROM || env.RESEND_FROM || env.SMTP_USER || null

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const puerto = Number(env.SMTP_PORT) || 587
    return {
      transporte: 'smtp',
      remitente,
      host: env.SMTP_HOST,
      puerto,
      // El 465 es TLS desde el saludo; el 587 arranca en claro y sube a TLS con STARTTLS. Ponerlo
      // al revés no da un error claro, se queda colgado hasta que corta por tiempo.
      seguro: puerto === 465,
      usuario: env.SMTP_USER,
      clave: env.SMTP_PASS,
    }
  }

  if (env.RESEND_API_KEY) {
    return { transporte: 'resend', remitente, apiKey: env.RESEND_API_KEY }
  }

  return { transporte: 'ninguno', remitente }
}

/** El remitente, con un valor por defecto que sirve para que el código no se rompa — pero que
 * ningún proveedor va a aceptar, así que en producción hay que configurarlo de verdad. */
function remitente(config) {
  return config.remitente || 'FinCorp <no-responder@fincorp.com.ar>'
}

/** El texto del mail con el código. Sin links: un mail de segundo factor que trae un botón es
 * exactamente lo que imita el phishing, y acostumbra al usuario a hacer clic. */
export function plantillaCodigo(codigo, minutosValidez) {
  const asunto = `${codigo} es tu código de FinCorp`
  const texto = [
    `Tu código para entrar a FinCorp es: ${codigo}`,
    '',
    `Vence en ${minutosValidez} minutos y se usa una sola vez.`,
    '',
    'Si no estabas intentando entrar, ignorá este mail y cambiá tu contraseña: alguien más la tiene.',
    'Nadie de FinCorp te va a pedir este código por teléfono ni por WhatsApp.',
  ].join('\n')

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px">
  <p style="font-size:15px;color:#334">Tu código para entrar a FinCorp es:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#0a1f44">${codigo}</p>
  <p style="font-size:14px;color:#556">Vence en ${minutosValidez} minutos y se usa una sola vez.</p>
  <p style="font-size:13px;color:#889;margin-top:24px">
    Si no estabas intentando entrar, ignorá este mail y cambiá tu contraseña: alguien más la tiene.
    Nadie de FinCorp te va a pedir este código por teléfono ni por WhatsApp.
  </p>
</div>`

  return { asunto, texto, html }
}

/**
 * Manda el mail. Devuelve true si el proveedor lo aceptó. Nunca lanza: quien llama decide qué
 * hacer con un mail que no salió —el segundo factor corta, la invitación muestra el link— y para
 * eso le alcanza con un sí o un no.
 */
export async function enviarMail({ para, asunto, texto, html }) {
  const config = configuracionDeMail()
  try {
    if (config.transporte === 'smtp') return await enviarPorSmtp(config, { para, asunto, texto, html })
    if (config.transporte === 'resend') return await enviarPorResend(config, { para, asunto, texto, html })
    return false
  } catch {
    return false
  }
}

async function enviarPorResend(config, { para, asunto, texto, html }) {
  const res = await fetch(API_RESEND, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ from: remitente(config), to: [para], subject: asunto, text: texto, html }),
  })
  return res.ok
}

async function enviarPorSmtp(config, { para, asunto, texto, html }) {
  // Se importa acá adentro y no arriba para que las funciones que nunca mandan un mail no carguen
  // la librería: en serverless, cada import es tiempo de arranque en frío.
  const { default: nodemailer } = await import('nodemailer')
  const transporte = nodemailer.createTransport({
    host: config.host,
    port: config.puerto,
    secure: config.seguro,
    auth: { user: config.usuario, pass: config.clave },
  })
  const info = await transporte.sendMail({
    from: remitente(config),
    to: para,
    subject: asunto,
    text: texto,
    html,
  })
  // `accepted` es la lista de destinatarios que el servidor aceptó. Vacía significa que la
  // conexión anduvo pero el mail no entró — no es lo mismo que un error y hay que distinguirlo.
  return (info?.accepted?.length ?? 0) > 0
}
