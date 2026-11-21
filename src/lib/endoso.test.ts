import { describe, expect, it } from 'vitest'
import { aplicarEndoso, facturasEndosables } from './endoso'
import type { Cheque, Factura, Pago } from './cfo'

let n = 0
const generarId = () => `id-${++n}`

function factura(p: Partial<Factura> & { id: string; tipo: Factura['tipo']; monto: number }): Factura {
  return { tipoComprobante: 'factura', contraparte: 'Proveedor', fecha: '2026-11-01', ...p } as Factura
}
function cheque(p: Partial<Cheque> & { monto: number }): Cheque {
  return {
    id: 'ch1', tipo: 'recibido', banco: 'Galicia', contraparte: 'Cliente',
    fechaEmision: '2026-11-01', fechaCobro: '2026-12-01', estado: 'entregado', ...p,
  } as Cheque
}

describe('facturasEndosables', () => {
  it('solo facturas de proveedor con saldo', () => {
    const fs = [
      factura({ id: 'venta', tipo: 'emitida', monto: 100 }),
      factura({ id: 'compra', tipo: 'recibida', monto: 100 }),
      factura({ id: 'paga', tipo: 'recibida', monto: 100, cumplido: true }),
    ]
    // La ya cumplida no tiene saldo pendiente por pagos, pero sí por el tilde: se excluye.
    const r = facturasEndosables(fs, cheque({ monto: 1000 }), [{ id: 'p', facturaId: 'paga', monto: 100, fecha: '2026-11-02' }])
    expect(r.map((f) => f.id)).toEqual(['compra'])
  })

  it('solo las de la misma moneda que el cheque', () => {
    // Endosar un cheque en pesos contra una factura en dólares exige un tipo de cambio pactado
    // entre las partes, que no es el del día ni lo sabe el sistema.
    const fs = [
      factura({ id: 'ars', tipo: 'recibida', monto: 100 }),
      factura({ id: 'usd', tipo: 'recibida', monto: 100, moneda: 'USD' }),
    ]
    expect(facturasEndosables(fs, cheque({ monto: 1000 }), []).map((f) => f.id)).toEqual(['ars'])
    expect(facturasEndosables(fs, cheque({ monto: 1000, moneda: 'USD' }), []).map((f) => f.id)).toEqual(['usd'])
  })

  it('ordena de la más vieja a la más nueva', () => {
    const fs = [
      factura({ id: 'nueva', tipo: 'recibida', monto: 100, fecha: '2026-11-20' }),
      factura({ id: 'vieja', tipo: 'recibida', monto: 100, fecha: '2026-10-01' }),
    ]
    expect(facturasEndosables(fs, cheque({ monto: 1000 }), []).map((f) => f.id)).toEqual(['vieja', 'nueva'])
  })
})

