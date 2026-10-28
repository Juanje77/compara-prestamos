// Los movimientos pendientes del negocio, armados a partir de todo lo que ya está cargado.
//
// Vive acá y no adentro de la pantalla de Cobranzas porque ahora lo usan dos: esa pantalla y el
// Dashboard. Que las dos partan de la MISMA lista no es prolijidad, es lo único que evita que el
// Dashboard diga una cosa y Cobranzas otra sobre la misma plata — y si dos pantallas del mismo
// sistema no coinciden, el usuario deja de creerle a las dos.
//
// El problema difícil que resuelve es el solapamiento: una factura abonada con un cheque es UNA
// sola plata. Si se sumaran las facturas y los cheques por separado, esa plata se contaría dos
// veces. Acá la representa el cheque y la factura no se lista.

import { CONCEPTO_PAGO_SUELDOS_LABEL, type Cheque, type Factura, type PagoSueldos } from './cfo'
import type { Movimiento } from './movimientosSemana'
import { PREFIJO_CHEQUE, PREFIJO_FACTURA, PREFIJO_SUELDO } from './posicionFinanciera'

export function facturaAMovimiento(f: Factura): Movimiento {
  return {
    id: `${PREFIJO_FACTURA}${f.id}`,
    tipo: f.tipo === 'emitida' ? 'cobro' : 'pago',
    concepto: f.contraparte,
    monto: f.monto,
    fecha: f.fechaEstimadaCobroPago ?? f.fecha,
    cumplido: f.cumplido ?? false,
    medioPago: f.medioPago,
  }
}

/** Un cheque "cobrado" (o "vendido", si es recibido) ya se hizo efectivo; uno rechazado sigue
 * pendiente de resolución, así que se muestra igual que uno en cartera. */
export function chequeAMovimiento(c: Cheque): Movimiento {
  return {
    id: `${PREFIJO_CHEQUE}${c.id}`,
    tipo: c.tipo === 'recibido' ? 'cobro' : 'pago',
    concepto: `${c.contraparte} (cheque${c.numero ? ` ${c.numero}` : ''})`,
    monto: c.monto,
    fecha: c.fechaCobro,
    cumplido: c.estado === 'cobrado' || c.estado === 'vendido',
    medioPago: 'cheque',
  }
}

/** Los pagos de la nómina se ven para que no sorprendan en la semana, pero se registran desde la
 * solapa Sueldos, que es donde se elige de qué cuenta sale la plata. */
export function sueldoAMovimiento(p: PagoSueldos): Movimiento {
  return {
    id: `${PREFIJO_SUELDO}${p.mes}:${p.concepto}`,
    tipo: 'pago',
    concepto: CONCEPTO_PAGO_SUELDOS_LABEL[p.concepto],
    monto: p.monto,
    fecha: p.fechaEstimada,
    cumplido: p.pagado,
  }
}

/**
 * Todo junto: lo cargado a mano en la planilla semanal, más las facturas, los cheques y los
 * pagos de sueldos.
 *
 * Las notas de crédito no generan movimiento: no son plata a cobrar ni a pagar, son un ajuste de
 * una factura que ya está en la lista.
 */
export function armarMovimientos({
  manuales = [],
  facturas = [],
  cheques = [],
  pagosSueldos = [],
}: {
  manuales?: Movimiento[]
  facturas?: Factura[]
  cheques?: Cheque[]
  pagosSueldos?: PagoSueldos[]
}): Movimiento[] {
  const cubiertasPorCheque = new Set(cheques.flatMap((c) => c.facturasIds ?? []))
  return [
    ...manuales,
    ...facturas
      .filter((f) => f.tipoComprobante !== 'nota_credito' && !cubiertasPorCheque.has(f.id))
      .map(facturaAMovimiento),
    ...cheques.map(chequeAMovimiento),
    ...pagosSueldos.map(sueldoAMovimiento),
  ]
}
