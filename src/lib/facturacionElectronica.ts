// Mapeo de una factura de FinCorp al comprobante que espera la API de facturación electrónica.
//
// Este módulo NO habla con la API: sólo arma y valida el cuerpo del pedido. La llamada la hace el
// backend, porque el token de emisión es una credencial que no puede vivir en el navegador (lo
// dice la propia documentación del proveedor). Acá queda todo lo que se puede construir, probar y
// versionar sin red, que es también lo que después consume ese backend.
//
// Referencia: https://github.com/Sistemas-360/facturacion-electronica-arca-examples
// El payload de `POST /api/comprobantes` está tomado del ejemplo oficial en TypeScript. Lo que no
// aparece verbatim en ese ejemplo queda marcado abajo como pendiente de verificar contra el
// contrato OpenAPI (`/docs/openapi/download`).

import type {
  CondicionEmisor,
  CondicionIvaReceptorId,
  DatosReceptor,
  Factura,
  ResultadoEmision,
} from './cfo'
import { esCuitValido, limpiarCuit } from './cuit'

/** Letra del comprobante. La define la condición de IVA del emisor cruzada con la del receptor. */
export type LetraComprobante = 'a' | 'b' | 'c'

export type { CondicionEmisor }

/** Sólo `productos` está confirmado contra el ejemplo oficial. */
export type ConceptoComprobante = 'productos' | 'servicios' | 'productos_y_servicios'

/** Sólo `gravado` está confirmado contra el ejemplo oficial. */
export type TipoImpuestoItem = 'gravado' | 'exento' | 'no_gravado' | 'sin_iva'

/** Alícuotas de IVA vigentes en ARCA. */
export const ALICUOTAS_IVA = [0, 2.5, 5, 10.5, 21, 27] as const

export interface ItemComprobante {
  descripcion: string
  cantidad: number
  /** Precio unitario NETO, sin IVA — en el ejemplo oficial 10.000 con IVA 21 da un total de 12.100. */
  precio_unitario: number
  tipo_impuesto: TipoImpuestoItem
  /** Alícuota en porcentaje, no el importe. */
  iva: number
}

export interface PayloadComprobante {
  tipo_comprobante: string
  concepto: ConceptoComprobante
  fecha: string
  referencia_externa: string
  cliente: {
    documento_tipo: string
    documento_numero: string
    razon_social: string
    condicion_iva_receptor_id: CondicionIvaReceptorId
  }
  items: ItemComprobante[]
  total: number
  moneda: 'PES'
}

export interface OpcionesEmision {
  condicionEmisor: CondicionEmisor
  concepto?: ConceptoComprobante
  /** Fuerza la letra en vez de derivarla del receptor. */
  letra?: LetraComprobante
}

/** Condiciones de IVA del receptor que habilitan una factura A. */
const CONDICIONES_FACTURA_A: CondicionIvaReceptorId[] = [1, 10]

function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales
  return Math.round(valor * factor) / factor
}

/**
 * Clave de idempotencia de la emisión. Se deriva del id de la factura, así que reintentar una
 * emisión que se cortó manda exactamente la misma referencia y la API devuelve el comprobante ya
 * registrado en vez de duplicarlo. Es la pieza que evita el peor escenario: un CAE otorgado que
 * el sistema no llegó a ver.
 */
export function referenciaExternaDeFactura(f: Factura): string {
  return `fincorp_${f.id}`
}

/**
 * Alícuota de IVA de la factura, en porcentaje. FinCorp guarda el IVA como importe, no como tasa,
 * así que hay que reconstruirla y encajarla en una de las alícuotas que ARCA admite. Si el importe
 * cargado no se aproxima a ninguna, devuelve `null` en vez de inventar una.
 */
export function alicuotaIvaDeFactura(f: Factura): number | null {
  const iva = f.iva ?? 0
  const neto = f.monto - iva
  if (neto <= 0) return null
  if (iva === 0) return 0

  const tasa = (iva / neto) * 100
  const candidata = ALICUOTAS_IVA.reduce((mejor, a) =>
    Math.abs(a - tasa) < Math.abs(mejor - tasa) ? a : mejor,
  )

  // Medio punto de tolerancia: absorbe el redondeo de los centavos, no un IVA mal cargado.
  return Math.abs(candidata - tasa) <= 0.5 ? candidata : null
}

/** Letra que corresponde emitir. Un monotributista siempre emite C. */
export function letraSugerida(
  condicionEmisor: CondicionEmisor,
  receptor: DatosReceptor,
): LetraComprobante {
  if (condicionEmisor === 'monotributo') return 'c'
  return CONDICIONES_FACTURA_A.includes(receptor.condicionIvaReceptorId) ? 'a' : 'b'
}

function descripcionItem(f: Factura): string {
  const detalle = f.detalle?.trim()
  if (detalle) return detalle
  return f.tipoComprobante === 'factura' ? 'Venta' : 'Ajuste de facturación'
}

