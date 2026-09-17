import { describe, expect, it } from 'vitest'
import type { DatosReceptor, Factura } from './cfo'
import {
  ALICUOTAS_IVA,
  alicuotaIvaDeFactura,
  letraSugerida,
  mapearFacturaAPayload,
  referenciaExternaDeFactura,
  validarFacturaParaEmision,
  type OpcionesEmision,
} from './facturacionElectronica'

// El ejemplo oficial de Sistemas-360/facturacion-electronica-arca-examples, en node-typescript/
// src/crear-factura.ts. Es la referencia dorada: si el mapeo deja de producir esta forma, la
// integración se rompe contra la API real.
const EJEMPLO_OFICIAL = {
  tipo_comprobante: 'factura_b',
  concepto: 'productos',
  cliente: {
    documento_tipo: 'dni',
    documento_numero: '30111222',
    razon_social: 'Cliente Demo',
    condicion_iva_receptor_id: 5,
  },
  items: [
    {
      descripcion: 'Producto de ejemplo',
      cantidad: 1,
      precio_unitario: 10000,
      tipo_impuesto: 'gravado',
      iva: 21,
    },
  ],
  total: 12100,
  moneda: 'PES',
}

const CONSUMIDOR_FINAL: DatosReceptor = {
  documentoTipo: 'dni',
  documentoNumero: '30111222',
  razonSocial: 'Cliente Demo',
  condicionIvaReceptorId: 5,
}

const RESPONSABLE_INSCRIPTO: DatosReceptor = {
  documentoTipo: 'cuit',
  documentoNumero: '30710926146',
  razonSocial: 'Cliente Grande SA',
  condicionIvaReceptorId: 1,
}

const RI: OpcionesEmision = { condicionEmisor: 'responsable_inscripto' }
const MONOTRIBUTO: OpcionesEmision = { condicionEmisor: 'monotributo' }

function factura(extra: Partial<Factura> = {}): Factura {
  return {
    id: 'f1',
    tipo: 'emitida',
    tipoComprobante: 'factura',
    contraparte: 'Cliente Demo',
    monto: 12100,
    iva: 2100,
    fecha: '2026-09-17',
    detalle: 'Producto de ejemplo',
    receptor: CONSUMIDOR_FINAL,
    ...extra,
  }
}

describe('mapearFacturaAPayload', () => {
  it('reproduce el ejemplo oficial de la API', () => {
    const payload = mapearFacturaAPayload(factura(), RI)

    expect(payload).toMatchObject(EJEMPLO_OFICIAL)
    expect(payload.fecha).toBe('2026-09-17')
  })

  it('manda el precio unitario neto y el total con IVA', () => {
    const payload = mapearFacturaAPayload(factura(), RI)

    expect(payload.items[0].precio_unitario).toBe(10000)
    expect(payload.total).toBe(12100)
    // La relación que la API asume: neto por (1 + alícuota) da el total.
    expect(payload.items[0].precio_unitario * 1.21).toBeCloseTo(payload.total, 2)
  })

  it('emite A a un responsable inscripto y B a un consumidor final', () => {
    const aRI = mapearFacturaAPayload(factura({ receptor: RESPONSABLE_INSCRIPTO }), RI)
    const aCF = mapearFacturaAPayload(factura(), RI)

    expect(aRI.tipo_comprobante).toBe('factura_a')
    expect(aCF.tipo_comprobante).toBe('factura_b')
  })

  it('un monotributista emite C sin discriminar IVA', () => {
    const payload = mapearFacturaAPayload(factura({ iva: undefined }), MONOTRIBUTO)

    expect(payload.tipo_comprobante).toBe('factura_c')
    expect(payload.items[0].tipo_impuesto).toBe('sin_iva')
    expect(payload.items[0].iva).toBe(0)
    // En C el precio es el final: no se le descuenta nada al monto.
    expect(payload.items[0].precio_unitario).toBe(12100)
    expect(payload.total).toBe(12100)
  })

  it('marca como exento el comprobante con IVA cero', () => {
    const payload = mapearFacturaAPayload(factura({ monto: 10000, iva: 0 }), RI)

    expect(payload.items[0].tipo_impuesto).toBe('exento')
    expect(payload.items[0].iva).toBe(0)
    expect(payload.items[0].precio_unitario).toBe(10000)
  })

  it('usa una descripción genérica cuando la factura no trae detalle', () => {
    const payload = mapearFacturaAPayload(factura({ detalle: undefined }), RI)

    expect(payload.items[0].descripcion).toBe('Venta')
  })

  it('limpia los guiones del CUIT antes de mandarlo', () => {
    const conGuiones: DatosReceptor = { ...RESPONSABLE_INSCRIPTO, documentoNumero: '30-71092614-6' }
    const payload = mapearFacturaAPayload(factura({ receptor: conGuiones }), RI)

    expect(payload.cliente.documento_numero).toBe('30710926146')
  })

  it('redondea a dos decimales en vez de arrastrar centavos partidos', () => {
    const payload = mapearFacturaAPayload(factura({ monto: 1000.005, iva: 173.554 }), RI)

    expect(payload.total).toBe(1000.01)
    expect(payload.items[0].precio_unitario).toBe(826.45)
  })

  it('se niega a mapear una factura inválida en vez de mandar algo incoherente', () => {
    expect(() => mapearFacturaAPayload(factura({ receptor: undefined }), RI)).toThrow(
      /no está en condiciones de emitirse/,
    )
  })
})

