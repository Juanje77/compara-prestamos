// El extracto de una cuenta corriente: el movimiento de la cuenta en orden, con el saldo que va
// quedando después de cada renglón.
//
// Es lo que un cliente pide cuando discute un saldo, y lo que uno manda para reclamar: no alcanza
// con "me debés tanto", hay que poder mostrar de dónde sale. La pantalla muestra el saldo; esto
// muestra cómo se llegó a él.

import type { Anticipo, CuentaCorrienteContraparte, Pago } from './cfo'

export interface FilaExtracto {
  fecha: string
  detalle: string
  /** Lo que aumenta la deuda del cliente: una factura. */
  debe: number
  /** Lo que la baja: un pago o un anticipo. */
  haber: number
  /** Cómo queda la cuenta después de este renglón. */
  saldo: number
}

export interface Extracto {
  contraparte: string
  filas: FilaExtracto[]
  totalDebe: number
  totalHaber: number
  saldo: number
}

const MEDIO_LABEL: Record<string, string> = {
  caja: 'efectivo',
  cheque: 'cheque',
  transferencia: 'transferencia',
}

function conMedio(base: string, medioPago?: string): string {
  const medio = medioPago ? MEDIO_LABEL[medioPago] : undefined
  return medio ? `${base} (${medio})` : base
}

/**
 * Arma el extracto de una contraparte a partir de lo que ya agrupó agruparCuentaCorriente.
 *
 * Solo entran las facturas y remitos que todavía tienen saldo: son los mismos que muestra la
 * pantalla, y así el total del extracto coincide con el saldo que la persona está viendo. Un
 * extracto que cierra en otro número que la pantalla no sirve para discutir nada.
 *
 * En la misma fecha, primero lo que se facturó y después lo que se cobró: un pago del mismo día
 * de la factura se lee como que la saldó, no como un pago a cuenta anterior a ella.
 */
export function armarExtracto(cuenta: CuentaCorrienteContraparte, pagos: Pago[], anticipos: Anticipo[] = []): Extracto {
  const filas: Omit<FilaExtracto, 'saldo'>[] = []

  for (const f of cuenta.facturas) {
    filas.push({
      fecha: f.fecha,
      detalle: `Factura${f.numero ? ` ${f.numero}` : ''}`,
      debe: f.monto,
      haber: 0,
    })
    for (const p of pagos.filter((x) => x.facturaId === f.id).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      filas.push({
        fecha: p.fecha,
        detalle: conMedio(`Pago de factura${f.numero ? ` ${f.numero}` : ''}`, p.medioPago),
        debe: 0,
        haber: p.monto,
      })
    }
  }

  for (const r of cuenta.remitos) {
    filas.push({
      fecha: r.fecha,
      detalle: `${r.tipoDocumento === 'remito' ? 'Remito' : 'Presupuesto'}${r.numero ? ` ${r.numero}` : ''} (sin facturar)`,
      debe: r.monto,
      haber: 0,
    })
    for (const a of anticipos.filter((x) => x.remitoId === r.id).sort((x, y) => x.fecha.localeCompare(y.fecha))) {
      filas.push({ fecha: a.fecha, detalle: conMedio('Anticipo', a.medioPago), debe: 0, haber: a.monto })
    }
  }

  // Por fecha, y a igual fecha primero el debe. Un pago del mismo día de la factura se lee como
  // que la saldó, no como un pago a cuenta anterior a ella.
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || (b.debe > 0 ? 1 : 0) - (a.debe > 0 ? 1 : 0))

  let saldo = 0
  const conSaldo: FilaExtracto[] = filas.map((f) => {
    saldo += f.debe - f.haber
    return { ...f, saldo }
  })

  return {
    contraparte: cuenta.contraparte,
    filas: conSaldo,
    totalDebe: conSaldo.reduce((s, f) => s + f.debe, 0),
    totalHaber: conSaldo.reduce((s, f) => s + f.haber, 0),
    saldo,
  }
}

/** Los extractos de todas las contrapartes, de mayor a menor saldo: arriba el que más debe. */
export function armarExtractos(
  cuentas: CuentaCorrienteContraparte[],
  pagos: Pago[],
  anticipos: Anticipo[] = [],
): Extracto[] {
  return cuentas.map((c) => armarExtracto(c, pagos, anticipos)).sort((a, b) => b.saldo - a.saldo)
}

/** Cuánto hace que vence cada saldo, para el resumen de arriba del informe. */
export function diasDeAtraso(fechaISO: string, hoyISO = new Date().toISOString().slice(0, 10)): number {
  const dia = 1000 * 60 * 60 * 24
  return Math.floor((new Date(`${hoyISO}T00:00:00`).getTime() - new Date(`${fechaISO}T00:00:00`).getTime()) / dia)
}
