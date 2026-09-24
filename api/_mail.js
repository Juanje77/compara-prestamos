// Envío de mails transaccionales con Resend.
//
// La plantilla se arma aparte de la llamada HTTP para poder testearla: lo que más importa de un
// mail de código es que el código se vea y que el texto no invite a reenviarlo a nadie.
const API = 'https://api.resend.com/emails'

/** El remitente. Tiene que ser de un dominio verificado en Resend, o Resend rechaza el envío. */
function remitente() {
  return process.env.RESEND_FROM || 'FinCorp <no-responder@fincorp.com.ar>'
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

/** Manda el mail. Devuelve true si Resend lo aceptó. Nunca lanza: quien llama decide qué hacer. */
export async function enviarMail({ para, asunto, texto, html }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: remitente(), to: [para], subject: asunto, text: texto, html }),
    })
    return res.ok
  } catch {
    return false
  }
}
