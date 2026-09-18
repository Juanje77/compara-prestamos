import { describe, expect, it } from 'vitest'
import {
  CARGAS_SOCIALES_ADICIONALES_PCT_DEFAULT,
  CONTRIBUCIONES_PATRONALES_PCT_DEFAULT,
  MARGEN_DIAS_CONCILIACION,
  aplicarMovimientoStock,
  aplicarMovimientoTesoreria,
  buscarCoincidenciasAutomaticas,
  calcularAguinaldo,
  calcularCostoEmpleado,
  calcularDesvioVentas,
  calcularMargenBrutoTotal,
  calcularMargenPorSector,
  calcularNominaTotal,
  calcularPagosSueldos,
  calcularPosicionIngresosBrutosPorMes,
  calcularPosicionIvaPorMes,
  calcularPromediosMensualesReales,
  calcularPuntoEquilibrio,
  calcularRealAutomaticoPorMes,
  calcularResumenConciliacion,
  calcularRunwayMeses,
  cerrarLiquidacion,
  distribuirEnCuotas,
  gastosAguinaldoProyectados,
  generarMovimientosDeFactura,
  generarMovimientosDeRemito,
  imputarPagoAFIFO,
  listarProductosBajoMinimo,
  montoConSigno,
  proximoNumeroRecibo,
  proyectarFlujoCaja,
  revertirMovimientoTesoreria,
  type CuentaBancaria,
  type Empleado,
  type Factura,
  type MovimientoBancario,
  type MovimientoTesoreria,
  type Producto,
  type RemitoPresupuesto,
  type Sector,
} from './cfo'

// Tolerancia para comparar pesos: los porcentajes dan decimales largos y no tiene sentido exigir
// igualdad binaria exacta sobre un monto.
const cerca = (valor: number, esperado: number) => expect(valor).toBeCloseTo(esperado, 2)

function factura(parcial: Partial<Factura> & Pick<Factura, 'id' | 'tipo' | 'monto' | 'fecha'>): Factura {
  return { tipoComprobante: 'factura', contraparte: 'Alguien', ...parcial }
}

// ---------------------------------------------------------------------------
// Sueldos — el caso de referencia es una liquidación real de Empleados de
// Comercio (CCT 130/75), con sus sumas no remunerativas y las bases distintas
// de cada descuento.
// ---------------------------------------------------------------------------

const EMPLEADO_COMERCIO: Empleado = {
  id: 'e1',
  nombre: 'Empleado Comercio',
  sueldoBruto: 1196632.0,
  conceptos: [
    { id: 'c1', descripcion: 'Asistencia y Puntualidad', monto: 99719.33, remunerativo: true },
    { id: 'c2', descripcion: 'Día Empleados de Comercio', monto: 51854.05, remunerativo: true },
    { id: 'c3', descripcion: 'Acuerdo no remunerativo', monto: 120000, remunerativo: false },
    { id: 'c4', descripcion: 'Asistencia no remunerativa', monto: 10000, remunerativo: false },
  ],
  descuentos: [
    { id: 'd1', descripcion: 'Jubilación', porcentaje: 11, base: 'remunerativo' },
    { id: 'd2', descripcion: 'Ley 19.032', porcentaje: 3, base: 'remunerativo' },
    { id: 'd3', descripcion: 'Obra Social', porcentaje: 3, base: 'total' },
    { id: 'd4', descripcion: 'S.E.C. Art. 100', porcentaje: 2, base: 'total' },
    { id: 'd5', descripcion: 'F.A.E.C. y S.', porcentaje: 0.5, base: 'total' },
  ],
  contribucionesPatronalesPct: 24,
  cargasSocialesAdicionalesPct: 3,
  activo: true,
}

