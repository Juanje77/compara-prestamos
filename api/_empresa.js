// Usuarios de la empresa: lo que se puede decidir sin tocar la base ni la red.
//
// Vive aparte del endpoint para poder testearlo. Lo que más importa acá es que la lista de
// bloques que termina en el token sea exactamente la que corresponde a los módulos asignados: ese
// array es lo que leen las reglas de Firestore, así que un bloque de más es un sueldo que ve
// quien no debe.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Qué bloques necesita cada módulo. Es una copia de BLOQUES_POR_MODULO en src/lib/permisos.ts:
 * el backend es JavaScript suelto y no puede importar el TypeScript del front. La copia está
 * atada con un test (_empresa.test.js) que compara las dos tablas y falla si se separan, que es
 * la única forma de que duplicarla no termine en permisos distintos de cada lado.
 */
export const BLOQUES_POR_MODULO = {
  dashboard: ['negocio', 'comercial', 'tesoreria', 'sueldos'],
  facturas: ['comercial'],
  lectorFacturas: ['comercial'],
  puntoDeVenta: ['comercial', 'tesoreria'],
  facturacionElectronica: ['comercial', 'impuestos'],
  ingresosGastos: ['comercial'],
  cobranzas: ['comercial', 'tesoreria', 'sueldos', 'semana'],
  cuentasCorrientes: ['comercial', 'tesoreria'],
  remitos: ['comercial'],
  margenes: ['comercial', 'sueldos'],
  sueldos: ['sueldos', 'tesoreria'],
  stock: ['comercial'],
  tesoreria: ['tesoreria', 'comercial'],
  proveedores: ['comercial'],
  clientes: ['comercial'],
  presupuesto: ['negocio', 'comercial', 'sueldos'],
  cheques: ['tesoreria', 'comercial'],
  iva: ['comercial', 'impuestos'],
  iibb: ['comercial', 'impuestos'],
  monotributo: ['comercial', 'impuestos'],
  patrimonio: ['negocio'],
  inversiones: ['negocio', 'tesoreria'],
  backup: ['negocio', 'comercial', 'tesoreria', 'sueldos', 'impuestos'],
}

/** Cuánto vale una invitación. Una semana: tiempo de sobra para que el empleado la abra, y poco
 * para que un mail viejo reenviado años después siga sirviendo para entrar. */
export const VIGENCIA_INVITACION_MS = 7 * 24 * 60 * 60 * 1000

/** Tope de usuarios por empresa. No es una limitación técnica, es un freno: sin tope, una cuenta
 * invita a mil direcciones y nos usa de servidor de mails. */
export const MAX_MIEMBROS = 20

/**
 * Deja la lista de módulos en algo confiable: sólo los que existen, sin repetidos y ordenados.
 * Lo que venga del navegador no se guarda tal cual — un módulo inventado en la lista no haría
 * nada hoy, pero mañana podría coincidir con uno nuevo y dar un acceso que nadie asignó.
 */
export function normalizarModulos(lista) {
  if (!Array.isArray(lista)) return []
  const validos = new Set(Object.keys(BLOQUES_POR_MODULO))
  return [...new Set(lista.filter((m) => typeof m === 'string' && validos.has(m)))].sort()
}

/** Los bloques que necesita alguien con estos módulos. Es lo que van a leer las reglas. */
export function bloquesDe(modulos) {
  const bloques = new Set()
  for (const m of modulos) for (const b of BLOQUES_POR_MODULO[m] ?? []) bloques.add(b)
  return [...bloques].sort()
}

/** Los mails se comparan en minúsculas y sin espacios: el usuario que acepta tipea su dirección
 * al registrarse y nadie escribe siempre igual. */
export function normalizarEmail(valor) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : ''
}

export function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)
}

/**
 * El código que viaja por mail. Lleva adentro a quién pertenece la invitación para que el
 * servidor la encuentre sin recorrer toda la base, y un secreto que es lo único que prueba que
 * quien lo presenta recibió el mail. El punto como separador es seguro: los uid de Firebase y los
 * ids de documento no lo usan.
 */
