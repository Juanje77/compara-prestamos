// Qué sector le corresponde a una contraparte, según cómo se la clasificó antes.
//
// Clasificar por sector es el trabajo más aburrido de cargar comprobantes, y el que primero se
// abandona: con doscientas facturas importadas de golpe, nadie las etiqueta una por una. Pero sin
// eso, Márgenes por sector no dice nada.
//
// El mismo proveedor casi siempre pertenece al mismo sector, así que el dato ya está: solo hay
// que mirarlo. Esto no inventa una clasificación, repite la que la persona ya hizo.

import type { Factura } from './cfo'

/** Sin acentos ni puntuación: "Aceros del Sur S.R.L." y "ACEROS DEL SUR SRL" son el mismo. */
export function clave(contraparte: string): string {
  return contraparte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * El sector con el que más veces se cargó a esta contraparte, o null si nunca se le puso uno.
 *
 * Gana el más repetido y no el más reciente: una clasificación equivocada una vez no debería
 * cambiar el criterio de todas las que vienen. Entre dos empatados gana el de la factura más
 * nueva, que ahí sí es la señal de que el criterio cambió.
 *
 * Se mira solo el mismo lado —emitidas con emitidas, recibidas con recibidas—: un mismo nombre
 * puede ser cliente de una división y proveedor de otra.
 */
export function sectorHabitualDe(
  contraparte: string,
  tipo: Factura['tipo'],
  facturas: Factura[],
): string | null {
  const buscada = clave(contraparte)
  if (!buscada) return null

  const conteo = new Map<string, { veces: number; ultima: string }>()
  for (const f of facturas) {
    if (f.tipo !== tipo || !f.sectorId || clave(f.contraparte) !== buscada) continue
    const previo = conteo.get(f.sectorId)
    conteo.set(f.sectorId, {
      veces: (previo?.veces ?? 0) + 1,
      ultima: previo && previo.ultima > f.fecha ? previo.ultima : f.fecha,
    })
  }
  if (conteo.size === 0) return null

  const [mejor] = [...conteo.entries()].sort(
    ([, a], [, b]) => b.veces - a.veces || b.ultima.localeCompare(a.ultima),
  )
  return mejor[0]
}

/**
 * Les pone sector a los comprobantes que no lo traen, según cómo se clasificó antes a cada
 * contraparte. Devuelve cuántos pudo clasificar.
 *
 * Los que ya traen sector no se tocan, y los de una contraparte nueva quedan sin sector: no hay
 * de dónde deducirlo, y ponerle uno al azar sería peor que dejarlo vacío.
 */
export function asignarSectorHabitual<T extends { tipo: Factura['tipo']; contraparte: string; sectorId?: string }>(
  nuevas: T[],
  yaCargadas: Factura[],
): { comprobantes: T[]; clasificados: number } {
  let clasificados = 0
  const comprobantes = nuevas.map((f) => {
    if (f.sectorId) return f
    const sectorId = sectorHabitualDe(f.contraparte, f.tipo, yaCargadas)
    if (!sectorId) return f
    clasificados++
    return { ...f, sectorId }
  })
  return { comprobantes, clasificados }
}
