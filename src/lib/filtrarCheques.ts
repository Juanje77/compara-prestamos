// Buscar y filtrar cheques.
//
// Una empresa con chequera propia junta cientos de cheques por año, y la lista entera deja de
// servir: para encontrar uno hay que recorrerla a ojo. Acá vive el filtro, aparte de la pantalla,
// porque la parte que puede fallar en silencio —que una búsqueda esconda un cheque que sí
// correspondía— se prueba mejor sin navegador.

import type { Cheque, TipoCheque } from './cfo'

export type FiltroTipoCheque = 'todos' | TipoCheque

/** Sin acentos, sin mayúsculas y sin puntos: así "Nacion" encuentra "Nación" y "1.234" encuentra
 * el cheque número 1234, que es como la gente los escribe de memoria. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\s]+/g, ' ')
    .trim()
}

/**
 * Los cheques que hay que mostrar, ordenados por fecha de cobro.
 *
 * La búsqueda mira todo lo que uno recuerda de un cheque: a nombre de quién está, el banco, el
 * número, a quién se lo endosó y el importe. El importe entra como texto para que "400" encuentre
 * tanto $400.000 como $4.000 — escribir más dígitos achica la lista, que es como se busca de
 * verdad.
 */
export function filtrarCheques(
  cheques: Cheque[],
  { tipo = 'todos', busqueda = '' }: { tipo?: FiltroTipoCheque; busqueda?: string } = {},
): Cheque[] {
  const q = normalizar(busqueda)
  return cheques
    .filter((c) => tipo === 'todos' || c.tipo === tipo)
    .filter((c) => {
      if (!q) return true
      const campos = [c.contraparte, c.banco, c.numero ?? '', c.endosadoA ?? '', String(Math.round(c.monto))]
      return campos.some((campo) => normalizar(campo).includes(q))
    })
    .sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))
}