function documentoValido(receptor: DatosReceptor): boolean {
  const numero = limpiarCuit(receptor.documentoNumero)
  switch (receptor.documentoTipo) {
    case 'cuit':
    case 'cuil':
      return esCuitValido(numero)
    case 'dni':
      return /^\d{7,8}$/.test(numero)
    case 'sin_identificar':
      return true
  }
}

/**
 * Todo lo que impide emitir esta factura, en castellano y listo para mostrar. Devuelve una lista
 * vacía cuando el comprobante está en condiciones. La idea es que el usuario vea los problemas
 * juntos y de una vez, no de a uno por intento fallido.
 */
export function validarFacturaParaEmision(f: Factura, opciones: OpcionesEmision): string[] {
  const problemas: string[] = []

  if (f.tipo !== 'emitida') {
    problemas.push('Sólo se pueden emitir comprobantes propios: éste está cargado como recibido.')
  }

  if (f.emision?.estado === 'autorizado') {
    problemas.push('Esta factura ya tiene CAE. Para corregirla hay que emitir una nota de crédito.')
  }

  if (f.tipoComprobante !== 'factura') {
    problemas.push(
      'Las notas de crédito y débito necesitan referenciar el comprobante que corrigen, un campo que todavía no está verificado contra el contrato OpenAPI.',
    )
  }

  if (!(f.monto > 0)) {
    problemas.push('El monto tiene que ser mayor a cero.')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) {
    problemas.push('La fecha del comprobante no es válida.')
  }

  const receptor = f.receptor
  if (!receptor) {
    problemas.push('Faltan los datos fiscales del receptor: documento, razón social y condición de IVA.')
    return problemas
  }

  if (!receptor.razonSocial.trim()) {
    problemas.push('Falta la razón social del receptor.')
  }

  if (!documentoValido(receptor)) {
    problemas.push(`El documento del receptor no es válido para el tipo "${receptor.documentoTipo}".`)
  }

  const letra = opciones.letra ?? letraSugerida(opciones.condicionEmisor, receptor)

  if (letra === 'a') {
    if (receptor.documentoTipo !== 'cuit') {
      problemas.push('Una factura A exige el CUIT del receptor.')
    }
    if (!CONDICIONES_FACTURA_A.includes(receptor.condicionIvaReceptorId)) {
      problemas.push('Una factura A sólo se le emite a un responsable inscripto.')
    }
  }

  if (letra !== 'c') {
    if (f.iva === undefined) {
      problemas.push('Falta discriminar el IVA: una factura A o B no se puede emitir sin él.')
    } else if (alicuotaIvaDeFactura(f) === null) {
      problemas.push('El IVA cargado no se corresponde con ninguna alícuota vigente (0, 2,5, 5, 10,5, 21 o 27%).')
    }
  }

  return problemas
}

/**
 * Arma el cuerpo de `POST /api/comprobantes` a partir de una factura. Asume que
 * `validarFacturaParaEmision` no devolvió problemas; si igual se lo llama con una factura
 * inválida, lanza en vez de mandar algo incoherente a ARCA.
 */
export function mapearFacturaAPayload(f: Factura, opciones: OpcionesEmision): PayloadComprobante {
  const problemas = validarFacturaParaEmision(f, opciones)
  if (problemas.length > 0) {
    throw new Error(`La factura no está en condiciones de emitirse: ${problemas.join(' ')}`)
  }

  // Ya validado arriba: si faltara el receptor, `validarFacturaParaEmision` habría cortado.
  const receptor = f.receptor as DatosReceptor
  const letra = opciones.letra ?? letraSugerida(opciones.condicionEmisor, receptor)

  // En una factura C el precio es el final: no hay IVA que discriminar. En A y B el precio
  // unitario va neto y el total con IVA, como en el ejemplo oficial.
  const esC = letra === 'c'
  const alicuota = esC ? 0 : (alicuotaIvaDeFactura(f) ?? 0)
  const neto = esC ? f.monto : f.monto - (f.iva ?? 0)

  const tipoImpuesto: TipoImpuestoItem = esC ? 'sin_iva' : alicuota > 0 ? 'gravado' : 'exento'

  return {
    tipo_comprobante: `${f.tipoComprobante}_${letra}`,
    concepto: opciones.concepto ?? 'productos',
    fecha: f.fecha,
    referencia_externa: referenciaExternaDeFactura(f),
    cliente: {
      documento_tipo: receptor.documentoTipo,
      documento_numero: limpiarCuit(receptor.documentoNumero),
      razon_social: receptor.razonSocial.trim(),
      condicion_iva_receptor_id: receptor.condicionIvaReceptorId,
    },
    items: [
      {
        descripcion: descripcionItem(f),
        cantidad: 1,
        precio_unitario: redondear(neto),
        tipo_impuesto: tipoImpuesto,
        iva: alicuota,
      },
    ],
    total: redondear(f.monto),
    moneda: 'PES',
  }
}