describe('aplicarEndoso', () => {
  it('salda la factura y la deja cumplida', () => {
    const f = factura({ id: 'a', tipo: 'recibida', monto: 500_000 })
    const r = aplicarEndoso({ cheque: cheque({ monto: 500_000 }), facturasIds: ['a'], facturas: [f], pagos: [], generarId })
    expect(r.pagos).toHaveLength(1)
    expect(r.pagos[0]).toMatchObject({ facturaId: 'a', monto: 500_000, medioPago: 'cheque', chequeId: 'ch1' })
    expect(r.facturas[0].cumplido).toBe(true)
    expect(r.sobrante).toBe(0)
  })

  it('el pago del endoso no pasa por ninguna cuenta', () => {
    // La plata nunca entró ni salió de un banco tuyo: esa es la diferencia con cobrar el cheque.
    const f = factura({ id: 'a', tipo: 'recibida', monto: 100 })
    const r = aplicarEndoso({ cheque: cheque({ monto: 100 }), facturasIds: ['a'], facturas: [f], pagos: [], generarId })
    expect(r.pagos[0].cuentaId).toBeUndefined()
  })

  it('reparte de la más vieja a la más nueva y hasta donde alcanza', () => {
    const fs = [
      factura({ id: 'vieja', tipo: 'recibida', monto: 300_000, fecha: '2026-10-01' }),
      factura({ id: 'nueva', tipo: 'recibida', monto: 300_000, fecha: '2026-11-01' }),
    ]
    const r = aplicarEndoso({ cheque: cheque({ monto: 400_000 }), facturasIds: ['nueva', 'vieja'], facturas: fs, pagos: [], generarId })
    expect(r.pagos.map((p) => [p.facturaId, p.monto])).toEqual([['vieja', 300_000], ['nueva', 100_000]])
    // La vieja queda saldada; la nueva, pagada en parte y todavía pendiente.
    expect(r.facturas.find((f) => f.id === 'vieja')?.cumplido).toBe(true)
    expect(r.facturas.find((f) => f.id === 'nueva')?.cumplido).toBeFalsy()
    expect(r.aplicado).toBe(400_000)
  })

  it('informa el sobrante cuando el cheque vale más que lo elegido', () => {
    const f = factura({ id: 'a', tipo: 'recibida', monto: 100_000 })
    const r = aplicarEndoso({ cheque: cheque({ monto: 150_000 }), facturasIds: ['a'], facturas: [f], pagos: [], generarId })
    expect(r.aplicado).toBe(100_000)
    expect(r.sobrante).toBe(50_000)
  })

  it('descuenta los pagos parciales que la factura ya tenía', () => {
    const f = factura({ id: 'a', tipo: 'recibida', monto: 500_000 })
    const previo: Pago = { id: 'otro', facturaId: 'a', monto: 200_000, fecha: '2026-11-02' }
    const r = aplicarEndoso({ cheque: cheque({ monto: 500_000 }), facturasIds: ['a'], facturas: [f], pagos: [previo], generarId })
    expect(r.aplicado).toBe(300_000)
    expect(r.pagos).toHaveLength(2)
  })

  it('al cambiar la selección rehace todo y reabre lo que ya no cubre', () => {
    const fs = [
      factura({ id: 'a', tipo: 'recibida', monto: 100_000, cumplido: true }),
      factura({ id: 'b', tipo: 'recibida', monto: 100_000 }),
    ]
    const pagosPrevios: Pago[] = [{ id: 'viejo', facturaId: 'a', monto: 100_000, fecha: '2026-12-01', chequeId: 'ch1' }]
    const r = aplicarEndoso({ cheque: cheque({ monto: 100_000 }), facturasIds: ['b'], facturas: fs, pagos: pagosPrevios, generarId })
    expect(r.pagos.map((p) => p.facturaId)).toEqual(['b'])
    expect(r.facturas.find((f) => f.id === 'a')?.cumplido).toBe(false)
    expect(r.facturas.find((f) => f.id === 'b')?.cumplido).toBe(true)
  })

  it('quitar toda la selección reabre lo que el endoso había saldado', () => {
    const fs = [factura({ id: 'a', tipo: 'recibida', monto: 100_000, cumplido: true })]
    const pagosPrevios: Pago[] = [{ id: 'viejo', facturaId: 'a', monto: 100_000, fecha: '2026-12-01', chequeId: 'ch1' }]
    const r = aplicarEndoso({ cheque: cheque({ monto: 100_000 }), facturasIds: [], facturas: fs, pagos: pagosPrevios, generarId })
    expect(r.pagos).toEqual([])
    expect(r.facturas[0].cumplido).toBe(false)
  })

  it('no toca los pagos que el mismo cheque generó sobre facturas de VENTA', () => {
    // Un cheque recibido salda las ventas que cobró. Borrar esos pagos al endosarlo reabriría
    // ventas ya cobradas — que es el error silencioso que más caro sale acá.
    const fs = [
      factura({ id: 'venta', tipo: 'emitida', monto: 100_000, cumplido: true }),
      factura({ id: 'compra', tipo: 'recibida', monto: 100_000 }),
    ]
    const pagoDeVenta: Pago = { id: 'pv', facturaId: 'venta', monto: 100_000, fecha: '2026-11-01', chequeId: 'ch1' }
    const r = aplicarEndoso({ cheque: cheque({ monto: 100_000 }), facturasIds: ['compra'], facturas: fs, pagos: [pagoDeVenta], generarId })
    expect(r.pagos.some((p) => p.id === 'pv')).toBe(true)
    expect(r.facturas.find((f) => f.id === 'venta')?.cumplido).toBe(true)
  })

  it('no toca los pagos de OTRO cheque', () => {
    const f = factura({ id: 'a', tipo: 'recibida', monto: 200_000 })
    const deOtro: Pago = { id: 'po', facturaId: 'a', monto: 50_000, fecha: '2026-11-01', chequeId: 'ch-otro' }
    const r = aplicarEndoso({ cheque: cheque({ monto: 200_000 }), facturasIds: ['a'], facturas: [f], pagos: [deOtro], generarId })
    expect(r.pagos.some((p) => p.id === 'po')).toBe(true)
    expect(r.aplicado).toBe(150_000)
  })

  it('ignora una factura elegida que ya no tiene saldo', () => {
    const fs = [factura({ id: 'a', tipo: 'recibida', monto: 100_000 })]
    const yaPaga: Pago = { id: 'x', facturaId: 'a', monto: 100_000, fecha: '2026-11-01' }
    const r = aplicarEndoso({ cheque: cheque({ monto: 100_000 }), facturasIds: ['a'], facturas: fs, pagos: [yaPaga], generarId })
    expect(r.aplicado).toBe(0)
    expect(r.sobrante).toBe(100_000)
  })
})
