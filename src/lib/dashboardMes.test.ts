import { describe, expect, it } from 'vitest'
import type { Factura, Pago } from './cfo'
import { mesAnterior, mesDe, resumenDelMes, variacion } from './dashboardMes'

function f(id: string, fecha: string, tipo: 'emitida' | 'recibida', monto: number, extra: Partial<Factura> = {}): Factura {
  return { id, tipo, tipoComprobante: 'factura', contraparte: 'X', fecha, monto, iva: 0, ...extra } as Factura
}
function p(facturaId: string, fecha: string, monto: number): Pago {
  return { id: 'p' + facturaId + fecha, facturaId, fecha, monto }
}

describe('mesDe y mesAnterior', () => {
  it('saca el mes de una fecha', () => {
    expect(mesDe('2026-03-15')).toBe('2026-03')
  })

  it('el mes anterior cruza el año', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12')
    expect(mesAnterior('2026-03')).toBe('2026-02')
  })

  it('mantiene los dos dígitos', () => {
    expect(mesAnterior('2026-10')).toBe('2026-09')
  })
})

describe('resumenDelMes', () => {
  const facturas = [
    f('1', '2026-03-05', 'emitida', 100000),
    f('2', '2026-03-20', 'emitida', 50000),
    f('3', '2026-03-10', 'recibida', 40000),
    f('4', '2026-02-28', 'emitida', 900000), // otro mes
    f('5', '2026-03-15', 'emitida', 7000, { esInterna: true }),
    f('6', '2026-03-25', 'emitida', 30000, { tipoComprobante: 'nota_credito' }),
  ]
  const pagos = [
    p('1', '2026-03-12', 60000),
    p('3', '2026-03-18', 40000),
    p('5', '2026-03-16', 7000),
    p('1', '2026-04-02', 40000), // cae en otro mes
    p('inexistente', '2026-03-01', 999999),
  ]
  const r = resumenDelMes(facturas, pagos, '2026-03')

  it('suma solo lo del mes pedido', () => {
    expect(r.mes).toBe('2026-03')
    expect(r.facturado).not.toContain(900000)
  })

  it('las notas de crédito restan de lo facturado', () => {
    expect(r.facturado).toBe(100000 + 50000 - 30000)
  })

  it('deja los comprobantes internos afuera de lo facturado: no son fiscales', () => {
    expect(r.facturado).toBe(120000)
  })

  it('pero sí cuenta la plata de un comprobante interno como cobrada', () => {
    // La plata entró igual, tenga o no respaldo fiscal.
    expect(r.cobrado).toBe(60000 + 7000)
  })

  it('separa lo cobrado de lo pagado según el tipo de la factura', () => {
    expect(r.pagado).toBe(40000)
  })

  it('ignora un pago cuya factura no está: no se sabe de qué lado va', () => {
    expect(r.cobrado + r.pagado).toBe(67000 + 40000)
  })

  it('facturar y cobrar son cosas distintas', () => {
    // Es la diferencia que más problemas de caja explica.
    expect(r.facturado).toBe(120000)
    expect(r.cobrado).toBe(67000)
  })

  it('el margen es lo facturado menos lo comprado', () => {
    expect(r.comprado).toBe(40000)
    expect(r.margen).toBe(80000)
    expect(Math.round(r.margenPct)).toBe(67)
  })

  it('un mes sin ventas no inventa un porcentaje', () => {
    const vacio = resumenDelMes(facturas, pagos, '2026-07')
    expect(vacio.facturado).toBe(0)
    expect(vacio.margenPct).toBe(0)
  })
})

describe('variacion', () => {
  it('calcula la diferencia y el porcentaje', () => {
    expect(variacion(150, 100)).toEqual({ diferencia: 50, porcentaje: 50, direccion: 'sube' })
  })

  it('marca la baja', () => {
    const v = variacion(80, 100)
    expect(v.direccion).toBe('baja')
    expect(v.porcentaje).toBe(-20)
  })

  it('sin cambios no es ni sube ni baja', () => {
    expect(variacion(100, 100).direccion).toBe('igual')
  })

  it('desde cero no hay porcentaje: antes no había nada', () => {
    // "100% más" o "infinito por ciento" serían magnitudes inventadas.
    const v = variacion(100, 0)
    expect(v.porcentaje).toBeNull()
    expect(v.diferencia).toBe(100)
    expect(v.direccion).toBe('sube')
  })

  it('desde un negativo tampoco: el porcentaje se leería al revés', () => {
    // De -100 a -50 el cálculo da -50%, y en realidad mejoró.
    const v = variacion(-50, -100)
    expect(v.porcentaje).toBeNull()
    expect(v.direccion).toBe('sube')
  })
})
