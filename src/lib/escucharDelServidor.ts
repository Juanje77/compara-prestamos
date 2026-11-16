// La regla de oro al escuchar un documento de Firestore, en un solo lugar.
//
// El SDK contesta dos veces: primero con lo que tiene en la caché local, después con lo que
// confirmó el servidor. La respuesta de la caché puede venir vacía porque todavía no hubo ida y
// vuelta —no porque el documento no exista—, así que darla por buena muestra "no hay nada" y, peor,
// habilita el guardado con ese vacío encima de datos reales. Por eso solo se avisa con la
// confirmada.
//
// Lo que faltaba: `includeMetadataChanges`. Sin eso el SDK avisa solo cuando cambia el CONTENIDO,
// y pasar de "esto salió de la caché" a "esto lo confirmó el servidor" es un cambio de metadata.
// Para un documento que no existe en el servidor las dos respuestas dicen lo mismo —vacío—, así
// que la segunda nunca llegaba y quien esperaba esa confirmación se quedaba esperando para
// siempre. Es el caso de toda cuenta nueva, que todavía no tiene ninguno de sus documentos.
//
// Esta regla estaba escrita dos veces, en userSync y en plan, y le faltaba lo mismo a las dos.
// Ahora está una sola vez y tiene tests.

import type { DocumentData, DocumentReference, DocumentSnapshot, onSnapshot as OnSnapshot } from 'firebase/firestore'

/** Que el SDK avise también cuando lo único que cambió es de dónde salió el dato. */
export const OPCIONES_SNAPSHOT = { includeMetadataChanges: true } as const

/**
 * Escucha un documento y llama a `alLlegar` solo con snapshots confirmados por el servidor.
 * Devuelve la función para dejar de escuchar.
 */
export function escucharDelServidor<T extends DocumentData = DocumentData>(
  onSnapshot: typeof OnSnapshot,
  ref: DocumentReference<T>,
  alLlegar: (snap: DocumentSnapshot<T>) => void,
  alFallar: () => void,
): () => void {
  // El cast elige la sobrecarga con opciones: TypeScript, viendo cuatro argumentos, intenta
  // primero la que lleva (ref, onNext, onError, onCompletion) y se confunde.
  const escuchar = onSnapshot as (
    ref: DocumentReference<T>,
    opciones: typeof OPCIONES_SNAPSHOT,
    onNext: (snap: DocumentSnapshot<T>) => void,
    onError: () => void,
  ) => () => void
  return escuchar(
    ref,
    OPCIONES_SNAPSHOT,
    (snap) => {
      if (snap.metadata.fromCache) return
      alLlegar(snap)
    },
    alFallar,
  )
}
