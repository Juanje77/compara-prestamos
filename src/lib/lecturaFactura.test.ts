import { describe, expect, it } from 'vitest'
import {
  aFechaISO,
  aNumero,
  normalizarLecturaDelModelo,
  cuitValido,
  formatearCuit,
  numeroComprobante,
  revisarFacturaLeida,
  type FacturaLeida,
} from './lecturaFactura'

const HOY = new Date(2026, 8, 24)

/** Una lectura limpia: todos los campos legibles y las cuentas cerradas. */
const BUENA: FacturaLeida = {
  cuitEmisor: '30712345689',
  razonSocialEmisor: 'Distribuidora Sur SA',
  tipoComprobante: 'factura',
  letra: 'A',
  puntoVenta: 3,
  numero: 1234,
  fecha: '2026-09-20',
  neto: 100000,
  iva: 21000,
  total: 121000,
  cae: '75123456789012',
}

describe('cuitValido', () => {
  it('acepta un CUIT con dígito verificador correcto', () => {
    expect(cuitValido('30712345689')).toBe(true)
    expect(cuitValido('30-71234568-9')).toBe(true)
  })

  it('rechaza un dígito mal leído, que es el error típico de una foto', () => {
    expect(cuitValido('30712345688')).toBe(false)
  })

  it('rechaza lo que no tiene once dígitos', () => {
    expect(cuitValido('3071234568')).toBe(false)
    expect(cuitValido('')).toBe(false)
    expect(cuitValido(undefined)).toBe(false)
  })

  it('rechaza los once dígitos iguales, que pasan el módulo 11 pero no existen', () => {
    expect(cuitValido('00000000000')).toBe(false)
  })
})

describe('formatearCuit', () => {
  it('lo escribe como se lee en la factura', () => {
    expect(formatearCuit('30712345689')).toBe('30-71234568-9')
  })

  it('deja como está lo que no parece un CUIT', () => {
    expect(formatearCuit('123')).toBe('123')
  })
})

describe('revisarFacturaLeida', () => {
  it('una lectura limpia y con el CUIT confirmado se puede cargar sola', () => {
    const r = revisarFacturaLeida(BUENA, { hoy: HOY, cuitVerificado: true })
    expect(r.confiable).toBe(true)
    expect(r.motivos).toEqual([])
  })

  it('sin confirmar el CUIT contra ARCA, no se carga sola', () => {
    const r = revisarFacturaLeida(BUENA, { hoy: HOY })
    expect(r.confiable).toBe(false)
    expect(r.motivos).toContain('cuit-no-verificado')
  })

  it('manda a revisar si el neto más el IVA no da el total', () => {
    const r = revisarFacturaLeida({ ...BUENA, iva: 31000 }, { hoy: HOY, cuitVerificado: true })
    expect(r.motivos).toContain('totales-no-cierran')
  })

  it('tolera el redondeo de las alícuotas', () => {
    const r = revisarFacturaLeida({ ...BUENA, total: 121000.5 }, { hoy: HOY, cuitVerificado: true })
    expect(r.confiable).toBe(true)
  })

  it('una factura C no discrimina IVA, así que no se le exige que la suma cierre', () => {
    const c: FacturaLeida = { ...BUENA, letra: 'C', neto: undefined, iva: undefined, total: 121000 }
    expect(revisarFacturaLeida(c, { hoy: HOY, cuitVerificado: true }).confiable).toBe(true)
  })

  it('avisa por cada campo que no se pudo leer', () => {
    const r = revisarFacturaLeida({}, { hoy: HOY })
    expect(r.motivos).toContain('falta-total')
    expect(r.motivos).toContain('falta-fecha')
    expect(r.motivos).toContain('falta-cuit')
  })

  it('un CUIT mal leído se marca como inválido, no como faltante', () => {
    const r = revisarFacturaLeida({ ...BUENA, cuitEmisor: '30712345688' }, { hoy: HOY, cuitVerificado: true })
    expect(r.motivos).toContain('cuit-invalido')
    expect(r.motivos).not.toContain('falta-cuit')
  })

  it('desconfía de una fecha posterior a hoy', () => {
    const r = revisarFacturaLeida({ ...BUENA, fecha: '2026-12-01' }, { hoy: HOY, cuitVerificado: true })
    expect(r.motivos).toContain('fecha-futura')
  })

  it('desconfía de una fecha de hace más de un año: suele ser un año mal leído', () => {
    const r = revisarFacturaLeida({ ...BUENA, fecha: '2024-09-20' }, { hoy: HOY, cuitVerificado: true })
    expect(r.motivos).toContain('fecha-muy-vieja')
  })

  it('un total en cero no sirve, aunque venga cargado', () => {
    expect(revisarFacturaLeida({ ...BUENA, total: 0 }, { hoy: HOY, cuitVerificado: true }).motivos).toContain(
      'falta-total',
    )
  })

  it('si ya está cargada, va a revisión en vez de duplicarse', () => {
    const r = revisarFacturaLeida(BUENA, { hoy: HOY, cuitVerificado: true, duplicada: true })
    expect(r.confiable).toBe(false)
    expect(r.motivos).toContain('duplicada')
  })
})

