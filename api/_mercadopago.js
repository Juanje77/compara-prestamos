// Validación de la firma con la que Mercado Pago firma sus notificaciones.
//
// Mercado Pago manda dos cabeceras: `x-signature`, con la forma `ts=<epoch>,v1=<hmac>`, y
// `x-request-id`. El HMAC es SHA-256 sobre la plantilla `id:<data.id>;request-id:<req-id>;ts:<ts>;`
// usando como clave el secreto que da el panel de Mercado Pago.
//
// Esto es defensa en profundidad, no la barrera principal: el webhook nunca le cree al cuerpo de
// la notificación, vuelve a consultarle a Mercado Pago el estado real de la preapproval. O sea que
// una notificación falsa nunca pudo otorgar un plan. Lo que evita la firma es que cualquiera nos
// haga salir a consultar la API de Mercado Pago a discreción.
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Las partes de `x-signature`, o null si la cabecera falta o no tiene la forma esperada. */
export function partesDeFirma(xSignature) {
  if (typeof xSignature !== 'string') return null
  const partes = {}
  for (const trozo of xSignature.split(',')) {
    const [clave, valor] = trozo.split('=')
    if (clave && valor) partes[clave.trim()] = valor.trim()
  }
  return partes.ts && partes.v1 ? { ts: partes.ts, v1: partes.v1 } : null
}

/**
 * La plantilla que Mercado Pago firma. Los campos que no llegan se omiten enteros (así lo define
 * su documentación), y un `data.id` alfanumérico va en minúscula.
 */
export function plantillaFirmada({ dataId, requestId, ts }) {
  const partes = []
  if (dataId) partes.push(`id:${String(dataId).toLowerCase()};`)
  if (requestId) partes.push(`request-id:${requestId};`)
  if (ts) partes.push(`ts:${ts};`)
  return partes.join('')
}

/**
 * Si la notificación viene firmada por Mercado Pago.
 *
 * No se controla la antigüedad del `ts` a propósito: Mercado Pago reintenta las notificaciones que
 * fallan, a veces bastante después, y rechazar un reintento por viejo nos haría perder un cambio
 * de suscripción. El procesamiento es idempotente, así que un reenvío no hace daño.
 */
export function firmaWebhookValida(secreto, { xSignature, requestId, dataId }) {
  if (!secreto) return false
  const partes = partesDeFirma(xSignature)
  if (!partes) return false

  const esperado = createHmac('sha256', secreto)
    .update(plantillaFirmada({ dataId, requestId, ts: partes.ts }))
    .digest()

  // Un v1 que no sea hexadecimal válido se trunca acá y cae por largo distinto, igual que una
  // firma equivocada. timingSafeEqual exige mismo largo, así que ese chequeo va primero.
  const recibido = Buffer.from(partes.v1, 'hex')
  if (recibido.length !== esperado.length) return false
  return timingSafeEqual(recibido, esperado)
}
