import { describe, expect, it } from 'vitest'
import type { Cheque, Factura, Pago } from './cfo'
import { armarMovimientos } from './movimientosDelNegocio'
import { calcularPosicionFinanciera } from './posicionFinanciera'

function factura(id: string, monto: number, extra: Partial<Factura> = {}): Factura {
  return {
    id,
    tipo: 'emitida',
    tipoComprobante: 'factura',
    contraparte: 'Cliente',
    fecha: '2026-03-01',
    monto,
    iva: 0,
    ...extra,
  } as Factura
}

function cheque(id: string, monto: number, extra: Partial<Cheque> = {}): Cheque {
  return {
    id,
    tipo: 'recibido',
    banco: 'Banco',
    contraparte: 'Cliente',
    monto,
    fechaEmision: '2026-03-01',
    fechaCobro: '2026-04-01',
    estado: 'cartera',
    ...extra,
  } as Cheque
}

describe('una factura cobrada a medias', () => {
  // El caso que aparece en cuanto alguien usa cuentas corrientes: una factura de 100.000 de la
  // que ya entraron 60.000. Esos 60.000 están en la caja (o en un cheque en cartera): si la
  // factura siguiera contando por su monto completo, esa plata se contaría dos veces.
  const f = factura('f1', 100000)
  const pagos: Pago[] = [{ id: 'p1', facturaId: 'f1', monto: 60000, fecha: '2026-03-10' }]

  it('cuenta solo el saldo que falta cobrar, no el monto completo', () => {
    const [mov] = armarMovimientos({ facturas: [f], pagos })
    expect(mov.monto).toBe(40000)
  })

  it('sin pagos sigue contando el monto completo', () => {
    const [mov] = armarMovimientos({ facturas: [f], pagos: [] })
    expect(mov.monto).toBe(100000)
  })

  it('con el cheque por el saldo, la posición no infla la disponibilidad', () => {
    // 60.000 ya entraron por caja y quedan 40.000 en un cheque en cartera: el disponible
    // proyectado tiene que ser 100.000, no 160.000.
    const movimientos = armarMovimientos({ facturas: [f], cheques: [cheque('c1', 40000)], pagos })
    const posicion = calcularPosicionFinanciera(60000, movimientos)
    expect(posicion.aCobrar.cheques).toBe(40000)
    expect(posicion.aCobrar.facturas).toBe(40000)
    expect(posicion.disponibleProyectado).toBe(140000)
  })
})

describe('una factura saldada por pagos pero sin tildar', () => {
  const f = factura('f1', 100000)
  const pagos: Pago[] = [{ id: 'p1', facturaId: 'f1', monto: 100000, fecha: '2026-03-10' }]

  it('no se cuenta como pendiente: esa plata ya entró', () => {
    const movimientos = armarMovimientos({ facturas: [f], pagos })
    expect(movimientos[0].cumplido).toBe(true)
    expect(calcularPosicionFinanciera(100000, movimientos).aCobrar.total).toBe(0)
  })

  it('se muestra por su monto completo, que es lo que se cobró', () => {
    expect(armarMovimientos({ facturas: [f], pagos })[0].monto).toBe(100000)
  })
})

describe('lo que ya funcionaba y no se rompe', () => {
  it('la factura abonada con cheque la representa el cheque, una sola vez', () => {
    const f = factura('f1', 100000)
    const c = cheque('c1', 100000, { facturasIds: ['f1'] })
    const movimientos = armarMovimientos({ facturas: [f], cheques: [c], pagos: [] })
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0].id).toContain('cheque:')
  })

  it('las notas de crédito no generan movimiento', () => {
    const nc = factura('nc1', 50000, { tipoComprobante: 'nota_credito' })
    expect(armarMovimientos({ facturas: [nc], pagos: [] })).toHaveLength(0)
  })

  it('sin pagos cargados se comporta como antes', () => {
    const f = factura('f1', 100000)
    expect(armarMovimientos({ facturas: [f] })[0].monto).toBe(100000)
  })
})