describe('calcularCostoEmpleado', () => {
  it('reproduce el recibo real de Empleados de Comercio', () => {
    const costo = calcularCostoEmpleado(EMPLEADO_COMERCIO)
    cerca(costo.remunerativo, 1348205.38)
    cerca(costo.noRemunerativo, 130000)
    cerca(costo.totalDescuentos, 270050.05)
    cerca(costo.sueldoNeto, 1208155.33)
  })

  it('aplica jubilación y PAMI solo sobre lo remunerativo, y obra social sobre el total', () => {
    const { descuentos } = calcularCostoEmpleado(EMPLEADO_COMERCIO)
    const porNombre = (n: string) => descuentos.find((d) => d.descripcion.startsWith(n))!
    cerca(porNombre('Jubilación').montoBase, 1348205.38)
    cerca(porNombre('Jubilación').monto, 148302.59)
    cerca(porNombre('Obra Social').montoBase, 1478205.38)
    cerca(porNombre('Obra Social').monto, 44346.16)
  })

  it('no genera contribuciones patronales sobre las sumas no remunerativas', () => {
    const costo = calcularCostoEmpleado(EMPLEADO_COMERCIO)
    // 24% y 3% se calculan sobre 1.348.205,38, no sobre 1.478.205,38.
    cerca(costo.contribucionesPatronales, 323569.29)
    cerca(costo.cargasSocialesAdicionales, 40446.16)
    cerca(costo.costoEmpresa, 1842220.83)
  })

  it('usa los descuentos por defecto cuando un empleado viejo no los tiene definidos', () => {
    const { descuentos, sueldoNeto } = calcularCostoEmpleado({
      id: 'x', nombre: 'Sin descuentos', sueldoBruto: 1000000,
      contribucionesPatronalesPct: CONTRIBUCIONES_PATRONALES_PCT_DEFAULT,
      cargasSocialesAdicionalesPct: CARGAS_SOCIALES_ADICIONALES_PCT_DEFAULT,
      activo: true,
    })
    expect(descuentos).toHaveLength(3)
    cerca(sueldoNeto, 830000) // 11 + 3 + 3 = 17%
  })

  it('los descuentos por defecto usan la base que corresponde a cada uno', () => {
    // Con una suma no remunerativa las dos bases dejan de coincidir: jubilación y PAMI se calculan
    // sobre 1.000.000 y obra social sobre 1.200.000.
    const { descuentos } = calcularCostoEmpleado({
      id: 'x', nombre: 'Con no remunerativo', sueldoBruto: 1000000,
      conceptos: [{ id: 'c', descripcion: 'Acuerdo', monto: 200000, remunerativo: false }],
      contribucionesPatronalesPct: 24, cargasSocialesAdicionalesPct: 3, activo: true,
    })
    const porNombre = (n: string) => descuentos.find((d) => d.descripcion.startsWith(n))!
    cerca(porNombre('Jubilación').montoBase, 1000000)
    cerca(porNombre('Ley 19.032').montoBase, 1000000)
    cerca(porNombre('Obra social').montoBase, 1200000)
    cerca(porNombre('Obra social').monto, 36000)
  })

  it('tolera un empleado guardado antes de que existieran las cargas adicionales', () => {
    const viejo = { ...EMPLEADO_COMERCIO, cargasSocialesAdicionalesPct: undefined } as unknown as Empleado
    cerca(calcularCostoEmpleado(viejo).cargasSocialesAdicionales, 1348205.38 * 0.03)
  })
})

describe('calcularNominaTotal', () => {
  const activo = { ...EMPLEADO_COMERCIO, id: 'a' }
  const deBaja = { ...EMPLEADO_COMERCIO, id: 'b', activo: false }

  it('suma solo a los empleados activos', () => {
    const nomina = calcularNominaTotal([activo, deBaja])
    expect(nomina.cantidadActivos).toBe(1)
    cerca(nomina.totalNeto, 1208155.33)
  })

  it('el neto más lo que va a AFIP da exactamente el costo empresa', () => {
    const n = calcularNominaTotal([activo, { ...activo, id: 'c' }])
    cerca(n.totalNeto + (n.totalCostoEmpresa - n.totalNeto), n.totalCostoEmpresa)
    cerca(n.totalRemunerativo + n.totalNoRemunerativo, n.totalBruto)
  })
})

describe('calcularAguinaldo', () => {
  it('toma la mitad de la remuneración y deja afuera las sumas no remunerativas', () => {
    const sac = calcularAguinaldo([EMPLEADO_COMERCIO])
    cerca(sac.totalRemunerativo, 1348205.38 / 2)
    expect(sac.totalNoRemunerativo).toBe(0)
  })
})

describe('calcularPagosSueldos', () => {
  const nomina = calcularNominaTotal([EMPLEADO_COMERCIO])
  const sac = calcularAguinaldo([EMPLEADO_COMERCIO])

  it('parte la nómina en netos y cargas, que juntos dan el costo empresa', () => {
    const pagos = calcularPagosSueldos(nomina, '2026-09', [])
    expect(pagos.map((p) => p.concepto)).toEqual(['netos', 'cargas'])
    cerca(pagos[0].monto + pagos[1].monto, nomina.totalCostoEmpresa)
  })

  it('paga los sueldos del mes al mes siguiente', () => {
    const [netos, cargas] = calcularPagosSueldos(nomina, '2026-09', [])
    expect(netos.fechaEstimada).toBe('2026-10-04')
    expect(cargas.fechaEstimada).toBe('2026-10-15')
  })

  it('agrega el aguinaldo solo en junio y diciembre', () => {
    expect(calcularPagosSueldos(nomina, '2026-09', [], sac)).toHaveLength(2)
    const junio = calcularPagosSueldos(nomina, '2026-06', [], sac)
    expect(junio.map((p) => p.concepto)).toContain('aguinaldoNetos')
    // El SAC se abona dentro del mismo mes que vence, no al siguiente.
    expect(junio.find((p) => p.concepto === 'aguinaldoNetos')!.fechaEstimada).toBe('2026-06-30')
    expect(calcularPagosSueldos(nomina, '2026-12', [], sac).find((p) => p.concepto === 'aguinaldoNetos')!.fechaEstimada).toBe(
      '2026-12-18',
    )
  })

  it('marca como pagado el concepto que ya tiene su movimiento en Tesorería', () => {
    const movimiento: MovimientoTesoreria = {
      id: 'm1', cuentaId: 'c1', tipo: 'egreso', monto: 1, fecha: '2026-10-04',
      origen: 'sueldo', origenId: '2026-09:netos',
    }
    const [netos, cargas] = calcularPagosSueldos(nomina, '2026-09', [movimiento])
    expect(netos.pagado).toBe(true)
    expect(netos.movimientoId).toBe('m1')
    expect(cargas.pagado).toBe(false)
  })

  it('sin empleados activos no hay nada que pagar', () => {
    expect(calcularPagosSueldos(calcularNominaTotal([]), '2026-09', [])).toEqual([])
  })
})

