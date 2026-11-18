// La capa que pasa todo a pesos antes de los cálculos.
//
// La alternativa era enseñarle a cada uno de los cincuenta cálculos del sistema a manejar dos
// monedas. Eso es tocar cincuenta lugares y olvidarse de tres, que es exactamente cómo aparece
// un total mal sumado meses después.
//
// Acá es al revés: las pantallas donde se carga y se corrige siguen trabajando en la moneda de
// cada cosa, y los cálculos reciben todo ya pasado a pesos. Ninguno de ellos se entera de que
// existen los dólares.
//
// Lo que está en pesos (o sin moneda declarada, que es todo lo cargado antes de que esto
// existiera) pasa tal cual: la conversión no puede cambiar un solo número de los que ya había.

import type { CuentaBancaria } from './cfo'
import { aPesos, type Cotizacion } from './cotizaciones'

/**
 * Las cuentas con el saldo en pesos. Una cuenta en dólares es un activo, así que se valúa a la
 * COMPRA: lo que te darían si vendieras esos dólares hoy.
 *
 * Sin cotización disponible, el saldo en dólares se deja como está. Es mentira como número en
 * pesos, pero la pantalla avisa que no hay cotización, y la alternativa —poner el saldo en cero—
 * haría ver una caja vacía que no lo está.
 */
export function cuentasEnPesos(cuentas: CuentaBancaria[], cotizacion: Cotizacion | null): CuentaBancaria[] {
  if (!cuentas.some((c) => c.moneda === 'USD')) return cuentas
  return cuentas.map((c) =>
    c.moneda === 'USD' ? { ...c, saldo: aPesos(c.saldo, 'USD', cotizacion, 'activo').monto, moneda: 'ARS' as const } : c,
  )
}

/** Si hay algo en dólares que no se pudo convertir, para poder avisarlo en pantalla. */
export function faltaCotizacion(cuentas: CuentaBancaria[], cotizacion: Cotizacion | null): boolean {
  return !cotizacion && cuentas.some((c) => c.moneda === 'USD')
}
