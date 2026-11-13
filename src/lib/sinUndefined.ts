// Firestore rechaza `undefined`: una escritura que lo lleve falla entera con "Unsupported field
// value: undefined" y el usuario pierde todo lo que cargó en esa sesión.
//
// En JavaScript un campo opcional sin valor se escribe solo: `{ concepto }` con `concepto`
// undefined deja la clave puesta, apuntando a undefined. Es natural de escribir, pasa el
// typecheck —el tipo dice `concepto?: string`— y no se nota hasta que alguien deja el campo
// vacío en producción. Por eso la limpieza va en la capa que guarda y no en cada pantalla: son
// veinte pantallas y una sola puerta de salida.
//
// Un campo sin valor y un campo ausente significan lo mismo en todo el sistema, así que sacarlo
// no pierde información. Al leerlo de vuelta, la clave simplemente no está, que es lo que ya pasa
// con todo lo que se guardó antes de que ese campo existiera.

/** El mismo dato, sin ninguna clave que valga `undefined`, en cualquier nivel de anidamiento. */
export function sinUndefined<T>(valor: T): T {
  // Dentro de un arreglo Firestore también rechaza undefined, y ahí no hay clave que sacar. Se
  // descarta el elemento: un elemento sin valor no dice nada, y perder un lugar del arreglo es
  // mejor que perder la escritura completa.
  if (Array.isArray(valor)) return valor.filter((v) => v !== undefined).map((v) => sinUndefined(v)) as unknown as T
  if (valor === null || typeof valor !== 'object') return valor
  // Solo se recorren los objetos planos. Un Date o un Timestamp de Firestore se guardan tal cual:
  // recorrerlos campo por campo los desarmaría.
  const proto = Object.getPrototypeOf(valor)
  if (proto !== Object.prototype && proto !== null) return valor

  const limpio: Record<string, unknown> = {}
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (v === undefined) continue
    limpio[clave] = sinUndefined(v)
  }
  return limpio as T
}
