// Quién tiene derecho a la prueba gratis.
//
// La regla es "una prueba por usuario", y durante un tiempo estuvo implementada como "si existe el
// documento de plan, no hay prueba". No es lo mismo: `crear-suscripcion` escribe ese documento con
// estado `pendiente` apenas alguien toca un plan, antes de pagar nada. Quien miraba el checkout y
// no lo completaba se quedaba sin prueba para siempre.
//
// Ahora la decisión mira lo que de verdad importa: si ya se le otorgó una prueba alguna vez, o si
// tiene (o tuvo) una suscripción de verdad. Un `pendiente` suelto es una intención abandonada, no
// una suscripción.

/** Estados que corresponden a una suscripción real, pagada o que lo estuvo. */
const ESTADOS_DE_SUSCRIPCION = ['activo', 'pausado', 'cancelado']

export function puedeOtorgarsePrueba(datosPlan) {
  if (!datosPlan) return true

  // Marcas de que ya tuvo su prueba. `pruebaOtorgadaEn` es la definitiva y sobrevive a que el
  // webhook después pise el plan; las otras dos cubren a quienes la recibieron antes de que
  // existiera esa marca.
  if (datosPlan.pruebaOtorgadaEn || datosPlan.esPrueba || datosPlan.pruebaFin) return false

  if (ESTADOS_DE_SUSCRIPCION.includes(datosPlan.estado)) return false

  return true
}

/** Los campos de una prueba recién otorgada. Se guardan con merge para no borrar lo que hubiera
 * dejado un checkout a medias, como el id de preapproval de Mercado Pago. */
export function datosDePrueba(duracionDias, ahora = new Date()) {
  const fin = new Date(ahora.getTime() + duracionDias * 24 * 60 * 60 * 1000)
  return {
    plan: 'full',
    estado: 'activo',
    esPrueba: true,
    pruebaFin: fin.toISOString(),
    pruebaOtorgadaEn: ahora.toISOString(),
    actualizadoEn: ahora.toISOString(),
  }
}