describe('numeroComprobante', () => {
  it('lo arma con el formato de ARCA', () => {
    expect(numeroComprobante(3, 1234)).toBe('0003-00001234')
  })

  it('sin punto de venta o sin número, no hay número que armar', () => {
    expect(numeroComprobante(undefined, 1234)).toBeUndefined()
    expect(numeroComprobante(3, undefined)).toBeUndefined()
  })
})

describe('aNumero', () => {
  it('lee un importe escrito a la argentina', () => {
    expect(aNumero('$ 1.234.567,89')).toBeCloseTo(1234567.89, 2)
    expect(aNumero('121.000,00')).toBeCloseTo(121000, 2)
  })

  it('lee también el formato con punto decimal, por si la factura viene así', () => {
    expect(aNumero('1234567.89')).toBeCloseTo(1234567.89, 2)
    expect(aNumero('1,234,567.89')).toBeCloseTo(1234567.89, 2)
  })

  it('deja pasar un número que ya es número', () => {
    expect(aNumero(121000)).toBe(121000)
  })

  it('no inventa nada con lo que no se entiende', () => {
    expect(aNumero('')).toBeUndefined()
    expect(aNumero('no legible')).toBeUndefined()
    expect(aNumero(null)).toBeUndefined()
  })
})

describe('aFechaISO', () => {
  it('convierte el formato en que se imprime una factura argentina', () => {
    expect(aFechaISO('20/09/2026')).toBe('2026-09-20')
    expect(aFechaISO('5-9-2026')).toBe('2026-09-05')
  })

  it('acepta dos dígitos de año', () => {
    expect(aFechaISO('20/09/26')).toBe('2026-09-20')
  })

  it('deja pasar una fecha que ya viene en ISO', () => {
    expect(aFechaISO('2026-09-20')).toBe('2026-09-20')
  })

  it('rechaza lo que no es una fecha', () => {
    expect(aFechaISO('32/09/2026')).toBeUndefined()
    expect(aFechaISO('20/13/2026')).toBeUndefined()
    expect(aFechaISO('ayer')).toBeUndefined()
    expect(aFechaISO(undefined)).toBeUndefined()
  })
})

describe('normalizarLecturaDelModelo', () => {
  it('normaliza una respuesta con los valores como están impresos', () => {
    const leida = normalizarLecturaDelModelo({
      cuitEmisor: '30-71234568-9',
      razonSocialEmisor: '  Distribuidora Sur SA  ',
      tipoComprobante: 'Factura A',
      letra: 'a',
      puntoVenta: '0003',
      numero: '00001234',
      fecha: '20/09/2026',
      neto: '$ 100.000,00',
      iva: '$ 21.000,00',
      total: '$ 121.000,00',
      cae: '7512 3456 7890 12',
    })
    expect(leida).toEqual({
      cuitEmisor: '30712345689',
      razonSocialEmisor: 'Distribuidora Sur SA',
      tipoComprobante: 'factura',
      letra: 'A',
      puntoVenta: 3,
      numero: 1234,
      fecha: '2026-09-20',
      neto: 100000,
      iva: 21000,
      total: 121000,
      cae: '75123456789012',
    })
  })

  it('reconoce las notas de crédito y de débito', () => {
    expect(normalizarLecturaDelModelo({ tipoComprobante: 'Nota de Crédito B' }).tipoComprobante).toBe('nota_credito')
    expect(normalizarLecturaDelModelo({ tipoComprobante: 'NOTA DE DEBITO' }).tipoComprobante).toBe('nota_debito')
  })

  it('lo que no se pudo leer queda vacío, para que lo agarre la revisión', () => {
    const leida = normalizarLecturaDelModelo({ cuitEmisor: 'no legible', total: 'ilegible', fecha: '??' })
    expect(leida.cuitEmisor).toBeUndefined()
    expect(leida.total).toBeUndefined()
    expect(leida.fecha).toBeUndefined()
  })

  it('una respuesta que no es un objeto no rompe: devuelve todo vacío', () => {
    expect(normalizarLecturaDelModelo(null)).toEqual({})
    expect(normalizarLecturaDelModelo('error')).toEqual({})
  })
})
