// Segundo factor por mail, del lado del navegador.
//
// Acá no se decide nada de seguridad: todo lo resuelve el servidor y lo termina de exigir la regla
// de Firestore, que mira la marca del token. Este archivo solo identifica al dispositivo y habla
// con los endpoints.
import { auth } from './firebase'

const CLAVE_DISPOSITIVO = 'compara-prestamos.dispositivo'

/**
 * El identificador de este navegador. Es un valor al azar que se guarda local y se manda al
 * servidor, que solo conserva su hash. No identifica a la persona ni dice nada de ella: sirve
 * únicamente para que el servidor reconozca "este navegador ya pasó el código".
 *
 * Si no se puede guardar (modo privado, almacenamiento bloqueado), se devuelve uno nuevo cada vez
 * y el dispositivo nunca queda recordado — se pide el código siempre, que es el lado seguro.
 */
export function dispositivoId(): string {
  try {
    const guardado = localStorage.getItem(CLAVE_DISPOSITIVO)
    if (guardado && guardado.length >= 16) return guardado
    const nuevo = crypto.randomUUID()
    localStorage.setItem(CLAVE_DISPOSITIVO, nuevo)
    return nuevo
  } catch {
    return crypto.randomUUID()
  }
}

async function pedir<T>(ruta: string, cuerpo: Record<string, unknown>): Promise<T> {
  const usuario = auth?.currentUser
  if (!usuario) throw new Error('Tenés que iniciar sesión.')
  const respuesta = await fetch(ruta, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await usuario.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  })
  const datos = (await respuesta.json().catch(() => null)) as Record<string, unknown> | null
  if (!respuesta.ok) {
    throw new Error(typeof datos?.error === 'string' ? datos.error : 'No se pudo completar la operación.')
  }
  return datos as T
}

export interface EstadoMfa {
  /** false cuando el servidor todavía no tiene el segundo factor configurado. */
  configurado: boolean
  haceFaltaCodigo: boolean
}

/** Pregunta si este dispositivo ya está confiado. Si lo está, el servidor ya le renovó la marca
 * al token, así que hay que pedir uno nuevo para que el claim llegue actualizado. */
export async function estadoMfa(): Promise<EstadoMfa> {
  const estado = await pedir<EstadoMfa>('/api/mfa-estado', { dispositivoId: dispositivoId() })
  if (estado.configurado && !estado.haceFaltaCodigo) await refrescarToken()
  return estado
}

export function pedirCodigo(): Promise<{ enviado: boolean; mail: string }> {
  return pedir('/api/mfa-enviar-codigo', {})
}

export async function verificarCodigo(codigo: string, recordar: boolean): Promise<void> {
  await pedir('/api/mfa-verificar-codigo', { codigo, dispositivoId: dispositivoId(), recordar })
  await refrescarToken()
}

/** Fuerza un token nuevo para que traiga el claim recién puesto: sin esto, Firestore sigue viendo
 * el token viejo hasta que Firebase lo renueve solo, y las reglas rechazan todo mientras tanto. */
async function refrescarToken(): Promise<void> {
  await auth?.currentUser?.getIdToken(true)
}
