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

import type { Cheque, CuentaBancaria, Factura, Pago } from './cfo'
import { aPesos, tipoDeCambio, type Cotizacion, type LadoValuacion, type Moneda } from './cotizaciones'

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

/**
 * De qué lado está cada comprobante. Una factura emitida es algo a cobrar —un activo, a la
 * compra—, y una recibida es algo a pagar —un pasivo, a la venta—. Lo mismo con los cheques: el
 * recibido lo vas a cobrar, el emitido lo vas a pagar.
 */
function ladoDeFactura(f: Factura): LadoValuacion {
  return f.tipo === 'emitida' ? 'activo' : 'pasivo'
}

function ladoDeCheque(c: Cheque): LadoValuacion {
  return c.tipo === 'recibido' ? 'activo' : 'pasivo'
}

export function facturasEnPesos(facturas: Factura[], cotizacion: Cotizacion | null): Factura[] {
  if (!facturas.some((f) => f.moneda === 'USD')) return facturas
  return facturas.map((f) => {
    if (f.moneda !== 'USD') return f
    const tc = ladoDeFactura(f)
    return {
      ...f,
      monto: aPesos(f.monto, 'USD', cotizacion, tc).monto,
      // El IVA es una parte del mismo importe: se convierte con el mismo tipo de cambio, o la
      // suma de neto más IVA dejaría de dar el total.
      ...(f.iva !== undefined ? { iva: aPesos(f.iva, 'USD', cotizacion, tc).monto } : {}),
      moneda: 'ARS' as const,
    }
  })
}

export function chequesEnPesos(cheques: Cheque[], cotizacion: Cotizacion | null): Cheque[] {
  if (!cheques.some((c) => c.moneda === 'USD')) return cheques
  return cheques.map((c) => {
    if (c.moneda !== 'USD') return c
    const tc = ladoDeCheque(c)
    return {
      ...c,
      monto: aPesos(c.monto, 'USD', cotizacion, tc).monto,
      ...(c.comisionDescuento !== undefined
        ? { comisionDescuento: aPesos(c.comisionDescuento, 'USD', cotizacion, tc).monto }
        : {}),
      moneda: 'ARS' as const,
    }
  })
}

/**
 * Los pagos parciales, convertidos con la moneda y el tipo de cambio de SU factura.
 *
 * Un pago no declara moneda: la hereda de la factura que salda, y no podría ser de otra manera.
 * Si una factura en dólares se convirtiera y sus pagos no, el saldo pendiente saldría del monto
 * en pesos menos los pagos en dólares — una cuenta sin sentido que mostraría casi toda la factura
 * como impaga.
 *
 * Un pago cuya factura no aparece se deja como está: no hay con qué convertirlo, y es más honesto
 * dejarlo que suponerle una moneda.
 */
export function pagosEnPesos(pagos: Pago[], facturas: Factura[], cotizacion: Cotizacion | null): Pago[] {
  const enDolares = new Map(facturas.filter((f) => f.moneda === 'USD').map((f) => [f.id, f]))
  if (enDolares.size === 0) return pagos
  return pagos.map((p) => {
    const factura = enDolares.get(p.facturaId)
    if (!factura) return p
    return { ...p, monto: aPesos(p.monto, 'USD', cotizacion, ladoDeFactura(factura)).monto }
  })
}

/** Si hay comprobantes o cheques en dólares que no se pudieron convertir. */
export function faltaCotizacionEnComprobantes(
  facturas: Factura[],
  cheques: Cheque[],
  cotizacion: Cotizacion | null,
): boolean {
  return !cotizacion && (facturas.some((f) => f.moneda === 'USD') || cheques.some((c) => c.moneda === 'USD'))
}

/**
 * Pasa un importe de una moneda a otra. Se usa cuando dos cosas de monedas distintas se tocan:
 * un cheque en dólares que se deposita en una cuenta en pesos, por ejemplo. El movimiento que
 * queda registrado tiene que estar en la moneda de LA CUENTA, o el saldo de esa cuenta deja de
 * ser una suma de cosas comparables.
 *
 * Sin cotización devuelve el importe sin tocar: es preferible a inventar uno.
 */
export function montoEnMonedaDe(
  monto: number,
  desde: Moneda | undefined,
  hacia: Moneda | undefined,
  cotizacion: Cotizacion | null,
  lado: LadoValuacion = 'activo',
): number {
  const origen = desde ?? 'ARS'
  const destino = hacia ?? 'ARS'
  if (origen === destino || !cotizacion) return monto
  const tc = tipoDeCambio(cotizacion, lado)
  return origen === 'USD' ? monto * tc : monto / tc
}