// --- Lectura de la respuesta -----------------------------------------------------------------
//
// La documentación dice que una respuesta autorizada trae estado, tipo y número de comprobante,
// punto de venta, CAE, vencimiento, importes, QR fiscal y enlaces al PDF, pero no pudimos abrir el
// contrato OpenAPI para confirmar los nombres exactos de los campos. Así que buscamos por varios
// nombres plausibles, en la raíz y un nivel adentro.
//
// La regla que no se negocia: sin un CAE en la respuesta, el comprobante NO se marca como
// autorizado. Es preferible dejarlo pendiente y que alguien lo revise, a mostrar un CAE que no
// existe. Cuando tengamos el contrato, esto se reemplaza por una lectura directa.

type Diccionario = Record<string, unknown>

const CONTENEDORES = ['comprobante', 'data', 'resultado', 'respuesta']

function candidatos(respuesta: unknown): Diccionario[] {
  if (typeof respuesta !== 'object' || respuesta === null) return []
  const raiz = respuesta as Diccionario
  const anidados = CONTENEDORES.map((k) => raiz[k]).filter(
    (v): v is Diccionario => typeof v === 'object' && v !== null && !Array.isArray(v),
  )
  return [raiz, ...anidados]
}

function buscar(respuesta: unknown, claves: string[]): unknown {
  for (const nivel of candidatos(respuesta)) {
    for (const clave of claves) {
      const valor = nivel[clave]
      if (valor !== undefined && valor !== null && valor !== '') return valor
    }
  }
  return undefined
}

function texto(respuesta: unknown, claves: string[]): string | undefined {
  const valor = buscar(respuesta, claves)
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number') return String(valor)
  return undefined
}

function numero(respuesta: unknown, claves: string[]): number | undefined {
  const valor = buscar(respuesta, claves)
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && /^\d+$/.test(valor)) return Number(valor)
  return undefined
}

function mensajes(respuesta: unknown): string[] | undefined {
  const valor = buscar(respuesta, ['mensajes', 'observaciones', 'errores', 'messages'])
  if (typeof valor === 'string') return [valor]
  if (Array.isArray(valor)) {
    const textos = valor.map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
    return textos.length > 0 ? textos : undefined
  }
  return undefined
}

/**
 * Traduce lo que devolvió la API al `ResultadoEmision` que se guarda en la factura. `emitidoEl` se
 * pasa como argumento para que el resultado sea determinístico y testeable.
 */
export function interpretarRespuestaEmision(
  referenciaExterna: string,
  respuesta: unknown,
  emitidoEl: string,
): ResultadoEmision {
  const cae = texto(respuesta, ['cae', 'CAE', 'cae_numero', 'numero_cae'])

  return {
    comprobanteId: texto(respuesta, ['id', 'comprobante_id', 'comprobanteId']) ?? '',
    referenciaExterna,
    // Sin CAE no hay autorización, diga lo que diga el campo `estado`.
    estado: cae ? 'autorizado' : 'pendiente',
    cae,
    caeVencimiento: texto(respuesta, [
      'cae_vencimiento',
      'vencimiento_cae',
      'fecha_vencimiento_cae',
      'caeVencimiento',
    ]),
    puntoVenta: numero(respuesta, ['punto_venta', 'puntoVenta', 'pto_venta']),
    numeroComprobante: numero(respuesta, ['numero', 'numero_comprobante', 'comprobante_numero']),
    qr: texto(respuesta, ['qr', 'qr_url', 'codigo_qr', 'qr_fiscal']),
    pdfA4: texto(respuesta, ['pdf_a4', 'pdf', 'pdf_url', 'imprimir_a4']),
    pdfTicket: texto(respuesta, ['pdf_ticket', 'ticket', 'imprimir_ticket']),
    mensajes: mensajes(respuesta),
    emitidoEl,
  }
}

/**
 * Número oficial del comprobante, con el formato argentino `PPPP-NNNNNNNN`. Una vez que ARCA
 * autoriza, éste es el único número válido y pisa lo que el usuario hubiera escrito a mano.
 *
 * Devuelve `undefined` mientras no haya autorización, para no tocar el número de una factura que
 * todavía no se emitió o que quedó pendiente de revisión. El punto de venta suele venir en la
 * respuesta; si no viene, se usa el configurado, que es el mismo con el que se emitió.
 */
export function numeroComprobanteFormateado(
  emision: ResultadoEmision,
  puntoVentaConfigurado?: string,
): string | undefined {
  if (emision.estado !== 'autorizado') return undefined
  if (emision.numeroComprobante === undefined) return undefined

  const punto = emision.puntoVenta ?? Number(puntoVentaConfigurado)
  if (!Number.isFinite(punto) || punto === undefined) return undefined

  return `${String(punto).padStart(4, '0')}-${String(emision.numeroComprobante).padStart(8, '0')}`
}
