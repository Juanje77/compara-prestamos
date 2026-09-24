// Segundo factor por mail: generación, guardado y verificación del código.
//
// Acá vive la política, aparte de los endpoints, porque es la parte que decide si alguien entra y
// se testea sin red ni base. El resto (mandar el mail, escribir en Firestore) es plomería.
//
// Tres decisiones que valen la pena explicar:
//
// 1. El código no se guarda: se guarda su hash. Si alguien lee la base, no puede entrar con lo que
//    encuentre. El pepper del entorno hace que ese hash tampoco sirva fuera de este servidor.
// 2. Es de un solo uso. Un código que ya sirvió una vez y sigue sirviendo es una contraseña
//    permanente que viajó por mail sin cifrar.
// 3. Los intentos se cuentan del lado del servidor y el bloqueo es por tiempo, no por siempre: un
//    bloqueo permanente lo puede disparar cualquiera con el mail de la víctima y convertirse en
//    una forma de dejarla afuera de su propia cuenta.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

/** Cuántos dígitos tiene el código. Seis es lo habitual y, con el tope de intentos de abajo,
 * deja la probabilidad de acertar a ciegas en 5 en un millón. */
export const LARGO_CODIGO = 6

/** Cuánto vale un código desde que se manda. */
export const VENCIMIENTO_MS = 10 * 60 * 1000

/** Cuántos intentos fallidos se toleran antes de bloquear. */
export const MAX_INTENTOS = 5

/** Cuánto dura el bloqueo tras agotar los intentos. */
export const BLOQUEO_MS = 15 * 60 * 1000

/** Cuántos códigos se pueden pedir por hora, para que reenviar no sea una forma de resetear los
 * intentos ni de llenarle la casilla a alguien. */
export const MAX_ENVIOS_POR_HORA = 5

export function generarCodigo() {
  return String(randomInt(0, 10 ** LARGO_CODIGO)).padStart(LARGO_CODIGO, '0')
}

/**
 * El hash que se guarda. Lleva el uid adentro para que el mismo código en dos cuentas distintas dé
 * hashes distintos, y el pepper del entorno para que el hash no se pueda recalcular por fuera.
 */
export function hashCodigo(codigo, uid, pepper) {
  return createHash('sha256').update(`${pepper ?? ''}:${uid}:${codigo}`).digest('hex')
}

