import { describe, expect, it } from 'vitest'
import { armarExtracto, armarExtractos, diasDeAtraso } from './extractoCuentaCorriente'
import type { CuentaCorrienteContraparte, Pago } from './cfo'

function cuenta(p: Partial<CuentaCorrienteContraparte> = {}): CuentaCorrienteContraparte {
  return {
    contraparte: 'Metalúrgica Sur',
    totalFacturado: 0, totalPagado: 0, saldo: 0,
    facturas: [], remitos: [],
    ...p,
  }
}
const fac = (p: { id: string; monto: number; fecha: string; numero?: string }) =>
  ({ ...p, tipo: 'emitida', tipoComprobante: 'factura', contraparte: 'Metalúrgica Sur', montoPagado: 0, saldo: p.monto }) as never

describe('armarExtracto', () => {
  it('lleva el saldo renglón por renglón', () => {
    const c = cuenta({ facturas: [fac({ id: 'a', monto: 100_000, fecha: '2026-10-01', numero: '0001-00000010' })] })
    const pagos: Pago[] = [{ id: 'p', facturaId: 'a', monto: 30_000, fecha: '2026-10-20', medioPago: 'transferencia' }]
    const e = armarExtracto(c, pagos)
    expect(e.filas.map((f) => [f.detalle, f.debe, f.haber, f.saldo])).toEqual([
      ['Factura 0001-00000010', 100_000, 0, 100_000],
      ['Pago de factura 0001-00000010 (transferencia)', 0, 30_000, 70_000],
    ])
    expect(e.saldo).toBe(70_000)
    expect(e.totalDebe).toBe(100_000)
    expect(e.totalHaber).toBe(30_000)
  })

  it('ordena por fecha, mezclando facturas y pagos de distintas facturas', () => {
    const c = cuenta({
      facturas: [
        fac({ id: 'a', monto: 100_000, fecha: '2026-10-01' }),
        fac({ id: 'b', monto: 50_000, fecha: '2026-10-15' }),
      ],
    })
    const pagos: Pago[] = [{ id: 'p', facturaId: 'a', monto: 40_000, fecha: '2026-10-10' }]
    expect(armarExtracto(c, pagos).filas.map((f) => f.fecha)).toEqual(['2026-10-01', '2026-10-10', '2026-10-15'])
  })

  it('a igual fecha, primero la factura y después el pago', () => {
    // Un pago del mismo día se lee como que saldó la factura, no como un pago a cuenta previo.
    const c = cuenta({ facturas: [fac({ id: 'a', monto: 100_000, fecha: '2026-10-01' })] })
    const pagos: Pago[] = [{ id: 'p', facturaId: 'a', monto: 100_000, fecha: '2026-10-01' }]
    const e = armarExtracto(c, pagos)
    expect(e.filas.map((f) => f.debe > 0)).toEqual([true, false])
    expect(e.filas.map((f) => f.saldo)).toEqual([100_000, 0])
  })

  it('ignora los pagos de otra factura', () => {
    const c = cuenta({ facturas: [fac({ id: 'a', monto: 100_000, fecha: '2026-10-01' })] })
    const pagos: Pago[] = [{ id: 'p', facturaId: 'otra', monto: 99_999, fecha: '2026-10-05' }]
    expect(armarExtracto(c, pagos).saldo).toBe(100_000)
  })

  it('incluye remitos sin facturar y sus anticipos', () => {
    const c = cuenta({
      remitos: [
        { id: 'r', tipoDocumento: 'remito', numero: 'R-1', monto: 200_000, fecha: '2026-10-02', montoAnticipado: 0, saldo: 200_000 } as never,
      ],
    })
    const e = armarExtracto(c, [], [{ id: 'a1', remitoId: 'r', monto: 50_000, fecha: '2026-10-08', medioPago: 'caja' }])
    expect(e.filas.map((f) => f.detalle)).toEqual(['Remito R-1 (sin facturar)', 'Anticipo (efectivo)'])
    expect(e.saldo).toBe(150_000)
  })

  it('una cuenta sin nada da un extracto vacío en cero', () => {
    const e = armarExtracto(cuenta(), [])
    expect(e.filas).toEqual([])
    expect(e.saldo).toBe(0)
  })
})

describe('armarExtractos', () => {
  it('ordena de mayor a menor saldo: arriba el que más debe', () => {
    const cuentas = [
      cuenta({ contraparte: 'Chico', facturas: [fac({ id: 'a', monto: 10_000, fecha: '2026-10-01' })] }),
      cuenta({ contraparte: 'Grande', facturas: [fac({ id: 'b', monto: 900_000, fecha: '2026-10-01' })] }),
    ]
    expect(armarExtractos(cuentas, []).map((e) => e.contraparte)).toEqual(['Grande', 'Chico'])
  })
})

describe('diasDeAtraso', () => {
  it('cuenta los días desde la fecha', () => {
    expect(diasDeAtraso('2026-10-01', '2026-10-31')).toBe(30)
    expect(diasDeAtraso('2026-11-30', '2026-10-31')).toBe(-30)
  })
})
