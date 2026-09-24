import { describe, expect, it } from 'vitest'
import {
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