describe('liquidaciones y numeración de recibos', () => {
  const plantilla = [EMPLEADO_COMERCIO, { ...EMPLEADO_COMERCIO, id: 'e2', nombre: 'Otro' }]
  let n = 0
  const generarId = () => `id-${++n}`

  it('numera correlativo desde 1 y copia el recibo completo de cada empleado', () => {
    const liq = cerrarLiquidacion(plantilla, '2026-09', 'mensual', [], generarId)
    expect(liq.recibos.map((r) => r.numeroRecibo)).toEqual([1, 2])
    const [primero] = liq.recibos
    cerca(primero.neto, 1208155.33)
    // Lo que se congela es todo lo que después se imprime en el recibo, no solo el neto.
    cerca(primero.sueldoBasico, 1196632)
    expect(primero.conceptos.map((c) => c.descripcion)).toEqual(EMPLEADO_COMERCIO.conceptos!.map((c) => c.descripcion))
    expect(primero.descuentos).toHaveLength(5)
    cerca(primero.remunerativo, 1348205.38)
    cerca(primero.costoEmpresa, 1842220.83)
  })

  it('el aguinaldo continúa la misma serie y liquida medio sueldo', () => {
    const mensual = cerrarLiquidacion(plantilla, '2026-06', 'mensual', [], generarId)
    const sac = cerrarLiquidacion(plantilla, '2026-06', 'aguinaldo', [mensual], generarId)
    expect(sac.recibos.map((r) => r.numeroRecibo)).toEqual([3, 4])
    cerca(sac.recibos[0].remunerativo, 1348205.38 / 2)
  })

  it('no reutiliza números al reabrir y volver a cerrar un período', () => {
    const primera = cerrarLiquidacion(plantilla, '2026-09', 'mensual', [], generarId)
    // "Reabrir" es borrar la liquidación; los números emitidos no vuelven al pool.
    const trasReabrir = cerrarLiquidacion(plantilla, '2026-09', 'mensual', [primera], generarId)
    expect(trasReabrir.recibos.map((r) => r.numeroRecibo)).toEqual([3, 4])
  })

  it('la serie sigue desde el mayor emitido aunque se borre una liquidación intermedia', () => {
    const enero = cerrarLiquidacion(plantilla, '2026-01', 'mensual', [], generarId) // 1 y 2
    const febrero = cerrarLiquidacion(plantilla, '2026-02', 'mensual', [enero], generarId) // 3 y 4
    expect(febrero.recibos.map((r) => r.numeroRecibo)).toEqual([3, 4])
    // Se reabre enero: quedan vivos solo los recibos 3 y 4, pero el próximo tiene que ser el 5.
    const marzo = cerrarLiquidacion(plantilla, '2026-03', 'mensual', [febrero], generarId)
    expect(marzo.recibos.map((r) => r.numeroRecibo)).toEqual([5, 6])
    expect(proximoNumeroRecibo([febrero])).toBe(5)
  })

  it('una liquidación congelada no cambia si después se edita al empleado', () => {
    const liq = cerrarLiquidacion([EMPLEADO_COMERCIO], '2026-09', 'mensual', [], generarId)
    const netoAlCerrar = liq.recibos[0].neto
    EMPLEADO_COMERCIO.sueldoBruto = 9999999
    expect(liq.recibos[0].neto).toBe(netoAlCerrar)
    EMPLEADO_COMERCIO.sueldoBruto = 1196632.0
  })

  it('deja afuera a los empleados de baja', () => {
    const liq = cerrarLiquidacion([{ ...EMPLEADO_COMERCIO, activo: false }], '2026-09', 'mensual', [], generarId)
    expect(liq.recibos).toEqual([])
  })

  it('proximoNumeroRecibo arranca en 1 y después sigue el mayor emitido', () => {
    expect(proximoNumeroRecibo([])).toBe(1)
    const liq = cerrarLiquidacion(plantilla, '2026-09', 'mensual', [], generarId)
    expect(proximoNumeroRecibo([liq])).toBe(liq.recibos[1].numeroRecibo + 1)
  })
})

// ---------------------------------------------------------------------------
// Comprobantes e impuestos
// ---------------------------------------------------------------------------