/** Comparación en tiempo constante, para no filtrar cuántos caracteres coincidían. */
export function hashesIguales(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8')
  const bufB = Buffer.from(String(b ?? ''), 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Si el texto que mandó el usuario tiene la forma de un código, antes de gastar una consulta. */
export function formatoDeCodigoValido(codigo) {
  return new RegExp(`^\\d{${LARGO_CODIGO}}$`).test(String(codigo ?? ''))
}

/**
 * Qué hacer con un intento de verificación, dado lo que hay guardado.
 *
 * Devuelve el resultado y el registro como queda después del intento, para que el endpoint solo
 * lo escriba. Los resultados posibles:
 * - "sin-codigo": nunca se pidió uno, o ya se usó.
 * - "bloqueado": se agotaron los intentos y todavía corre el bloqueo.
 * - "vencido": el código existió pero pasó su ventana.
 * - "incorrecto": no coincide; quedan intentos.
 * - "ok": coincide.
 */
export function verificarIntento(registro, hashRecibido, ahora = Date.now()) {
  if (registro?.bloqueadoHasta && registro.bloqueadoHasta > ahora) {
    return { resultado: 'bloqueado', registro, esperaMs: registro.bloqueadoHasta - ahora }
  }
  if (!registro?.hash) {
    return { resultado: 'sin-codigo', registro: registro ?? null }
  }
  if (!registro.venceEn || registro.venceEn <= ahora) {
    // El código vencido se borra: así un reintento no lo revive ni suma intentos contra él.
    return { resultado: 'vencido', registro: { ...registro, hash: null, venceEn: null } }
  }

  if (hashesIguales(registro.hash, hashRecibido)) {
    // De un solo uso: se borra al acertar.
    return {
      resultado: 'ok',
      registro: { ...registro, hash: null, venceEn: null, intentos: 0, bloqueadoHasta: null },
    }
  }

  const intentos = (registro.intentos ?? 0) + 1
  if (intentos >= MAX_INTENTOS) {
    return {
      resultado: 'bloqueado',
      registro: { ...registro, hash: null, venceEn: null, intentos: 0, bloqueadoHasta: ahora + BLOQUEO_MS },
      esperaMs: BLOQUEO_MS,
    }
  }
  return {
    resultado: 'incorrecto',
    registro: { ...registro, intentos },
    intentosRestantes: MAX_INTENTOS - intentos,
  }
}

/** Si se puede mandar otro código, o hay que esperar. Cuenta los envíos de la última hora. */
export function puedeEnviarCodigo(registro, ahora = Date.now()) {
  if (registro?.bloqueadoHasta && registro.bloqueadoHasta > ahora) return false
  const envios = (registro?.envios ?? []).filter((t) => ahora - t < 60 * 60 * 1000)
  return envios.length < MAX_ENVIOS_POR_HORA
}

/** El registro como queda después de mandar un código nuevo. */
export function registroConCodigoNuevo(registro, hash, ahora = Date.now()) {
  const envios = [...(registro?.envios ?? []).filter((t) => ahora - t < 60 * 60 * 1000), ahora]
  return { hash, venceEn: ahora + VENCIMIENTO_MS, intentos: 0, bloqueadoHasta: null, envios }
}

// --- Dispositivos confiados -------------------------------------------------------------------
//
// El segundo factor se pide una vez por dispositivo y después ese dispositivo queda recordado por
// un tiempo. El navegador guarda un identificador al azar y lo manda en cada arranque; acá se
// guarda solo su hash, por lo mismo que el código: si alguien lee la base, no puede hacerse pasar
// por un dispositivo ya confiado.
//
// Importante y sin vueltas: recordar el dispositivo baja la seguridad a cambio de comodidad. Quien
// tenga la contraseña Y el navegador del dueño entra sin código. Contra eso protege la contraseña,
// no el segundo factor. Lo que sí corta es el caso común: alguien que consiguió la contraseña y
// entra desde otra máquina.

/** Cuánto se recuerda un dispositivo antes de volver a pedirle el código. */
export const CONFIANZA_DISPOSITIVO_MS = 30 * 24 * 60 * 60 * 1000

/** Cuántos dispositivos se recuerdan a la vez. Más que esto y "dispositivo nuevo" deja de
 * significar algo: se van cayendo los más viejos. */
export const MAX_DISPOSITIVOS = 10

export function hashDispositivo(dispositivoId, uid, pepper) {
  return createHash('sha256').update(`${pepper ?? ''}:dispositivo:${uid}:${dispositivoId}`).digest('hex')
}

/** Si este dispositivo ya pasó el segundo factor y la confianza sigue vigente. */
export function dispositivoConfiado(registro, hashDisp, ahora = Date.now()) {
  return (registro?.dispositivos ?? []).some((d) => d.hash === hashDisp && d.venceEn > ahora)
}

/**
 * El registro con este dispositivo recordado. Renueva el vencimiento si ya estaba, descarta los
 * vencidos y se queda con los más nuevos si son demasiados.
 */
export function registroConDispositivo(registro, hashDisp, ahora = Date.now()) {
  const vigentes = (registro?.dispositivos ?? []).filter((d) => d.venceEn > ahora && d.hash !== hashDisp)
  const dispositivos = [...vigentes, { hash: hashDisp, venceEn: ahora + CONFIANZA_DISPOSITIVO_MS }]
    .sort((a, b) => b.venceEn - a.venceEn)
    .slice(0, MAX_DISPOSITIVOS)
  return { ...(registro ?? {}), dispositivos }
}

/** Saca todos los dispositivos recordados: el botón de "cerrar sesión en todos lados". */
export function registroSinDispositivos(registro) {
  return { ...(registro ?? {}), dispositivos: [] }
}
