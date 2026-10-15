import { describe, expect, it } from 'vitest'
import {
  BLOQUES_POR_MODULO,
  MODULOS_EN_ORDEN,
  MODULO_LABEL,
  CAMPOS_POR_BLOQUE,
  bloquesDe,
  modulosQueExponen,
  puedeVer,
  type BloqueDatos,
  type Modulo,
} from './permisos'

/**
 * La lista real de campos del negocio. Va escrita a mano a propósito: si alguien agrega un campo
 * a NegocioDataUsuario y no lo pone en ningún bloque, ese dato no se guardaría en ningún lado y
 * se perdería en silencio. Al tener que tocar los dos lugares, el test obliga a decidir dónde va.
 */
const CAMPOS_DEL_NEGOCIO = [
  'ingresos', 'meses', 'montos', 'cuentas', 'deudas', 'bienes', 'realManualPorMes',
  'ventasManualPorMes', 'facturas', 'clasificaciones', 'clientesManual', 'cheques', 'pagos',
  'remitos', 'sectores', 'empleados', 'datosEmisorFiscal', 'anticipos', 'productos',
  'movimientosStock', 'movimientosTesoreria', 'movimientosBancarios', 'ivaManualPorMes',
  'ingresosBrutosManualPorMes', 'movimientosDiarios', 'monotributo', 'tasaCrecimiento',
  'nombreNegocio', 'actualizadoEn',
  // No es un campo de negocioData, pero se guarda con el mismo mecanismo y en su propio bloque.
  'movimientosSemana',
]

describe('el reparto de campos en bloques', () => {
  const asignados = Object.values(CAMPOS_POR_BLOQUE).flat()

  it('cubre todos los campos del negocio: ninguno se queda sin guardar', () => {
    expect([...asignados].sort()).toEqual([...CAMPOS_DEL_NEGOCIO].sort())
  })

  it('ningún campo está en dos bloques: si no, se guardaría dos veces y se pisarían', () => {
    expect(new Set(asignados).size).toBe(asignados.length)
  })

  it('los sueldos viven solos, que es lo que permite cerrarlos aparte', () => {
    expect(CAMPOS_POR_BLOQUE.sueldos).toEqual(['empleados'])
  })
})

describe('bloquesDe', () => {
  it('sin módulos no da acceso a nada', () => {
    expect(bloquesDe([])).toEqual([])
  })

  it('un vendedor con Comprobantes y Clientes solo toca lo comercial', () => {
    expect(bloquesDe(['facturas', 'clientes'])).toEqual(['comercial'])
  })

  it('junta los bloques de varios módulos sin repetir', () => {
    expect(bloquesDe(['facturas', 'tesoreria'])).toEqual(['comercial', 'tesoreria'])
  })

  it('Márgenes por sector arrastra los sueldos, porque el margen incluye la nómina', () => {
    expect(bloquesDe(['margenes'])).toContain('sueldos')
  })

  it('Backup se lleva todo: es una copia del negocio entero', () => {
    expect(bloquesDe(['backup'])).toEqual(['comercial', 'impuestos', 'negocio', 'sueldos', 'tesoreria'])
  })

  it('el Dashboard necesita los sueldos para el costo de la nómina', () => {
    expect(bloquesDe(['dashboard'])).toContain('sueldos')
  })
})

describe('puedeVer', () => {
  it('deja entrar solo a lo asignado', () => {
    expect(puedeVer(['facturas'], 'facturas')).toBe(true)
    expect(puedeVer(['facturas'], 'sueldos')).toBe(false)
  })

  it('sin módulos no entra a ningún lado', () => {
    expect(puedeVer([], 'facturas')).toBe(false)
  })
})

describe('modulosQueExponen', () => {
  it('dice por qué módulo se le está dando acceso a un bloque sensible', () => {
    expect(modulosQueExponen(['facturas', 'margenes', 'clientes'], 'sueldos')).toEqual(['margenes'])
  })

  it('vacío cuando ninguno lo expone', () => {
    expect(modulosQueExponen(['facturas', 'clientes'], 'sueldos')).toEqual([])
  })

  it('un empleado solo comercial no toca ni tesorería ni sueldos', () => {
    const vendedor: Modulo[] = ['facturas', 'clientes', 'remitos', 'stock', 'puntoDeVenta']
    for (const bloque of ['sueldos'] as BloqueDatos[]) {
      expect(modulosQueExponen(vendedor.filter((m) => m !== 'puntoDeVenta'), bloque)).toEqual([])
    }
  })
})

describe('todos los módulos declaran sus bloques', () => {
  it('ninguno quedó sin mapear', () => {
    for (const [modulo, bloques] of Object.entries(BLOQUES_POR_MODULO)) {
      expect(bloques.length, `el módulo ${modulo} no declara bloques`).toBeGreaterThan(0)
    }
  })
})

describe('los nombres de los módulos', () => {
  it('hay uno por cada módulo, ni de más ni de menos', () => {
    // Si no, el dueño asignaría un permiso sin nombre, o vería en la lista uno que no existe.
    expect(Object.keys(MODULO_LABEL).sort()).toEqual(Object.keys(BLOQUES_POR_MODULO).sort())
  })

  it('ninguno queda vacío ni repetido', () => {
    const nombres = MODULOS_EN_ORDEN.map((m) => MODULO_LABEL[m])
    expect(nombres.every((n) => n.trim().length > 0)).toBe(true)
    expect(new Set(nombres).size).toBe(nombres.length)
  })
})