describe('montoConSigno', () => {
  it('resta las notas de crédito y suma las de débito', () => {
    expect(montoConSigno(factura({ id: '1', tipo: 'emitida', monto: 100, fecha: '2026-01-05' }))).toBe(100)
    expect(
      montoConSigno(factura({ id: '2', tipo: 'emitida', monto: 100, fecha: '2026-01-05', tipoComprobante: 'nota_credito' })),
    ).toBe(-100)
    expect(
      montoConSigno(factura({ id: '3', tipo: 'emitida', monto: 100, fecha: '2026-01-05', tipoComprobante: 'nota_debito' })),
    ).toBe(100)
  })
})

describe('calcularPosicionIvaPorMes', () => {
  it('arrastra el saldo a favor al mes siguiente y no lo deja negativo', () => {
    const facturas: Factura[] = [
      // Enero: crédito fiscal mayor al débito -> queda saldo a favor de 500.
      factura({ id: '1', tipo: 'recibida', monto: 6300, iva: 1300, fecha: '2026-01-10' }),
      factura({ id: '2', tipo: 'emitida', monto: 4800, iva: 800, fecha: '2026-01-20' }),
      // Febrero: débito 2000 contra crédito 0 y los 500 arrastrados -> a pagar 1500.
      factura({ id: '3', tipo: 'emitida', monto: 12000, iva: 2000, fecha: '2026-02-10' }),
    ]
    const [enero, febrero] = calcularPosicionIvaPorMes(facturas)
    expect(enero.saldoAFavor).toBe(500)
    expect(enero.saldoAPagar).toBe(0)
    expect(febrero.saldoAFavorAnterior).toBe(500)
    expect(febrero.saldoAPagar).toBe(1500)
    expect(febrero.saldoAFavor).toBe(0)
  })

  it('una nota de crédito revierte el IVA que había generado el comprobante', () => {
    const [mes] = calcularPosicionIvaPorMes([
      factura({ id: '1', tipo: 'emitida', monto: 12100, iva: 2100, fecha: '2026-03-01' }),
      factura({ id: '2', tipo: 'emitida', monto: 12100, iva: 2100, fecha: '2026-03-02', tipoComprobante: 'nota_credito' }),
    ])
    expect(mes.debitoFiscal).toBe(0)
  })

  it('el valor cargado a mano pisa al que sale de los comprobantes', () => {
    const [mes] = calcularPosicionIvaPorMes(
      [factura({ id: '1', tipo: 'emitida', monto: 12100, iva: 2100, fecha: '2026-04-01' })],
      { '2026-04': { debitoFiscal: 5000 } },
    )
    expect(mes.debitoFiscal).toBe(5000)
    expect(mes.debitoFiscalEsManual).toBe(true)
  })
})

describe('calcularPosicionIngresosBrutosPorMes', () => {
  it('aplica la alícuota sobre el neto de IVA y descuenta retenciones, sin arrastrar saldo', () => {
    const [mes] = calcularPosicionIngresosBrutosPorMes(
      [factura({ id: '1', tipo: 'emitida', monto: 121000, iva: 21000, fecha: '2026-05-10' })],
      { '2026-05': { alicuotaPct: 3, retenciones: 1000 } },
    )
    expect(mes.baseImponible).toBe(100000)
    expect(mes.impuestoDeterminado).toBe(3000)
    expect(mes.saldoAPagar).toBe(2000)
  })
})

describe('distribuirEnCuotas', () => {
  it('reparte el monto en cuotas mensuales sin perder plata', () => {
    const cuotas = distribuirEnCuotas(factura({ id: '1', tipo: 'recibida', monto: 3000, fecha: '2026-01-10', cuotas: 3 }))
    expect(cuotas).toHaveLength(3)
    cerca(cuotas.reduce((s, c) => s + c.monto, 0), 3000)
    expect(cuotas[0].fecha).toBe('2026-01-10')
  })

  it('sin cuotas definidas deja el comprobante entero en su fecha', () => {
    expect(distribuirEnCuotas(factura({ id: '1', tipo: 'recibida', monto: 500, fecha: '2026-01-10' }))).toEqual([
      { fecha: '2026-01-10', monto: 500 },
    ])
  })
})

describe('calcularMargenBrutoTotal', () => {
  it('descuenta las notas de crédito de las ventas', () => {
    const m = calcularMargenBrutoTotal([
      factura({ id: '1', tipo: 'emitida', monto: 10000, fecha: '2026-01-01' }),
      factura({ id: '2', tipo: 'emitida', monto: 2000, fecha: '2026-01-02', tipoComprobante: 'nota_credito' }),
      factura({ id: '3', tipo: 'recibida', monto: 3000, fecha: '2026-01-03' }),
    ])
    expect(m.ventasNetas).toBe(8000)
    expect(m.margenBruto).toBe(5000)
    expect(m.margenBrutoPct).toBeCloseTo(62.5, 1)
  })
})

