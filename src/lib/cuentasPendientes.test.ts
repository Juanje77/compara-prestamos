import { describe, expect, it } from 'vitest'
import { resumenCuentasPendientes, type Factura, type Pago } from './cfo'

const HOY = '2026-11-16'

function factura(f: Partial<Factura> & { id: string; tipo: Factura['tipo']; monto: number }): Factura {
  return { fecha: '2026-11-01', contraparte: 'Alguien', categoria: 'otros', ...f } as Factura
}

describe('resumenCuentasPendientes', () => {
  it('suma lo pendiente de cada lado y saca el neto', () => {
    const r = resumenCuentasPendientes(
      [
        factura({ id: 'a', tipo: 'emitida', monto: 100_000, fechaEstimadaCobroPago: '2026-12-01' }),
        factura({ id: 'b', tipo: 'recibida', monto: 40_000, fechaEstimadaCobroPago: '2026-12-01' }),
      ],
      [],
      HOY,
    )
    expect(r.cobrar.total).toBe(100_000)
    expect(r.pagar.total).toBe(40_000)
    expect(r.neto).toBe(60_000)
  })

  it('cuenta como vencido lo que ya pasó su fecha estimada, no su fecha de emisión', () => {
    const r = resumenCuentasPendientes(
      [
        // Emitida hace rato pero con vencimiento futuro: no está vencida.
        factura({ id: 'a', tipo: 'emitida', monto: 100_000, fecha: '2026-09-01', fechaEstimadaCobroPago: '2026-12-20' }),
        factura({ id: 'b', tipo: 'emitida', monto: 70_000, fecha: '2026-10-01', fechaEstimadaCobroPago: '2026-10-31' }),
      ],
      [],
      HOY,
    )
    expect(r.cobrar.total).toBe(170_000)
    expect(r.cobrar.vencido).toBe(70_000)
    expect(r.cobrar.cantidadVencida).toBe(1)
  })

  it('descuenta los pagos parciales ya imputados', () => {
    const pagos: Pago[] = [{ id: 'p1', facturaId: 'a', monto: 30_000, fecha: '2026-11-05' } as Pago]
    const r = resumenCuentasPendientes(
      [factura({ id: 'a', tipo: 'emitida', monto: 100_000, fechaEstimadaCobroPago: '2026-10-01' })],
      pagos,
      HOY,
    )
    expect(r.cobrar.total).toBe(70_000)
    expect(r.cobrar.vencido).toBe(70_000)
  })

  it('no cuenta la factura saldada de a partes aunque nadie la haya tildado', () => {
    const pagos: Pago[] = [{ id: 'p1', facturaId: 'a', monto: 100_000, fecha: '2026-11-05' } as Pago]
    const r = resumenCuentasPendientes([factura({ id: 'a', tipo: 'emitida', monto: 100_000 })], pagos, HOY)
    expect(r.cobrar.total).toBe(0)
    expect(r.hayDatos).toBe(false)
  })

  it('ignora lo ya marcado como cumplido', () => {
    const r = resumenCuentasPendientes(
      [factura({ id: 'a', tipo: 'emitida', monto: 100_000, cumplido: true })],
      [],
      HOY,
    )
    expect(r.cobrar.total).toBe(0)
  })

  it('resta la nota de crédito de lo que queda por cobrar', () => {
    const r = resumenCuentasPendientes(
      [
        factura({ id: 'a', tipo: 'emitida', monto: 100_000, fechaEstimadaCobroPago: '2026-12-01' }),
        factura({ id: 'b', tipo: 'emitida', monto: 20_000, tipoComprobante: 'nota_credito', fechaEstimadaCobroPago: '2026-12-01' }),
      ],
      [],
      HOY,
    )
    expect(r.cobrar.total).toBe(80_000)
  })

  it('sin comprobantes pendientes avisa que no hay datos', () => {
    expect(resumenCuentasPendientes([], [], HOY).hayDatos).toBe(false)
  })
})
