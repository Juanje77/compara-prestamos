import { describe, expect, it } from 'vitest'
import { BLOQUES, bloquesQueCambiaron, partirNegocio, unirBloques } from './negocioBloques'

/** Un negocio con un valor en cada campo, para que el test de ida y vuelta sea real y no sobre
 * dos campos sueltos. Los valores son de juguete; lo que se verifica es que ninguno se pierda. */
const NEGOCIO_COMPLETO: Record<string, unknown> = {
  ingresos: 7000000,
  meses: 6,
  montos: { sueldos: 1000 },
  cuentas: [{ id: 'c1', nombre: 'Banco', saldo: 500 }],
  deudas: [{ id: 'd1' }],
  bienes: [{ id: 'b1' }],
  realManualPorMes: { '2026-10': { sueldos: 1 } },
  ventasManualPorMes: { '2026-10': 2 },
  facturas: [{ id: 'f1' }],
  clasificaciones: { Proveedor: 'insumos' },
  clientesManual: ['Cliente'],
  cheques: [{ id: 'ch1' }],
  pagos: [{ id: 'p1' }],
  remitos: [{ id: 'r1' }],
  sectores: [{ id: 's1' }],
  empleados: [{ id: 'e1', sueldoBruto: 999 }],
  datosEmisorFiscal: { cuit: '30-12345678-9' },
  anticipos: [{ id: 'a1' }],
  productos: [{ id: 'pr1' }],
  movimientosStock: [{ id: 'ms1' }],
  movimientosTesoreria: [{ id: 'mt1' }],
  movimientosBancarios: [{ id: 'mb1' }],
  ivaManualPorMes: { '2026-10': {} },
  ingresosBrutosManualPorMes: { '2026-10': {} },
  movimientosDiarios: [],
  monotributo: { actividad: 'servicios' },
  tasaCrecimiento: 5,
  nombreNegocio: 'Mi negocio',
  actualizadoEn: 1760000000000,
  historialMensual: [{ mes: '2026-09', tomadaEn: 1760000000000, caja: 1 }],
  // No es un campo de negocioData, pero se parte con el mismo mecanismo y en su propio bloque.
  movimientosSemana: [{ id: 'mv1' }],
}

describe('partir y unir', () => {
  it('la ida y vuelta devuelve exactamente el mismo negocio', () => {
    expect(unirBloques(partirNegocio(NEGOCIO_COMPLETO))).toEqual(NEGOCIO_COMPLETO)
  })

  it('no se pierde ningún campo en el camino', () => {
    const repartidos = Object.values(partirNegocio(NEGOCIO_COMPLETO)).flatMap((b) => Object.keys(b ?? {}))
    expect([...repartidos].sort()).toEqual(Object.keys(NEGOCIO_COMPLETO).sort())
  })

  it('ningún campo cae en dos bloques', () => {
    const repartidos = Object.values(partirNegocio(NEGOCIO_COMPLETO)).flatMap((b) => Object.keys(b ?? {}))
    expect(new Set(repartidos).size).toBe(repartidos.length)
  })

  it('los sueldos quedan solos en su bloque', () => {
    expect(partirNegocio(NEGOCIO_COMPLETO).sueldos).toEqual({ empleados: [{ id: 'e1', sueldoBruto: 999 }] })
  })

  it('un negocio vacío no genera bloques vacíos', () => {
    expect(partirNegocio({})).toEqual({})
  })

  it('un campo nuevo que nadie ubicó va al bloque general en vez de perderse', () => {
    const conCampoNuevo = { ...NEGOCIO_COMPLETO, algoQueSeAgregoDespues: [1, 2] }
    expect(partirNegocio(conCampoNuevo).negocio).toHaveProperty('algoQueSeAgregoDespues')
    expect(unirBloques(partirNegocio(conCampoNuevo))).toEqual(conCampoNuevo)
  })

  it('los undefined no se guardan: Firestore los rechaza', () => {
    const partido = partirNegocio({ ...NEGOCIO_COMPLETO, monotributo: undefined })
    expect(partido.impuestos).not.toHaveProperty('monotributo')
  })
})

describe('unirBloques con permisos parciales', () => {
  it('un empleado que solo lee lo comercial recibe eso y nada de sueldos', () => {
    const { comercial } = partirNegocio(NEGOCIO_COMPLETO)
    const visto = unirBloques({ comercial })
    expect(visto.facturas).toEqual([{ id: 'f1' }])
    expect(visto).not.toHaveProperty('empleados')
    expect(visto).not.toHaveProperty('cuentas')
  })

  it('sin ningún bloque devuelve un negocio vacío, no rompe', () => {
    expect(unirBloques({})).toEqual({})
  })
})

describe('bloquesQueCambiaron', () => {
  const partido = partirNegocio(NEGOCIO_COMPLETO)

  it('la primera vez hay que guardar todos los que tengan algo', () => {
    expect(bloquesQueCambiaron(partido, null).sort()).toEqual([...BLOQUES].sort())
  })

  it('sin cambios no se escribe nada', () => {
    expect(bloquesQueCambiaron(partido, partido)).toEqual([])
  })

  it('tocar una factura no reescribe los sueldos', () => {
    const conFacturaNueva = partirNegocio({ ...NEGOCIO_COMPLETO, facturas: [{ id: 'f1' }, { id: 'f2' }] })
    expect(bloquesQueCambiaron(conFacturaNueva, partido)).toEqual(['comercial'])
  })

  it('tocar un sueldo solo reescribe ese bloque', () => {
    const conSueldoNuevo = partirNegocio({ ...NEGOCIO_COMPLETO, empleados: [{ id: 'e1', sueldoBruto: 1 }] })
    expect(bloquesQueCambiaron(conSueldoNuevo, partido)).toEqual(['sueldos'])
  })
})