describe('calcularPromediosMensualesReales', () => {
  it('promedia ventas y compras con el mismo denominador de meses', () => {
    // Ventas concentradas en un mes, compras repartidas en dos: si cada lado se promediara por
    // separado el margen quedaría inflado.
    const p = calcularPromediosMensualesReales([
      factura({ id: '1', tipo: 'emitida', monto: 10000, fecha: '2026-01-10' }),
      factura({ id: '2', tipo: 'recibida', monto: 3000, fecha: '2026-01-10' }),
      factura({ id: '3', tipo: 'recibida', monto: 3000, fecha: '2026-02-10' }),
    ])
    expect(p.ventasPromedio).toBe(5000)
    expect(p.comprasPromedio).toBe(3000)
  })
})

describe('calcularRealAutomaticoPorMes', () => {
  it('solo suma proveedores clasificados, repartiendo las cuotas en su mes', () => {
    const real = calcularRealAutomaticoPorMes(
      [
        factura({ id: '1', tipo: 'recibida', contraparte: 'Prov A', monto: 2000, fecha: '2026-01-10', cuotas: 2 }),
        factura({ id: '2', tipo: 'recibida', contraparte: 'Sin clasificar', monto: 9000, fecha: '2026-01-10' }),
      ],
      { 'Prov A': 'insumos' },
      '2026-01',
    )
    expect(real).toEqual({ insumos: 1000 })
  })

  it('distingue "sin datos" de "gastó cero": la categoría sin dato no aparece en el resultado', () => {
    expect(calcularRealAutomaticoPorMes([], {}, '2026-01').insumos).toBeUndefined()
  })
})

describe('calcularDesvioVentas', () => {
  it('se completa solo con las facturas del mes', () => {
    const d = calcularDesvioVentas(5000000, [factura({ id: '1', tipo: 'emitida', monto: 6200000, fecha: '2026-09-10' })], {}, '2026-09')
    expect(d.real).toBe(6200000)
    expect(d.esAutomatico).toBe(true)
    expect(d.desvioMonto).toBe(1200000)
    expect(d.desvioPct).toBeCloseTo(24, 5)
  })

  it('el valor cargado a mano gana y deja de ser automático', () => {
    const d = calcularDesvioVentas(5000000, [factura({ id: '1', tipo: 'emitida', monto: 6200000, fecha: '2026-09-10' })], { '2026-09': 100 }, '2026-09')
    expect(d.real).toBe(100)
    expect(d.esAutomatico).toBe(false)
  })
})

describe('imputarPagoAFIFO', () => {
  const pendientes = [
    { ...factura({ id: 'vieja', tipo: 'emitida', monto: 1000, fecha: '2026-01-01' }), montoPagado: 0, saldo: 1000 },
    { ...factura({ id: 'nueva', tipo: 'emitida', monto: 1000, fecha: '2026-02-01' }), montoPagado: 0, saldo: 1000 },
  ]

  it('cancela primero la más vieja y deja la diferencia en la siguiente', () => {
    const r = imputarPagoAFIFO(pendientes, 1500, '2026-03-01', 'transferencia', () => 'p')
    expect(r.facturaIdsCubiertas).toEqual(['vieja'])
    expect(r.pagos.map((p) => p.monto)).toEqual([1000, 500])
  })

  it('no inventa un saldo a favor si el pago supera lo adeudado', () => {
    const r = imputarPagoAFIFO(pendientes, 5000, '2026-03-01', undefined, () => 'p')
    expect(r.pagos.reduce((s, p) => s + p.monto, 0)).toBe(2000)
  })
})

// ---------------------------------------------------------------------------
// Tesorería, conciliación y stock
// ---------------------------------------------------------------------------

describe('movimientos de Tesorería', () => {
  const cuentas: CuentaBancaria[] = [{ id: 'c1', nombre: 'Banco', saldo: 1000 }]
  const egreso: MovimientoTesoreria = { id: 'm', cuentaId: 'c1', tipo: 'egreso', monto: 300, fecha: '2026-01-01', origen: 'manual' }

  it('aplicar y revertir deja el saldo como estaba', () => {
    const despues = aplicarMovimientoTesoreria(cuentas, egreso)
    expect(despues[0].saldo).toBe(700)
    expect(revertirMovimientoTesoreria(despues, egreso)[0].saldo).toBe(1000)
  })

  it('un ajuste guarda el signo en el monto', () => {
    const ajuste: MovimientoTesoreria = { ...egreso, tipo: 'ajuste', monto: -250 }
    expect(aplicarMovimientoTesoreria(cuentas, ajuste)[0].saldo).toBe(750)
  })
})

