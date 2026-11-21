// Adivinar a qué factura corrige cada nota de crédito importada.
//
// El Excel de ARCA no lo dice: trae la nota como un comprobante suelto, sin referencia al
// original. Pero el dato existe en la realidad, y sin él uno no puede pararse en una factura y
// ver qué quedó vivo de ella.
//
// Como es una inferencia y no un dato, la regla es conservadora: ante la duda no se vincula. Una
// nota sin vincular solo pierde una comodidad —el signo ya hace que reste en todos los cálculos—,
// mientras que una mal vinculada dice que una factura está anulada cuando no lo está. El error
// de más es caro y el de menos no.

import type { Factura } from './cfo'

/** Sin acentos ni mayúsculas: "DISTRIBUIDORA SUR S.A." y "Distribuidora Sur SA" son la misma. */
function normalizarNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const monedaDe = (f: Factura) => f.moneda ?? 'ARS'

/**
 * Las facturas a las que una nota podría corresponder: del mismo lado (una nota de venta corrige
 * una venta), de la misma contraparte, en la misma moneda y emitidas antes —una nota no puede
 * corregir algo que todavía no existía.
 */
export function candidatasParaNota(nota: Factura, facturas: Factura[]): Factura[] {
  const contraparte = normalizarNombre(nota.contraparte)
  return facturas.filter(
    (f) =>
      f.id !== nota.id &&
      f.tipoComprobante === 'factura' &&
      f.tipo === nota.tipo &&
      monedaDe(f) === monedaDe(nota) &&
      normalizarNombre(f.contraparte) === contraparte &&
      f.fecha <= nota.fecha,
  )
}

/** Cuánto de una factura ya está acreditado por notas vinculadas a ella. */
function yaAcreditado(factura: Factura, facturas: Factura[], vinculos: Map<string, string>): number {
  return facturas
    .filter((n) => n.tipoComprobante === 'nota_credito')
    .filter((n) => (vinculos.get(n.id) ?? n.comprobanteAsociadoId) === factura.id)
    .reduce((s, n) => s + n.monto, 0)
}

/**
 * A qué factura vincular una nota, o null si no está claro.
 *
 * Primero se busca una factura del mismo importe exacto: es la anulación total, el caso más
 * común y el único donde no hay nada que interpretar. Si no hay, se toma la más reciente anterior
 * que todavía tenga importe sin acreditar de sobra. Y si ninguna lo tiene —porque la nota es más
 * grande que lo que queda vivo— no se vincula: ahí ya no es una nota que corrige una factura
 * puntual, y elegir una sería inventar.
 */
export function sugerirVinculoNota(
  nota: Factura,
  facturas: Factura[],
  vinculos: Map<string, string> = new Map(),
): string | null {
  const candidatas = candidatasParaNota(nota, facturas)
  if (candidatas.length === 0) return null

  const exactas = candidatas.filter((f) => f.monto === nota.monto && yaAcreditado(f, facturas, vinculos) === 0)
  if (exactas.length > 0) {
    // Entre varias del mismo importe, la más reciente: es a la que uno le haría la nota.
    return [...exactas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0].id
  }

  const conSaldo = candidatas
    .filter((f) => f.monto - yaAcreditado(f, facturas, vinculos) >= nota.monto)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  return conSaldo[0]?.id ?? null
}

/**
 * Vincula las notas de crédito que todavía no tengan factura asociada. Devuelve las facturas con
 * el vínculo puesto, y cuántas se vincularon.
 *
 * Las notas se recorren de la más vieja a la más nueva para que cada una vea lo que acreditaron
 * las anteriores: dos notas sobre la misma factura no pueden apuntar las dos a ella si juntas se
 * pasan de su importe.
 */
export function vincularNotasDeCredito(facturas: Factura[]): { facturas: Factura[]; vinculadas: number } {
  const pendientes = facturas
    .filter((f) => f.tipoComprobante === 'nota_credito' && !f.comprobanteAsociadoId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (pendientes.length === 0) return { facturas, vinculadas: 0 }

  const vinculos = new Map<string, string>()
  for (const nota of pendientes) {
    const facturaId = sugerirVinculoNota(nota, facturas, vinculos)
    if (facturaId) vinculos.set(nota.id, facturaId)
  }
  if (vinculos.size === 0) return { facturas, vinculadas: 0 }

  return {
    facturas: facturas.map((f) => (vinculos.has(f.id) ? { ...f, comprobanteAsociadoId: vinculos.get(f.id) } : f)),
    vinculadas: vinculos.size,
  }
}
