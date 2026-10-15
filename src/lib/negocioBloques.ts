// Partir el negocio en bloques para guardarlo, y volver a unirlo para usarlo.
//
// El resto del sistema sigue viendo un único objeto con todo adentro: esta es la única capa que
// sabe que en Firestore vive partido en cinco documentos. Así los permisos por módulo pueden ser
// reales (ver permisos.ts) sin que haya que reescribir las veinte pantallas.
//
// Las dos funciones son inversas y hay un test que lo verifica sobre un negocio completo. Es la
// garantía que importa: si partir y unir no devuelve exactamente lo mismo, se pierden datos de
// alguien.

import { CAMPOS_POR_BLOQUE, type BloqueDatos } from './permisos'

export const BLOQUES: BloqueDatos[] = Object.keys(CAMPOS_POR_BLOQUE) as BloqueDatos[]

/** A qué bloque pertenece cada campo, dado vuelta una sola vez en vez de buscar en cada pasada. */
const BLOQUE_DE_CAMPO: Record<string, BloqueDatos> = Object.fromEntries(
  BLOQUES.flatMap((bloque) => CAMPOS_POR_BLOQUE[bloque].map((campo) => [campo, bloque])),
)

export type ContenidoBloque = Record<string, unknown>
export type BloquesNegocio = Partial<Record<BloqueDatos, ContenidoBloque>>

/**
 * Reparte los campos del negocio en sus bloques.
 *
 * Un campo que no esté en el mapa se iría sin guardar, así que en vez de descartarlo en silencio
 * va a `negocio`, que es el bloque general. Es el lado seguro: preferimos que un dato nuevo quede
 * accesible de más y no que desaparezca. El test de permisos.ts está para que ese caso no llegue
 * a producción.
 */
export function partirNegocio(negocio: Record<string, unknown>): BloquesNegocio {
  const bloques: BloquesNegocio = {}
  for (const [campo, valor] of Object.entries(negocio)) {
    if (valor === undefined) continue
    const bloque = BLOQUE_DE_CAMPO[campo] ?? 'negocio'
    bloques[bloque] = { ...(bloques[bloque] ?? {}), [campo]: valor }
  }
  return bloques
}

/**
 * Vuelve a armar el negocio con los bloques que haya. Los que falten —porque el empleado no tiene
 * permiso para leerlos, o porque todavía no se guardó ninguno— simplemente no aportan campos, y
 * quien reciba el resultado aplica sus valores por defecto como siempre.
 */
export function unirBloques(bloques: BloquesNegocio): Record<string, unknown> {
  const negocio: Record<string, unknown> = {}
  for (const bloque of BLOQUES) Object.assign(negocio, bloques[bloque] ?? {})
  return negocio
}

/**
 * Cuáles de los bloques cambiaron respecto de los últimos guardados, para escribir solo esos.
 * Firestore cobra por escritura: guardar los cinco en cada tecla sería multiplicar por cinco el
 * costo y el tráfico sin ninguna ganancia.
 */
export function bloquesQueCambiaron(nuevos: BloquesNegocio, previos: BloquesNegocio | null): BloqueDatos[] {
  if (!previos) return BLOQUES.filter((b) => nuevos[b] !== undefined)
  return BLOQUES.filter((b) => JSON.stringify(nuevos[b] ?? null) !== JSON.stringify(previos[b] ?? null))
}