describe('buscarCoincidenciasAutomaticas', () => {
  const movimientos: MovimientoTesoreria[] = [
    { id: 'm1', cuentaId: 'c1', tipo: 'ingreso', monto: 5000, fecha: '2026-01-10', origen: 'factura' },
  ]
  const bancario = (parcial: Partial<MovimientoBancario>): MovimientoBancario => ({
    id: 'b1', cuentaId: 'c1', fecha: '2026-01-12', monto: 5000, conciliado: false, ...parcial,
  })

  it('empareja por monto exacto dentro del margen de días', () => {
    expect(buscarCoincidenciasAutomaticas([bancario({})], movimientos, 'c1')).toEqual([
      { bancarioId: 'b1', movimientoId: 'm1' },
    ])
  })

  it('no empareja fuera del margen', () => {
    const lejos = bancario({ fecha: '2026-01-20' })
    expect(buscarCoincidenciasAutomaticas([lejos], movimientos, 'c1')).toEqual([])
    expect(buscarCoincidenciasAutomaticas([lejos], movimientos, 'c1', 30)).toHaveLength(1)
  })

  it('el margen por defecto son 3 días', () => {
    expect(MARGEN_DIAS_CONCILIACION).toBe(3)
    expect(buscarCoincidenciasAutomaticas([bancario({ fecha: '2026-01-13' })], movimientos, 'c1')).toHaveLength(1)
    expect(buscarCoincidenciasAutomaticas([bancario({ fecha: '2026-01-14' })], movimientos, 'c1')).toHaveLength(0)
  })

  it('ante dos candidatos posibles no adivina', () => {
    const dos = [...movimientos, { ...movimientos[0], id: 'm2', fecha: '2026-01-11' }]
    expect(buscarCoincidenciasAutomaticas([bancario({})], dos, 'c1')).toEqual([])
  })

  it('no reutiliza un movimiento ya vinculado a otra fila', () => {
    const yaVinculado = bancario({ id: 'b0', conciliado: true, movimientoTesoreriaId: 'm1' })
    expect(buscarCoincidenciasAutomaticas([yaVinculado, bancario({})], movimientos, 'c1')).toEqual([])
  })

  it('ignora movimientos de otra cuenta y montos de signo opuesto', () => {
    expect(buscarCoincidenciasAutomaticas([bancario({ cuentaId: 'c2' })], movimientos, 'c2')).toEqual([])
    expect(buscarCoincidenciasAutomaticas([bancario({ monto: -5000 })], movimientos, 'c1')).toEqual([])
  })
})

describe('calcularResumenConciliacion', () => {
  it('la diferencia es el saldo del sistema contra el último saldo del extracto', () => {
    const cuenta: CuentaBancaria = { id: 'c1', nombre: 'Banco', saldo: 12000 }
    const bancarios: MovimientoBancario[] = [
      { id: 'b1', cuentaId: 'c1', fecha: '2026-01-05', monto: 1000, saldoDeclarado: 9000, conciliado: true, movimientoTesoreriaId: 'm1' },
      { id: 'b2', cuentaId: 'c1', fecha: '2026-01-09', monto: 1000, saldoDeclarado: 10000, conciliado: false },
    ]
    const movimientos: MovimientoTesoreria[] = [
      { id: 'm1', cuentaId: 'c1', tipo: 'ingreso', monto: 1000, fecha: '2026-01-05', origen: 'factura' },
      { id: 'm2', cuentaId: 'c1', tipo: 'ingreso', monto: 2000, fecha: '2026-01-08', origen: 'factura' },
    ]
    const r = calcularResumenConciliacion(cuenta, bancarios, movimientos)
    expect(r.saldoExtracto).toBe(10000)
    expect(r.diferencia).toBe(2000)
    expect(r.bancariosPendientes.map((b) => b.id)).toEqual(['b2'])
    expect(r.movimientosPendientes.map((m) => m.id)).toEqual(['m2'])
  })

  it('sin saldo declarado no inventa una diferencia', () => {
    const r = calcularResumenConciliacion({ id: 'c1', nombre: 'B', saldo: 100 }, [], [])
    expect(r.saldoExtracto).toBeNull()
    expect(r.diferencia).toBeNull()
  })
})

describe('generarMovimientosDeRemito', () => {
  const productosRemito: Producto[] = [
    { id: 'p1', nombre: 'Chapa', costoUnitario: 100, stockActual: 10 },
    { id: 'serv1', nombre: 'Instalación', costoUnitario: 0, stockActual: 0, esServicio: true },
  ]
  const lineas = [
    { productoId: 'p1', cantidad: 3, precioUnitario: 100 },
    { descripcion: 'Mano de obra', cantidad: 1, precioUnitario: 500 },
    { productoId: 'serv1', cantidad: 1, precioUnitario: 1000 },
  ]
  const base: RemitoPresupuesto = {
    id: 'r1', tipo: 'emitida', tipoDocumento: 'remito', contraparte: 'Cliente', monto: 800,
    fecha: '2026-01-10', estado: 'pendiente', lineas,
  }

  it('un remito emitido saca stock y solo por las líneas con producto (no servicio)', () => {
    const movs = generarMovimientosDeRemito(base, productosRemito, () => 'x')
    expect(movs).toHaveLength(1)
    expect(movs[0].tipo).toBe('salida')
    expect(movs[0].cantidad).toBe(3)
  })

  it('un remito recibido entra stock y actualiza el costo', () => {
    const movs = generarMovimientosDeRemito({ ...base, tipo: 'recibida' }, productosRemito, () => 'x')
    expect(movs[0].tipo).toBe('entrada')
    expect(movs[0].costoUnitario).toBe(100)
  })

  it('un presupuesto no mueve nada', () => {
    expect(generarMovimientosDeRemito({ ...base, tipoDocumento: 'presupuesto' }, productosRemito, () => 'x')).toEqual([])
  })
})