export function armarCodigo(empresaId, invitacionId, secreto) {
  return `${empresaId}.${invitacionId}.${secreto}`
}

export function partirCodigo(codigo) {
  if (typeof codigo !== 'string') return null
  const partes = codigo.trim().split('.')
  if (partes.length !== 3) return null
  const [empresaId, invitacionId, secreto] = partes
  if (!empresaId || !invitacionId || secreto.length < 24) return null
  return { empresaId, invitacionId, secreto }
}

export function generarSecreto() {
  return randomBytes(18).toString('hex')
}

/** El secreto se guarda hasheado con el pepper, igual que el código del segundo factor: si
 * alguien se lleva la base, los hashes no le sirven para entrar. */
export function hashSecreto(secreto, pepper) {
  return createHash('sha256').update(`${pepper}:${secreto}`).digest('hex')
}

/** Comparación en tiempo constante, para que el tiempo de respuesta no filtre cuántos caracteres
 * del secreto acertó quien lo está probando. */
export function hashCoincide(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** Si una invitación todavía sirve. Motivo explícito para poder decirle al usuario por qué no. */
export function estadoInvitacion(invitacion, ahora = Date.now()) {
  if (!invitacion) return 'inexistente'
  if (invitacion.aceptadaEn) return 'usada'
  if (invitacion.revocadaEn) return 'revocada'
  if (typeof invitacion.vence === 'number' && invitacion.vence < ahora) return 'vencida'
  return 'vigente'
}

/**
 * Los claims que lleva el token de un empleado. `bloques` está calculado y no viene del
 * navegador: es lo que las reglas comparan, así que es la pieza que no puede ser editable desde
 * afuera. `mfaHasta` se preserva porque los claims se pisan enteros al escribirlos — perderlo
 * dejaría al usuario afuera hasta que vuelva a pasar el segundo factor.
 */
export function claimsDeMiembro(claimsActuales, empresaId, modulos) {
  const { mfaHasta } = claimsActuales ?? {}
  const claims = { empresaId, modulos, bloques: bloquesDe(modulos) }
  if (typeof mfaHasta === 'number') claims.mfaHasta = mfaHasta
  return claims
}

/** Los claims de alguien que deja de ser miembro: se le saca la empresa y nada más. */
export function claimsSinEmpresa(claimsActuales) {
  const { mfaHasta } = claimsActuales ?? {}
  const claims = { empresaId: null, modulos: null, bloques: null }
  if (typeof mfaHasta === 'number') claims.mfaHasta = mfaHasta
  return claims
}

/**
 * El mail de invitación. A diferencia del de segundo factor, este sí lleva un link: no es una
 * confirmación de algo que el usuario estaba haciendo, es una puerta a la que todavía no llegó, y
 * pedirle que copie un código de 50 caracteres a mano es pedirle que no entre.
 */
export function plantillaInvitacion({ codigo, empresa, url }) {
  const deQuien = empresa ? ` a ${empresa}` : ''
  const asunto = `Te invitaron a FinCorp${deQuien}`
  const texto = [
    `Te crearon un usuario en FinCorp${deQuien}.`,
    '',
    'Para entrar, abrí este link y creá tu contraseña con esta misma dirección de mail:',
    url,
    '',
    'La invitación vence en 7 días y sirve una sola vez.',
    'Si no esperabas este mail, ignoralo: sin aceptarlo no se crea ninguna cuenta.',
    '',
    `Código: ${codigo}`,
  ].join('\n')

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px">
  <p style="font-size:15px;color:#334">Te crearon un usuario en FinCorp${deQuien}.</p>
  <p style="font-size:14px;color:#556">Para entrar, abrí el link y creá tu contraseña con esta misma dirección de mail.</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#0a1f44;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Aceptar la invitación</a></p>
  <p style="font-size:13px;color:#889">La invitación vence en 7 días y sirve una sola vez. Si no esperabas este mail, ignoralo: sin aceptarlo no se crea ninguna cuenta.</p>
</div>`

  return { asunto, texto, html }
}
