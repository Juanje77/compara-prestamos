import { describe, expect, it } from 'vitest'
import type { DatosReceptor, Factura } from './cfo'
import {
  ALICUOTAS_IVA,
  alicuotaIvaDeFactura,
  letraSugerida,
  mapearFacturaAPayload,
  numeroComprobanteFormateado,
  identificarComprobante,
  referenciaApiDe,
  interpretarRespuestaEmision,
  montoDisponibleParaNota,
  validarNota,
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

// Las validaciones miran la fecha contra "hoy": se fija para que los tests no caduquen.
const HOY = new Date('2026-09-17T12:00:00Z')

const RI: OpcionesEmision = { condicionEmisor: 'responsable_inscripto', hoy: HOY }
const MONOTRIBUTO: OpcionesEmision = { condicionEmisor: 'monotributo', hoy: HOY }

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
    // El contrato prohíbe mandar estos dos campos en clase C.
    expect(payload.items[0]).not.toHaveProperty('tipo_impuesto')
    expect(payload.items[0]).not.toHaveProperty('iva')
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

  it('manda documento_numero en null para consumidor final, como pide el contrato', () => {
    const anonimo: DatosReceptor = {
      documentoTipo: 'consumidor_final',
      // Aunque quedara un número viejo cargado, no se manda: el contrato lo quiere en null.
      documentoNumero: '30111222',
      razonSocial: 'Consumidor Final',
      condicionIvaReceptorId: 5,
    }
    const payload = mapearFacturaAPayload(factura({ receptor: anonimo }), RI)

    expect(payload.cliente.documento_numero).toBeNull()
    expect(payload.cliente.documento_tipo).toBe('consumidor_final')
  })

  it('manda el punto de venta cuando está configurado', () => {
    expect(mapearFacturaAPayload(factura(), { ...RI, puntoVenta: 3 }).punto_venta).toBe(3)
    expect(mapearFacturaAPayload(factura(), RI).punto_venta).toBeUndefined()
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

  it('un responsable inscripto emite A a quienes el contrato pone en clase A', () => {
    // Clase A: responsable inscripto (1), monotributo (6), monotributista social (13) y
    // trabajador independiente promovido (16). Todos con CUIT.
    for (const id of [1, 6, 13, 16] as const) {
      expect(letraSugerida('responsable_inscripto', { ...RESPONSABLE_INSCRIPTO, condicionIvaReceptorId: id })).toBe('a')
    }
    // Clase B: el resto, incluido el consumidor final (5) y el exento (4).
    for (const id of [4, 5, 7, 8, 9, 10, 15] as const) {
      expect(letraSugerida('responsable_inscripto', { ...CONSUMIDOR_FINAL, condicionIvaReceptorId: id })).toBe('b')
    }
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

  it('frena una factura fuera de la ventana de fechas que admite ARCA', () => {
    // Productos: 5 días. Una factura de hace dos semanas ya no se puede autorizar con su fecha.
    const vieja = factura({ fecha: '2026-09-01' })
    const problemas = validarFacturaParaEmision(vieja, RI)

    expect(problemas.some((p) => p.includes('dentro de los 5 días'))).toBe(true)
    // Dentro de la ventana, incluso a futuro, no molesta.
    expect(validarFacturaParaEmision(factura({ fecha: '2026-09-14' }), RI)).toEqual([])
    expect(validarFacturaParaEmision(factura({ fecha: '2026-09-20' }), RI)).toEqual([])
  })

  it('servicios tiene una ventana más ancha que productos', () => {
    const f = factura({ fecha: '2026-09-09' })

    expect(validarFacturaParaEmision(f, RI).some((p) => p.includes('5 días'))).toBe(true)
    expect(validarFacturaParaEmision(f, { ...RI, concepto: 'servicios' })).toEqual([])
  })

  it('exige discriminar el IVA en A y B, pero no en C', () => {
    const sinIva = factura({ iva: undefined })

    expect(validarFacturaParaEmision(sinIva, RI).some((p) => p.includes('discriminar el IVA'))).toBe(true)
    expect(validarFacturaParaEmision(sinIva, MONOTRIBUTO)).toEqual([])
  })

  it('frena una nota de crédito que no dice qué comprobante corrige', () => {
    const nc = factura({ tipoComprobante: 'nota_credito' })

    expect(validarFacturaParaEmision(nc, RI).some((p) => p.includes('qué comprobante corrige'))).toBe(true)
  })

  it('junta todos los problemas en vez de cortar en el primero', () => {
    const rota = factura({ tipo: 'recibida', monto: 0, fecha: '17/09/2026', receptor: undefined })

    expect(validarFacturaParaEmision(rota, RI).length).toBeGreaterThanOrEqual(4)
  })
})

describe('interpretarRespuestaEmision', () => {
  const CUANDO = '2026-09-17T15:00:00.000Z'

  // La respuesta real del contrato: { ok, mensaje, data: ReceiptDetail }.
  const RESPUESTA_AUTORIZADA = {
    ok: true,
    mensaje: 'Comprobante autorizado.',
    data: {
      id: 9001,
      estado: 'autorizado',
      tipo_comprobante: 'factura_b',
      punto_venta: 3,
      numero_comprobante: 145,
      cae: '75123456789012',
      cae_vencimiento: '2026-09-27',
      qr: { url: 'https://www.afip.gob.ar/fe/qr/?p=abc' },
      imprimir_a4_url: 'https://api.sistemas360.ar/api/comprobantes/9001/imprimir-a4',
      imprimir_ticket_url: 'https://api.sistemas360.ar/api/comprobantes/9001/imprimir-ticket',
      mensajes_arca: [],
    },
  }

  it('lee la respuesta autorizada tal como la define el contrato', () => {
    const r = interpretarRespuestaEmision('fincorp_f1', RESPUESTA_AUTORIZADA, CUANDO)

    expect(r).toMatchObject({
      comprobanteId: '9001',
      referenciaExterna: 'fincorp_f1',
      estado: 'autorizado',
      cae: '75123456789012',
      caeVencimiento: '2026-09-27',
      puntoVenta: 3,
      numeroComprobante: 145,
      qr: 'https://www.afip.gob.ar/fe/qr/?p=abc',
      pdfA4: 'https://api.sistemas360.ar/api/comprobantes/9001/imprimir-a4',
      pdfTicket: 'https://api.sistemas360.ar/api/comprobantes/9001/imprimir-ticket',
      emitidoEl: CUANDO,
    })
  })

  it('distingue pendiente_confirmacion, que es el estado peligroso', () => {
    const r = interpretarRespuestaEmision(
      'fincorp_f1',
      { ok: true, data: { id: 9002, estado: 'pendiente_confirmacion', numero_comprobante: 0, cae: null } },
      CUANDO,
    )

    // ARCA puede haber autorizado igual: se resuelve consultando, no emitiendo otra vez.
    expect(r.estado).toBe('pendiente_confirmacion')
    expect(r.comprobanteId).toBe('9002')
    expect(r.cae).toBeUndefined()
  })

  it('NO marca autorizado sin CAE, aunque el estado diga que sí', () => {
    const r = interpretarRespuestaEmision('fincorp_f1', { data: { estado: 'autorizado', numero_comprobante: 145 } }, CUANDO)

    expect(r.estado).toBe('pendiente')
    expect(r.cae).toBeUndefined()
  })

  it('no confunde un CAE vacío con uno presente', () => {
    expect(interpretarRespuestaEmision('fincorp_f1', { data: { cae: '' } }, CUANDO).estado).toBe('pendiente')
    expect(interpretarRespuestaEmision('fincorp_f1', { data: { cae: null } }, CUANDO).estado).toBe('pendiente')
  })

  it('sobrevive a una respuesta que no es un objeto', () => {
    for (const basura of [null, undefined, 'ok', 42, []]) {
      const r = interpretarRespuestaEmision('fincorp_f1', basura, CUANDO)
      expect(r.estado).toBe('pendiente')
      expect(r.referenciaExterna).toBe('fincorp_f1')
    }
  })

  it('trae los mensajes de ARCA, que el contrato define como lista de objetos', () => {
    const conMensajes = {
      data: { mensajes_arca: [{ code: 10015, msg: 'Factura autorizada con observaciones' }] },
    }

    expect(interpretarRespuestaEmision('r', conMensajes, CUANDO).mensajes).toEqual([
      '{"code":10015,"msg":"Factura autorizada con observaciones"}',
    ])
    // Una lista vacía no es un mensaje.
    expect(interpretarRespuestaEmision('r', { data: { mensajes_arca: [] } }, CUANDO).mensajes).toBeUndefined()
    expect(interpretarRespuestaEmision('r', {}, CUANDO).mensajes).toBeUndefined()
  })
})

describe('numeroComprobanteFormateado', () => {
  const autorizada = (extra = {}) => ({
    comprobanteId: '9001',
    referenciaExterna: 'fincorp_f1',
    estado: 'autorizado' as const,
    cae: '75123456789012',
    puntoVenta: 3,
    numeroComprobante: 145,
    ...extra,
  })

  it('arma el número oficial con el formato de ARCA', () => {
    expect(numeroComprobanteFormateado(autorizada())).toBe('0003-00000145')
  })

  it('usa el punto de venta configurado cuando la respuesta no lo trae', () => {
    expect(numeroComprobanteFormateado(autorizada({ puntoVenta: undefined }), '3')).toBe('0003-00000145')
  })

  it('prefiere el punto de venta de la respuesta al configurado', () => {
    expect(numeroComprobanteFormateado(autorizada({ puntoVenta: 7 }), '3')).toBe('0007-00000145')
  })

  it('no pisa el número de una factura que no quedó autorizada', () => {
    expect(numeroComprobanteFormateado(autorizada({ estado: 'pendiente' }))).toBeUndefined()
    expect(numeroComprobanteFormateado(autorizada({ estado: 'rechazado' }))).toBeUndefined()
  })

  it('no inventa nada si falta el número o el punto de venta', () => {
    expect(numeroComprobanteFormateado(autorizada({ numeroComprobante: undefined }))).toBeUndefined()
    expect(numeroComprobanteFormateado(autorizada({ puntoVenta: undefined }))).toBeUndefined()
    expect(numeroComprobanteFormateado(autorizada({ puntoVenta: undefined }), 'sin número')).toBeUndefined()
  })

  it('no recorta un número largo', () => {
    expect(numeroComprobanteFormateado(autorizada({ puntoVenta: 12345, numeroComprobante: 123456789 }))).toBe(
      '12345-123456789',
    )
  })
})

describe('notas de crédito y débito', () => {
  const ORIGINAL: Factura = {
    id: 'orig',
    tipo: 'emitida',
    tipoComprobante: 'factura',
    contraparte: 'Cliente Demo',
    monto: 12100,
    iva: 2100,
    fecha: '2026-09-10',
    receptor: CONSUMIDOR_FINAL,
    emision: {
      comprobanteId: '900',
      referenciaExterna: 'fincorp_orig',
      estado: 'autorizado',
      cae: '75123456789012',
      puntoVenta: 3,
      numeroComprobante: 145,
    },
  }

  const nota = (extra: Partial<Factura> = {}): Factura => ({
    ...factura(),
    id: 'nc1',
    tipoComprobante: 'nota_credito',
    comprobanteAsociadoId: 'orig',
    monto: 6050,
    iva: 1050,
    ...extra,
  })

  describe('identificarComprobante', () => {
    it('usa el punto de venta y el número de la emisión', () => {
      expect(identificarComprobante(ORIGINAL)).toEqual({ puntoVenta: 3, numero: 145 })
    })

    it('parsea el número cargado a mano', () => {
      const manual = { ...ORIGINAL, emision: undefined, numero: '0007-00001234' }
      expect(identificarComprobante(manual)).toEqual({ puntoVenta: 7, numero: 1234 })
    })

    it('no identifica una factura sin número ni emisión autorizada', () => {
      expect(identificarComprobante({ ...ORIGINAL, emision: undefined, numero: undefined })).toBeNull()
      expect(identificarComprobante({ ...ORIGINAL, emision: undefined, numero: 'A-15' })).toBeNull()
      // Una emisión pendiente no sirve como referencia: todavía no hay comprobante ante ARCA.
      const pendiente = { ...ORIGINAL, emision: { ...ORIGINAL.emision!, estado: 'pendiente' as const } }
      expect(identificarComprobante({ ...pendiente, numero: undefined })).toBeNull()
    })
  })

  describe('referenciaApiDe', () => {
    it('prefiere el id que le dio la API al original', () => {
      expect(referenciaApiDe(ORIGINAL)).toEqual({ comprobante_asociado_id: 900 })
    })

    it('cae a la referencia externa cuando no hay id numérico', () => {
      const sinId = { ...ORIGINAL, emision: { ...ORIGINAL.emision!, comprobanteId: '' } }
      expect(referenciaApiDe(sinId)).toEqual({ referencia_externa_asociada: 'fincorp_orig' })
    })

    it('devuelve null si el original nunca pasó por la API', () => {
      // Tiene número de ARCA anotado a mano, pero la API no lo conoce: no se le puede asociar nada.
      const manual = { ...ORIGINAL, emision: undefined, numero: '0007-00001234' }
      expect(referenciaApiDe(manual)).toBeNull()
    })
  })

  describe('montoDisponibleParaNota', () => {
    it('sin notas previas queda todo el original', () => {
      expect(montoDisponibleParaNota(ORIGINAL, [ORIGINAL])).toBe(12100)
    })

    it('descuenta las notas de crédito ya aplicadas', () => {
      expect(montoDisponibleParaNota(ORIGINAL, [ORIGINAL, nota()])).toBe(6050)
      expect(montoDisponibleParaNota(ORIGINAL, [ORIGINAL, nota(), nota({ id: 'nc2', monto: 6050 })])).toBe(0)
    })

    it('ignora las notas de otro comprobante y las de débito', () => {
      const deOtro = nota({ id: 'nc3', comprobanteAsociadoId: 'otra' })
      const debito = nota({ id: 'nd1', tipoComprobante: 'nota_debito' })
      expect(montoDisponibleParaNota(ORIGINAL, [ORIGINAL, deOtro, debito])).toBe(12100)
    })

    it('nunca devuelve negativo', () => {
      expect(montoDisponibleParaNota(ORIGINAL, [ORIGINAL, nota({ monto: 99999 })])).toBe(0)
    })
  })

  describe('validarNota', () => {
    it('acepta una nota bien formada', () => {
      expect(validarNota(nota(), ORIGINAL, [ORIGINAL])).toEqual([])
    })

    it('exige indicar el comprobante que corrige', () => {
      const suelta = nota({ comprobanteAsociadoId: undefined })
      expect(validarNota(suelta, undefined, [])).toEqual(['La nota tiene que indicar qué comprobante corrige.'])
    })

    it('avisa cuando el original no aparece', () => {
      expect(validarNota(nota(), undefined, [])[0]).toMatch(/No se encuentra/)
    })

    it('no deja acreditar más de lo que queda del original', () => {
      const previa = nota({ id: 'nc0', monto: 10000 })
      const problemas = validarNota(nota({ monto: 5000 }), ORIGINAL, [ORIGINAL, previa])
      expect(problemas.some((p) => p.includes('no puede superar'))).toBe(true)
    })

    it('al editar una nota no se cuenta a sí misma', () => {
      const existente = nota({ monto: 12100 })
      expect(validarNota(existente, ORIGINAL, [ORIGINAL, existente])).toEqual([])
    })

    it('una nota de débito no está limitada por el monto del original', () => {
      const debito = nota({ tipoComprobante: 'nota_debito', monto: 99999 })
      expect(validarNota(debito, ORIGINAL, [ORIGINAL])).toEqual([])
    })

    it('exige que el original tenga número de ARCA', () => {
      const sinNumero = { ...ORIGINAL, emision: undefined, numero: undefined }
      expect(validarNota(nota(), sinNumero, [sinNumero]).some((p) => p.includes('número de ARCA'))).toBe(true)
    })

    it('no deja corregir una nota con otra nota', () => {
      const sobreNota = { ...ORIGINAL, tipoComprobante: 'nota_credito' as const }
      expect(validarNota(nota(), sobreNota, [sobreNota]).some((p) => p.includes('no otra nota'))).toBe(true)
    })

    it('no mezcla emitidas con recibidas', () => {
      const recibida = { ...ORIGINAL, tipo: 'recibida' as const }
      expect(validarNota(nota(), recibida, [recibida]).some((p) => p.includes('los dos emitidos'))).toBe(true)
    })
  })

  describe('emisión de notas', () => {
    const opcionesNota = { ...RI, original: ORIGINAL, facturas: [ORIGINAL] }

    it('una nota sobre un comprobante emitido desde el sistema ya se puede emitir', () => {
      expect(validarFacturaParaEmision(nota({ fecha: '2026-09-17' }), opcionesNota)).toEqual([])
    })

    it('el payload lleva el id del comprobante que corrige', () => {
      const payload = mapearFacturaAPayload(nota({ fecha: '2026-09-17' }), opcionesNota)

      expect(payload.tipo_comprobante).toBe('nota_credito_b')
      expect(payload.comprobante_asociado_id).toBe(900)
      expect(payload.referencia_externa).toBe('fincorp_nc1')
    })

    it('una factura no lleva referencia de asociado', () => {
      expect(mapearFacturaAPayload(factura(), RI).comprobante_asociado_id).toBeUndefined()
    })

    it('frena la nota sobre una factura que la API no conoce', () => {
      const manual = { ...ORIGINAL, emision: undefined, numero: '0007-00001234' }
      const problemas = validarFacturaParaEmision(nota({ fecha: '2026-09-17' }), {
        ...RI,
        original: manual,
        facturas: [manual],
      })

      expect(problemas.some((p) => p.includes('no se emitió desde el sistema'))).toBe(true)
    })
  })
})