describe('generarMovimientosDeFactura', () => {
  const productosFactura: Producto[] = [
    { id: 'p1', nombre: 'Chapa', costoUnitario: 100, stockActual: 10 },
    { id: 'serv1', nombre: 'Instalación', costoUnitario: 0, stockActual: 0, esServicio: true },
  ]
  const facturaConLineas: Factura = {
    id: 'f1', tipo: 'emitida', tipoComprobante: 'factura', contraparte: 'Cliente', monto: 800, fecha: '2026-01-10',
    lineas: [
      { productoId: 'p1', cantidad: 2, precioUnitario: 100 },
      { productoId: 'serv1', cantidad: 1, precioUnitario: 500 },
    ],
  }

  it('un comprobante emitido con líneas saca stock solo del producto, no del servicio', () => {
    const movs = generarMovimientosDeFactura(facturaConLineas, productosFactura, () => 'x')
    expect(movs).toHaveLength(1)
    expect(movs[0].tipo).toBe('salida')
    expect(movs[0].productoId).toBe('p1')
    expect(movs[0].facturaId).toBe('f1')
  })

  it('un comprobante sin líneas no mueve nada', () => {
    expect(generarMovimientosDeFactura({ ...facturaConLineas, lineas: undefined }, productosFactura, () => 'x')).toEqual([])
  })
})

describe('listarProductosBajoMinimo', () => {
  it('ignora un servicio aunque tenga stockMinimo cargado por error', () => {
    const productos: Producto[] = [
      { id: 'p1', nombre: 'Chapa', costoUnitario: 100, stockActual: 0, stockMinimo: 5 },
      { id: 'serv1', nombre: 'Instalación', costoUnitario: 0, stockActual: 0, stockMinimo: 5, esServicio: true },
    ]
    const bajoMinimo = listarProductosBajoMinimo(productos)
    expect(bajoMinimo).toHaveLength(1)
    expect(bajoMinimo[0].id).toBe('p1')
  })
})

