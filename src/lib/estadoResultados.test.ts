import { describe, expect, it } from 'vitest'
import type { Bien, Empleado, Factura, MovimientoStock, Producto } from './cfo'
import { calcularEstadoResultados } from './estadoResultados'

function f(id: string, tipo: 'emitida' | 'recibida', monto: number, iva: number, extra: Partial<Factura> = {}): Factura {
  return {
    id,
    tipo,
    tipoComprobante: 'factura',
    contraparte: tipo === 'emitida' ? 'Cliente' : 'Proveedor',
    fecha: '2026-05-10',
    monto,
    iva,
    ...extra,
  } as Factura
}

const BASE = {
  anio: 2026,
  criterio: 'fiscal' as const,
  clasificaciones: {},
  empleados: [] as Empleado[],
  bienes: [] as Bien[],
}

describe('el criterio de devengado y sin IVA', () => {
  it('las ventas van netas de IVA', () => {
    // El IVA no es ingreso: se cobra por cuenta del fisco.
    const r = calcularEstadoResultados({ ...BASE, facturas: [f('1', 'emitida', 121000, 21000)] })
    expect(r.ventasNetas).toBe(100000)
  })

  it('las notas de crédito restan de las ventas', () => {
    const r = calcularEstadoResultados({
      ...BASE,
      facturas: [f('1', 'emitida', 121000, 21000), f('2', 'emitida', 12100, 2100, { tipoComprobante: 'nota_credito' })],
    })
    expect(r.ventasNetas).toBe(90000)
  })

  it('solo entra lo del ejercicio pedido', () => {
    const r = calcularEstadoResultados({
      ...BASE,
      facturas: [f('1', 'emitida', 100000, 0), f('2', 'emitida', 999999, 0, { fecha: '2025-12-31' })],
    })
    expect(r.ventasNetas).toBe(100000)
  })

  it('cuenta los comprobantes sin IVA discriminado para poder avisarlo', () => {
    // Un responsable inscripto que no discrimina deja las ventas infladas un 21%, y el sistema
    // no puede distinguirlo de un monotributista cuyos importes ya son netos.
    const r = calcularEstadoResultados({ ...BASE, facturas: [f('1', 'emitida', 100000, 0), f('2', 'emitida', 121000, 21000)] })
    expect(r.comprobantesSinIva).toBe(1)
  })
})

describe('gestión contra fiscal', () => {
  const facturas = [f('1', 'emitida', 100000, 0), f('2', 'emitida', 40000, 0, { esInterna: true })]

  it('el fiscal deja afuera lo que no tiene factura', () => {
    const r = calcularEstadoResultados({ ...BASE, criterio: 'fiscal', facturas })
    expect(r.ventasNetas).toBe(100000)
    expect(r.ventasSinFactura).toBe(0)
  })

  it('el de gestión lo incluye y dice cuánto es', () => {
    const r = calcularEstadoResultados({ ...BASE, criterio: 'gestion', facturas })
    expect(r.ventasNetas).toBe(140000)
    expect(r.ventasSinFactura).toBe(40000)
  })
})

describe('el costo de ventas', () => {
  const compras = [f('c1', 'recibida', 60000, 0, { contraparte: 'Mayorista' })]
  const clasificaciones = { Mayorista: 'insumos' }

  it('sin stock cargado usa las compras del período', () => {
    const r = calcularEstadoResultados({ ...BASE, facturas: [f('1', 'emitida', 100000, 0), ...compras], clasificaciones })
    expect(r.criterioCosto).toBe('compras')
    expect(r.costoVentas).toBe(60000)
    expect(r.resultadoBruto).toBe(40000)
  })

  it('con stock cargado usa las salidas valorizadas', () => {
    const productos: Producto[] = [{ id: 'p1', nombre: 'Tornillo', costoUnitario: 500, stockActual: 10 } as Producto]
    const movimientosStock: MovimientoStock[] = [
      { id: 'm1', productoId: 'p1', tipo: 'salida', cantidad: 40, fecha: '2026-05-10' } as MovimientoStock,
      { id: 'm2', productoId: 'p1', tipo: 'entrada', cantidad: 100, fecha: '2026-05-01' } as MovimientoStock,
      { id: 'm3', productoId: 'p1', tipo: 'salida', cantidad: 5, fecha: '2025-05-10' } as MovimientoStock,
    ]
    const r = calcularEstadoResultados({
      ...BASE,
      facturas: [f('1', 'emitida', 100000, 0), ...compras],
      clasificaciones,
      productos,
      movimientosStock,
    })
    expect(r.criterioCosto).toBe('stock')
    // Solo las salidas del ejercicio: 40 × 500. La entrada no es costo y el año anterior no entra.
    expect(r.costoVentas).toBe(20000)
  })

  it('una compra sin clasificar no infla el costo de ventas', () => {
    const r = calcularEstadoResultados({ ...BASE, facturas: [f('1', 'emitida', 100000, 0), ...compras] })
    expect(r.costoVentas).toBe(0)
    // Cae en gastos, que es donde menos daño hace.
    expect(r.totalGastos).toBe(60000)
  })
})

describe('sueldos, gastos y amortizaciones', () => {
  const empleado = {
    id: 'e1',
    nombre: 'Ana',
    sueldoBruto: 1000000,
    contribucionesPatronalesPct: 20,
    cargasSocialesAdicionalesPct: 5,
  } as Empleado

  it('la nómina se devenga trece veces: doce meses más el aguinaldo', () => {
    const r = calcularEstadoResultados({ ...BASE, facturas: [], empleados: [empleado] })
    expect(r.sueldos).toBe(1250000 * 13)
  })

  it('los sueldos no se cuentan dos veces si hay un proveedor clasificado así', () => {
    const r = calcularEstadoResultados({
      ...BASE,
      facturas: [f('c1', 'recibida', 500000, 0, { contraparte: 'Estudio' })],
      clasificaciones: { Estudio: 'sueldos' },
      empleados: [empleado],
    })
    expect(r.gastos.some((g) => g.key === 'sueldos')).toBe(false)
    expect(r.sueldos).toBe(1250000 * 13)
  })

  it('las amortizaciones restan del resultado operativo', () => {
    const bienes: Bien[] = [
      { id: 'b1', concepto: 'Camioneta', tipo: 'vehiculo', valorEstimado: 12000000, fechaAlta: '2026-01-01', vidaUtilAnios: 5 } as Bien,
    ]
    const r = calcularEstadoResultados({ ...BASE, facturas: [f('1', 'emitida', 5000000, 0)], bienes })
    expect(r.amortizaciones).toBe(2400000)
    expect(r.resultadoOperativo).toBe(5000000 - 2400000)
  })
})

describe('el resultado final', () => {
  it('encadena las restas en el orden correcto', () => {
    const r = calcularEstadoResultados({
      ...BASE,
      facturas: [f('1', 'emitida', 1000000, 0), f('c1', 'recibida', 300000, 0, { contraparte: 'Mayorista' })],
      clasificaciones: { Mayorista: 'insumos' },
      comisionesCheques: 50000,
      impuestos: 80000,
    })
    expect(r.resultadoBruto).toBe(700000)
    expect(r.margenBrutoPct).toBe(70)
    expect(r.resultadoOperativo).toBe(700000)
    expect(r.resultadosFinancieros).toBe(-50000)
    expect(r.resultadoAntesDeImpuestos).toBe(650000)
    expect(r.resultadoNeto).toBe(570000)
  })

  it('sin ventas no inventa un margen', () => {
    expect(calcularEstadoResultados({ ...BASE, facturas: [] }).margenBrutoPct).toBe(0)
  })
})
