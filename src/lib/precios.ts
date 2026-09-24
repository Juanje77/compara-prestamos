// Los precios de los planes, en un solo lugar.
//
// Antes vivían duplicados: los números en PlanesEmpresa y los mismos importes escritos a mano en
// la landing. Actualizar uno y olvidarse del otro es cuestión de tiempo, y un precio distinto en
// la home que en el checkout es de los errores que más caros salen.
//
// Falta un lugar más, que desde acá no se puede alcanzar: api/crear-suscripcion.js, que es el que
// le pasa el importe a Mercado Pago. Vive en el backend y no puede importar este archivo, así que
// al cambiar un precio hay que tocar los dos — si no, se muestra uno y se cobra otro.

import type { PlanTier } from './plan'

export interface PrecioPlan {
  /** Lo que se cobra hoy. */
  precio: number
  /** El precio de lista, para mostrar tachado al lado del de promoción. Se omite cuando no hay
   * promoción vigente: un precio tachado tiene que ser uno que realmente se cobre cuando la
   * promoción termine, no un número inventado para que el otro parezca más bajo. */
  precioLista?: number
}

export const PRECIOS: Record<PlanTier, PrecioPlan> = {
  basico: { precio: 20000, precioLista: 30000 },
  premium: { precio: 50000, precioLista: 75000 },
  full: { precio: 100000, precioLista: 150000 },
}

/** El nombre de la promoción vigente, que se muestra junto al precio tachado. */
export const ETIQUETA_PROMOCION = 'Precio de lanzamiento'

/** El descuento redondeado al entero, para el cartelito de "X% OFF". Cero si no hay promoción. */
export function porcentajeDescuento(p: PrecioPlan): number {
  if (!p.precioLista || p.precioLista <= p.precio) return 0
  return Math.round((1 - p.precio / p.precioLista) * 100)
}

/** Cuánto se ahorra por mes con la promoción. Cero si no hay promoción. */
export function ahorroMensual(p: PrecioPlan): number {
  if (!p.precioLista || p.precioLista <= p.precio) return 0
  return p.precioLista - p.precio
}