describe('aplicarMovimientoStock', () => {
  const productos: Producto[] = [{ id: 'p1', nombre: 'Chapa', costoUnitario: 100, stockActual: 10 }]

  it('una entrada suma stock y pisa el último costo', () => {
    const r = aplicarMovimientoStock(productos, {
      id: 'm', productoId: 'p1', tipo: 'entrada', cantidad: 5, fecha: '2026-01-01', costoUnitario: 130,
    })
    expect(r[0].stockActual).toBe(15)
    expect(r[0].costoUnitario).toBe(130)
  })

  it('una salida no toca el costo', () => {
    const r = aplicarMovimientoStock(productos, { id: 'm', productoId: 'p1', tipo: 'salida', cantidad: 4, fecha: '2026-01-01' })
    expect(r[0].stockActual).toBe(6)
    expect(r[0].costoUnitario).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Márgenes por sector
// ---------------------------------------------------------------------------

describe('calcularMargenPorSector', () => {
  const sectores: Sector[] = [{ id: 's1', nombre: 'Metalúrgica' }, { id: 's2', nombre: 'Service' }]
  const productos: Producto[] = [{ id: 'p1', nombre: 'Chapa', costoUnitario: 120000, precioVenta: 300000, stockActual: 50 }]
  const remitos: RemitoPresupuesto[] = [
    {
      id: 'r1', tipo: 'emitida', tipoDocumento: 'remito', contraparte: 'Cliente', monto: 3000000,
      fecha: '2026-09-05', estado: 'pendiente', sectorId: 's1',
      lineas: [{ productoId: 'p1', cantidad: 10, precioUnitario: 300000 }],
    },
    {
      id: 'r2', tipo: 'recibida', tipoDocumento: 'remito', contraparte: 'Proveedor', monto: 400000,
      fecha: '2026-09-06', estado: 'pendiente', sectorId: 's1',
    },
  ]
  const empleados: Empleado[] = [
    {
      id: 'e1', nombre: 'Ana', sueldoBruto: 1000000, contribucionesPatronalesPct: 24, cargasSocialesAdicionalesPct: 3,
      activo: true, asignaciones: [{ sectorId: 's1', porcentaje: 60 }, { sectorId: 's2', porcentaje: 40 }],
    },
  ]

  it('valúa las líneas al costo de Stock, no al precio facturado', () => {
    const [metal] = calcularMargenPorSector(sectores, remitos, productos)
    expect(metal.ingreso).toBe(3000000)
    expect(metal.costoLineas).toBe(1200000) // 10 × 120.000 de costo, no × 300.000
    expect(metal.costoCompras).toBe(400000)
  })

  it('reparte el costo de un empleado entre sus sectores según el porcentaje', () => {
    const [metal, service] = calcularMargenPorSector(sectores, remitos, productos, empleados)
    const costoEmpresa = 1000000 * 1.27
    cerca(metal.costoNomina, costoEmpresa * 0.6)
    cerca(service.costoNomina, costoEmpresa * 0.4)
  })

  it('un sector que solo consume mano de obra queda con ganancia negativa', () => {
    const [, service] = calcularMargenPorSector(sectores, remitos, productos, empleados)
    expect(service.ingreso).toBe(0)
    expect(service.ganancia).toBeLessThan(0)
  })

  it('ignora presupuestos y empleados de baja', () => {
    const conPresupuesto: RemitoPresupuesto[] = [{ ...remitos[0], id: 'r3', tipoDocumento: 'presupuesto' }]
    const [metal] = calcularMargenPorSector(sectores, conPresupuesto, productos, [{ ...empleados[0], activo: false }])
    expect(metal.ingreso).toBe(0)
    expect(metal.costoNomina).toBe(0)
  })

  it('avisa cuando un remito emitido no tiene líneas para separar su costo', () => {
    const sinLineas: RemitoPresupuesto[] = [{ ...remitos[0], lineas: undefined }]
    expect(calcularMargenPorSector(sectores, sinLineas, productos)[0].remitosSinLineas).toBe(1)
  })

  it('suma un comprobante asignado directo al sector, sin remito detrás', () => {
    const facturas: Factura[] = [
      { id: 'f1', tipo: 'emitida', tipoComprobante: 'factura', contraparte: 'Cliente', monto: 500000, fecha: '2026-09-10', sectorId: 's1' },
    ]
    const [metal] = calcularMargenPorSector(sectores, remitos, productos, empleados, facturas)
    expect(metal.ingreso).toBe(3000000 + 500000)
    expect(metal.cantidadComprobantes).toBe(1)
  })

  it('no duplica el ingreso de un comprobante ya vinculado a un remito del sector', () => {
    const remitoVinculado: RemitoPresupuesto[] = [{ ...remitos[0], facturaId: 'f1' }, remitos[1]]
    const facturas: Factura[] = [
      { id: 'f1', tipo: 'emitida', tipoComprobante: 'factura', contraparte: 'Cliente', monto: 3000000, fecha: '2026-09-10', sectorId: 's1' },
    ]
    const [metal] = calcularMargenPorSector(sectores, remitoVinculado, productos, empleados, facturas)
    expect(metal.ingreso).toBe(3000000) // no 6.000.000: la factura ya está contada vía el remito
    expect(metal.cantidadComprobantes).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Indicadores y proyección
// ---------------------------------------------------------------------------

describe('calcularRunwayMeses', () => {
  it('divide la caja por los gastos fijos', () => {
    expect(calcularRunwayMeses(5000000, 2500000)).toBe(2)
  })

  it('sin gastos fijos el runway es infinito, y nunca da negativo', () => {
    expect(calcularRunwayMeses(1000, 0)).toBe(Infinity)
    expect(calcularRunwayMeses(-500, 100)).toBe(0)
  })
})

describe('calcularPuntoEquilibrio', () => {
  it('calcula el ingreso necesario para cubrir los fijos', () => {
    const pe = calcularPuntoEquilibrio(5000000, 2712000, 600000)
    expect(pe.alcanzable).toBe(true)
    expect(pe.ingresosNecesarios).toBeCloseTo(3081818.18, 1)
  })

  it('no es alcanzable si los variables se comen todo el ingreso', () => {
    expect(calcularPuntoEquilibrio(1000, 500, 1000).alcanzable).toBe(false)
  })
})

describe('proyectarFlujoCaja', () => {
  it('acumula el saldo mes a mes', () => {
    const filas = proyectarFlujoCaja(1000, 500, 300, 3)
    expect(filas.map((f) => f.saldo)).toEqual([1200, 1400, 1600])
  })

  it('suma el gasto extra solo en el mes que corresponde', () => {
    const filas = proyectarFlujoCaja(1000, 500, 300, 3, 0, [0, 1000, 0])
    expect(filas.map((f) => f.saldo)).toEqual([1200, 400, 600])
    expect(filas[1].gastos).toBe(1300)
  })

  it('hace crecer el ingreso con la tasa mensual', () => {
    const filas = proyectarFlujoCaja(0, 100, 0, 2, 10)
    cerca(filas[1].ingresos, 110)
  })
})

describe('gastosAguinaldoProyectados', () => {
  it('ubica el aguinaldo en junio y diciembre de los meses proyectados', () => {
    // Arrancando en abril, los 12 meses siguientes son mayo..abril: junio (índice 1) y diciembre (7).
    const extras = gastosAguinaldoProyectados(1000, 12, new Date(2026, 3, 15))
    expect(extras[1]).toBe(1000)
    expect(extras[7]).toBe(1000)
    expect(extras.filter((e) => e > 0)).toHaveLength(2)
  })

  it('sin nómina no agrega nada', () => {
    expect(gastosAguinaldoProyectados(0, 12)).toEqual([])
  })
})
