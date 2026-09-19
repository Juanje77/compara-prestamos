// Límite de pedidos por IP, para los endpoints que no piden sesión.
//
// Es un contador en memoria de la instancia, no un límite global: en serverless conviven varias
// instancias y cada una lleva el suyo, así que el tope real es el configurado por instancia activa.
// Alcanza para lo que buscamos —que nadie use nuestros endpoints abiertos como proxy gratis ni
// pruebe un secreto a fuerza bruta— y no agrega ninguna dependencia ni latencia. Si algún día hace
// falta un límite exacto, hay que mover el contador a un almacén compartido.

const contadores = new Map()

/** La IP del cliente según la cabecera que pone el proxy de Vercel; el primer valor es el real. */
export function ipDe(req) {
  const reenviada = req.headers?.['x-forwarded-for']
  const cruda = Array.isArray(reenviada) ? reenviada[0] : reenviada
  const primera = typeof cruda === 'string' ? cruda.split(',')[0].trim() : ''
  return primera || req.socket?.remoteAddress || 'desconocida'
}

/**
 * Si este pedido entra dentro del límite, y lo cuenta. `clave` separa los contadores por endpoint
 * (una IP puede consumir su cupo del BCRA sin gastar el de otro lado).
 *
 * Devuelve `{ permitido, restantes }`.
 */
export function dentroDelLimite(clave, { maximo, ventanaMs }, ahora = Date.now()) {
  // Limpieza oportunista: sin esto el Map crece con cada IP que pasó alguna vez y la instancia se
  // queda sin memoria con el tiempo.
  for (const [k, v] of contadores) {
    if (v.reinicia <= ahora) contadores.delete(k)
  }

  const actual = contadores.get(clave)
  if (!actual || actual.reinicia <= ahora) {
    contadores.set(clave, { usos: 1, reinicia: ahora + ventanaMs })
    return { permitido: true, restantes: maximo - 1 }
  }

  if (actual.usos >= maximo) return { permitido: false, restantes: 0 }

  actual.usos += 1
  return { permitido: true, restantes: maximo - actual.usos }
}

/** Sólo para los tests: deja los contadores como al arrancar. */
export function reiniciarLimites() {
  contadores.clear()
}
