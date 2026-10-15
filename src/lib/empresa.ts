// El acceso de quien está logueado: ¿es el dueño de la cuenta, o un empleado de una empresa?
//
// La respuesta sale de los *custom claims* del token de Firebase, que escribe el servidor al
// aceptar la invitación. Es importante entender qué es esto y qué no:
//
// - Lo que hay acá NO es la seguridad. Un empleado puede editar este archivo en su navegador y
//   decir que tiene todos los módulos. Lo único que conseguiría es ver pantallas vacías: los
//   datos los sirve Firestore, y Firestore mira el token firmado, no esta pantalla.
// - Lo que hay acá es la comodidad: mostrarle solo lo suyo, y no pedirle a la base documentos
//   que le va a rechazar.
//
// La demora que conviene conocer: los claims viven en el token, y un token ya emitido no se
// entera de un cambio hasta que se renueva (hasta una hora, o al instante con `refrescar`). Si el
// dueño le saca un módulo a alguien, el cambio tarda — en la pantalla. En la base es inmediato
// para todo lo que el token nuevo ya no autorice… también cuando se renueve. Por eso dar de baja
// a alguien además le revoca las sesiones del lado del servidor.

import type { User } from 'firebase/auth'
import { auth } from './firebase'
import { BLOQUES } from './negocioBloques'
import type { BloqueDatos, Modulo } from './permisos'

export interface AccesoEmpresa {
  /** True si es el titular de la cuenta: ve todo y administra los usuarios. */
  esDueno: boolean
  /** De quién son los datos que hay que leer. Para el dueño, su propio uid; para un empleado, el
   * del dueño. Todo lo que hoy usa `user.uid` para ir a Firestore tiene que usar esto. */
  empresaId: string
  /** Los módulos asignados, o null si es el dueño (que los tiene todos). */
  modulos: Modulo[] | null
  /** Los bloques que puede leer. El dueño, todos. */
  bloques: BloqueDatos[]
}

/** El acceso de un dueño: su cuenta, todo abierto. */
export function accesoDeDueno(uid: string): AccesoEmpresa {
  return { esDueno: true, empresaId: uid, modulos: null, bloques: BLOQUES }
}

/**
 * Arma el acceso a partir de los claims del token. Se valida lo que viene: un claim con forma
 * rara no debería dejar la app en un estado a medias, y ante la duda se trata como dueño de su
 * propia cuenta, que es lo que era antes de que esto existiera.
 */
export function accesoDesdeClaims(uid: string, claims: Record<string, unknown> | undefined): AccesoEmpresa {
  const empresaId = claims?.empresaId
  if (typeof empresaId !== 'string' || !empresaId || empresaId === uid) return accesoDeDueno(uid)

  const bloques = Array.isArray(claims?.bloques)
    ? (claims.bloques as unknown[]).filter((b): b is BloqueDatos => BLOQUES.includes(b as BloqueDatos))
    : []
  const modulos = Array.isArray(claims?.modulos)
    ? (claims.modulos as unknown[]).filter((m): m is Modulo => typeof m === 'string')
    : []

  return { esDueno: false, empresaId, modulos, bloques }
}

/**
 * Lee el acceso del usuario logueado. `refrescar` pide un token nuevo al servidor: se usa justo
 * después de aceptar una invitación, porque el token que tiene en la mano todavía es el de antes
 * y sin renovarlo la app seguiría mostrándolo como dueño de una cuenta vacía.
 */
export async function leerAcceso(usuario: User, refrescar = false): Promise<AccesoEmpresa> {
  try {
    const { claims } = await usuario.getIdTokenResult(refrescar)
    return accesoDesdeClaims(usuario.uid, claims as Record<string, unknown>)
  } catch {
    // Sin red no se puede renovar el token. Tratarlo como dueño de su propia cuenta es el lado
    // seguro: ve sus datos (vacíos si es empleado) y no los de nadie más.
    return accesoDeDueno(usuario.uid)
  }
}

/** Las solapas del sistema: los módulos asignables, más dos que no lo son. */
export type Seccion = Modulo | 'usuarios' | 'ayuda'

/**
 * Si una solapa se le muestra a quien está mirando. El dueño ve todo; un empleado, solo sus
 * módulos, más Ayuda, que no le niega nada a nadie. Usuarios es del dueño y nunca se asigna: si
 * un empleado pudiera administrar usuarios, se asignaría los sueldos solo.
 *
 * Esto no es seguridad —se puede editar en el navegador— es no ofrecerle pantallas que le van a
 * aparecer vacías porque Firestore le va a negar los datos.
 */
export function puedeVerSeccion(acceso: AccesoEmpresa, seccion: Seccion): boolean {
  if (acceso.esDueno) return true
  if (seccion === 'usuarios') return false
  if (seccion === 'ayuda') return true
  return (acceso.modulos ?? []).includes(seccion)
}

export interface MiembroEmpresa {
  uid: string
  email: string
  modulos: Modulo[]
  bloques: BloqueDatos[]
  creadoEn?: number
  actualizadoEn?: number
}

export interface InvitacionPendiente {
  id: string
  email: string
  modulos: Modulo[]
  creadaEn: number
  vence: number
}

async function pedir<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const usuario = auth?.currentUser
  if (!usuario) throw new Error('Tenés que iniciar sesión.')
  const respuesta = await fetch('/api/empresa', {
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

/** Crea la invitación y le manda el mail. Si el mail no sale, devuelve el link para pasarlo a mano. */
export function invitarUsuario(
  email: string,
  modulos: Modulo[],
): Promise<{ invitacionId: string; enviado: boolean; url?: string }> {
  return pedir({ accion: 'invitar', email, modulos })
}

export function listarUsuarios(): Promise<{ miembros: MiembroEmpresa[]; invitaciones: InvitacionPendiente[] }> {
  return pedir({ accion: 'listar' })
}

export function cambiarModulos(uid: string, modulos: Modulo[]): Promise<{ modulos: Modulo[] }> {
  return pedir({ accion: 'cambiar', uid, modulos })
}

export function quitarUsuario(uid: string): Promise<{ dadoDeBaja: boolean }> {
  return pedir({ accion: 'quitar', uid })
}

/** Acepta la invitación con el código del mail y devuelve el acceso ya renovado. */
export async function aceptarInvitacion(codigo: string): Promise<AccesoEmpresa> {
  await pedir({ accion: 'aceptar', codigo })
  const usuario = auth?.currentUser
  if (!usuario) throw new Error('Tenés que iniciar sesión.')
  return leerAcceso(usuario, true)
}

/** El código de invitación que viene en la URL (`?invitacion=...`), si lo hay. */
export function invitacionEnLaUrl(busqueda: string): string | null {
  const codigo = new URLSearchParams(busqueda).get('invitacion')
  return codigo && codigo.trim() ? codigo.trim() : null
}