describe('referenciaExternaDeFactura', () => {
  it('se deriva del id, así que reintentar manda la misma clave', () => {
    const f = factura({ id: 'abc-123' })

    expect(referenciaExternaDeFactura(f)).toBe('fincorp_abc-123')
    expect(referenciaExternaDeFactura(f)).toBe(referenciaExternaDeFactura({ ...f }))
  })

  it('cambia con la factura: dos comprobantes distintos nunca comparten clave', () => {
    expect(referenciaExternaDeFactura(factura({ id: 'a' }))).not.toBe(
      referenciaExternaDeFactura(factura({ id: 'b' })),
    )
  })
})

describe('alicuotaIvaDeFactura', () => {
  it('reconstruye la alícuota desde el importe de IVA', () => {
    expect(alicuotaIvaDeFactura(factura({ monto: 12100, iva: 2100 }))).toBe(21)
    expect(alicuotaIvaDeFactura(factura({ monto: 11050, iva: 1050 }))).toBe(10.5)
    expect(alicuotaIvaDeFactura(factura({ monto: 12700, iva: 2700 }))).toBe(27)
  })

  it('tolera el redondeo de centavos, no un IVA mal cargado', () => {
    // 21% de 10.000 son 2.100; dos pesos de diferencia siguen siendo 21%.
    expect(alicuotaIvaDeFactura(factura({ monto: 12102, iva: 2102 }))).toBe(21)
    // Un 15% no existe como alícuota: mejor devolver null que redondearlo a 10,5 o a 21.
    expect(alicuotaIvaDeFactura(factura({ monto: 11500, iva: 1500 }))).toBeNull()
  })

  it('devuelve cero cuando no hay IVA y null cuando el neto no es positivo', () => {
    expect(alicuotaIvaDeFactura(factura({ monto: 10000, iva: 0 }))).toBe(0)
    expect(alicuotaIvaDeFactura(factura({ monto: 1000, iva: 1000 }))).toBeNull()
  })

  it('sólo devuelve alícuotas que ARCA admite', () => {
    for (const alicuota of ALICUOTAS_IVA) {
      const neto = 10000
      const f = factura({ monto: neto * (1 + alicuota / 100), iva: neto * (alicuota / 100) })
      expect(alicuotaIvaDeFactura(f)).toBe(alicuota)
    }
  })
})

describe('letraSugerida', () => {
  it('un monotributista emite C a cualquiera', () => {
    expect(letraSugerida('monotributo', RESPONSABLE_INSCRIPTO)).toBe('c')
    expect(letraSugerida('monotributo', CONSUMIDOR_FINAL)).toBe('c')
  })

  it('un responsable inscripto emite A sólo a otro inscripto', () => {
    expect(letraSugerida('responsable_inscripto', RESPONSABLE_INSCRIPTO)).toBe('a')
    expect(letraSugerida('responsable_inscripto', CONSUMIDOR_FINAL)).toBe('b')
    // Monotributo (6) y exento (4) reciben B.
    expect(letraSugerida('responsable_inscripto', { ...CONSUMIDOR_FINAL, condicionIvaReceptorId: 6 })).toBe('b')
    expect(letraSugerida('responsable_inscripto', { ...CONSUMIDOR_FINAL, condicionIvaReceptorId: 4 })).toBe('b')
  })
})

describe('validarFacturaParaEmision', () => {
  it('no encuentra problemas en una factura completa', () => {
    expect(validarFacturaParaEmision(factura(), RI)).toEqual([])
  })

  it('rechaza emitir un comprobante recibido', () => {
    const problemas = validarFacturaParaEmision(factura({ tipo: 'recibida' }), RI)

    expect(problemas.some((p) => p.includes('recibido'))).toBe(true)
  })

  it('no deja re-emitir una factura que ya tiene CAE', () => {
    const emitida = factura({
      emision: {
        comprobanteId: '9001',
        referenciaExterna: 'fincorp_f1',
        estado: 'autorizado',
        cae: '75123456789012',
      },
    })

    expect(validarFacturaParaEmision(emitida, RI).some((p) => p.includes('ya tiene CAE'))).toBe(true)
  })

  it('deja reintentar una emisión que quedó en error', () => {
    const fallida = factura({
      emision: { comprobanteId: '9002', referenciaExterna: 'fincorp_f1', estado: 'error' },
    })

    expect(validarFacturaParaEmision(fallida, RI)).toEqual([])
  })

  it('exige CUIT y condición de inscripto para una factura A', () => {
    const problemas = validarFacturaParaEmision(factura(), { ...RI, letra: 'a' })

    expect(problemas.some((p) => p.includes('CUIT del receptor'))).toBe(true)
    expect(problemas.some((p) => p.includes('responsable inscripto'))).toBe(true)
  })

  it('valida el dígito verificador del CUIT', () => {
    const cuitFalso: DatosReceptor = { ...RESPONSABLE_INSCRIPTO, documentoNumero: '30710926148' }
    const problemas = validarFacturaParaEmision(factura({ receptor: cuitFalso }), RI)

    expect(problemas.some((p) => p.includes('no es válido'))).toBe(true)
  })

  it('exige discriminar el IVA en A y B, pero no en C', () => {
    const sinIva = factura({ iva: undefined })

    expect(validarFacturaParaEmision(sinIva, RI).some((p) => p.includes('discriminar el IVA'))).toBe(true)
    expect(validarFacturaParaEmision(sinIva, MONOTRIBUTO)).toEqual([])
  })

  it('frena una nota de crédito hasta tener el comprobante asociado verificado', () => {
    const nc = factura({ tipoComprobante: 'nota_credito' })

    expect(validarFacturaParaEmision(nc, RI).some((p) => p.includes('referenciar el comprobante'))).toBe(true)
  })

  it('junta todos los problemas en vez de cortar en el primero', () => {
    const rota = factura({ tipo: 'recibida', monto: 0, fecha: '17/09/2026', receptor: undefined })

    expect(validarFacturaParaEmision(rota, RI).length).toBeGreaterThanOrEqual(4)
  })
})
