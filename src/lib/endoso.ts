// Endosar un cheque para pagarle a un proveedor.
//
// Entregar un cheque de un tercero es una forma de pago como cualquier otra: la factura del
// proveedor queda saldada aunque por tu cuenta bancaria no haya pasado un peso. Eso es lo que lo
// distingue de cobrar el cheque, y por qué no alcanzaba con marcarlo "cobrado".
//
// Acá vive solo el cálculo —qué pagos se crean, qué facturas quedan saldadas—, sin React y sin
// estado. Es la parte donde un error se paga caro: una factura que figura paga sin estarlo, o una
// que se reabre sola al tocar otra cosa.

import { calcularSaldoFactura, imputarPagoAFIFO, type Cheque, type Factura, type Pago } from './cfo'

export interface ResultadoEndoso {
  /** TODOS los pagos que deben quedar guardados, no solo los nuevos. */
  pagos: Pago[]
  /** Las facturas con `cumplido` actualizado — las que este endoso cubre y las que deja de cubrir. */
  facturas: Factura[]
  /** Cuánto del cheque se llegó a imputar. */
  aplicado: number
  /** Lo que sobró del cheque después de cubrir lo elegido. No se pierde: queda a la vista para
   * que la persona sepa que entregó un cheque por más de lo que debía. */
  sobrante: number
}

/**
 * Las facturas de proveedor que un cheque puede llegar a cancelar: pendientes, con saldo, y en la
 * MISMA moneda que el cheque.
 *
 * Lo de la moneda no es una limitación técnica sino contable: endosar un cheque en pesos contra
 * una factura en dólares exige un tipo de cambio pactado entre las partes, que no es el del día
 * ni lo sabe el sistema. Antes que adivinarlo, no se ofrece.
 */
export function facturasEndosables(facturas: Factura[], cheque: Cheque, pagos: Pago[]): Factura[] {
  const moneda = cheque.moneda ?? 'ARS'
  return facturas
    .filter((f) => f.tipo === 'recibida' && (f.moneda ?? 'ARS') === moneda)
    .filter((f) => calcularSaldoFactura(f, pagos) > 0 || (f.cumplido === true && esPagadaPor(f, cheque, pagos)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Si esta factura figura saldada justamente por el endoso de este cheque. */
function esPagadaPor(factura: Factura, cheque: Cheque, pagos: Pago[]): boolean {
  return pagos.some((p) => p.facturaId === factura.id && p.chequeId === cheque.id)
}

/**
 * Recalcula el endoso de un cheque sobre las facturas elegidas.
 *
 * Siempre se rehace desde cero: se borran los pagos que este mismo cheque había generado sobre
 * facturas de proveedor y se vuelven a crear con la selección nueva. Es más simple que ir
 * agregando y quitando de a uno, y sobre todo no deja pagos huérfanos de una selección anterior.
 *
 * El importe se reparte de la más vieja a la más nueva y hasta donde alcance el cheque: elegir
 * facturas por más de lo que vale no las salda a todas, salda las primeras. Al revés, si el
 * cheque es más grande que lo elegido, el sobrante no se imputa a nada — queda informado.
 */
export function aplicarEndoso({
  cheque,
  facturasIds,
  facturas,
  pagos,
  generarId,
}: {
  cheque: Cheque
  facturasIds: string[]
  facturas: Factura[]
  pagos: Pago[]
  generarId: () => string
}): ResultadoEndoso {
  const recibidas = new Map(facturas.filter((f) => f.tipo === 'recibida').map((f) => [f.id, f]))

  // Fuera los pagos del endoso anterior de ESTE cheque. Solo los de facturas de proveedor: un
  // cheque recibido también genera pagos sobre las facturas de VENTA que cobró, y esos no se
  // tocan — son otra cosa, y borrarlos reabriría ventas ya cobradas.
  const pagosPrevios = pagos.filter((p) => p.chequeId === cheque.id && recibidas.has(p.facturaId))
  const idsPrevias = new Set(pagosPrevios.map((p) => p.facturaId))
  const pagosBase = pagos.filter((p) => !(p.chequeId === cheque.id && recibidas.has(p.facturaId)))

  const elegidas = facturasIds
    .map((id) => recibidas.get(id))
    .filter((f): f is Factura => f !== undefined)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((f) => ({ ...f, montoPagado: 0, saldo: calcularSaldoFactura(f, pagosBase) }))
    .filter((f) => f.saldo > 0)

  const { pagos: nuevos, facturaIdsCubiertas } = imputarPagoAFIFO(
    elegidas,
    cheque.monto,
    cheque.fechaCobro,
    'cheque',
    generarId,
  )
  // El endoso no pasa por ninguna cuenta: la plata nunca entró ni salió de un banco tuyo, así que
  // los pagos van sin cuentaId y Tesorería no se entera. Es exactamente la diferencia con cobrarlo.
  const pagosDelEndoso = nuevos.map((p) => ({ ...p, chequeId: cheque.id }))
  const aplicado = pagosDelEndoso.reduce((s, p) => s + p.monto, 0)

  const cubiertas = new Set(facturaIdsCubiertas)
  const facturasActualizadas = facturas.map((f) => {
    if (cubiertas.has(f.id)) return { ...f, cumplido: true, medioPago: 'cheque' as const }
    // Las que este endoso cubría antes y ya no: vuelven a estar pendientes.
    if (idsPrevias.has(f.id) && !cubiertas.has(f.id) && f.cumplido) {
      return { ...f, cumplido: false, medioPago: undefined }
    }
    return f
  })

  return {
    pagos: [...pagosBase, ...pagosDelEndoso],
    facturas: facturasActualizadas,
    aplicado,
    sobrante: Math.max(0, cheque.monto - aplicado),
  }
}
