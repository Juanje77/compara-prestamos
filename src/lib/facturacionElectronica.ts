// Mapeo de una factura de FinCorp al comprobante que espera la API de facturación electrónica.
//
// Este módulo NO habla con la API: sólo arma y valida el cuerpo del pedido. La llamada la hace el
// backend, porque el token de emisión es una credencial que no puede vivir en el navegador (lo
// dice la propia documentación del proveedor). Acá queda todo lo que se puede construir, probar y
// versionar sin red, que es también lo que después consume ese backend.
//
// Todo lo de acá está verificado contra el contrato OpenAPI 3.0.3 de la API, que vive en
// `api/openapi-sistemas360.json`. Cuando algo cambie del lado del proveedor, se actualiza ese
// archivo primero y después este módulo: el diff del contrato dice exactamente qué tocar.

import type {
  CondicionEmisor,
  CondicionIvaReceptorId,
  DatosReceptor,
  DocumentoTipo,
  Factura,
  ResultadoEmision,
} from './cfo'
import { esCuitValido, limpiarCuit } from './cuit'

/** Letra del comprobante. La define la condición de IVA del emisor cruzada con la del receptor. */
export type LetraComprobante = 'a' | 'b' | 'c'

export type { CondicionEmisor }

export type ConceptoComprobante = 'productos' | 'servicios' | 'productos_y_servicios'

export type TipoImpuestoItem = 'gravado' | 'exento' | 'no_gravado'

/** Alícuotas de IVA vigentes en ARCA. */
export const ALICUOTAS_IVA = [0, 2.5, 5, 10.5, 21, 27] as const

export interface ItemComprobante {
  descripcion: string
  cantidad: number
  /** Precio unitario NETO, sin IVA — 10.000 con IVA 21 da un total de 12.100. */
  precio_unitario: number
  /** Obligatorio en A y B; el contrato dice que NO se envía en clase C. */
  tipo_impuesto?: TipoImpuestoItem
  /** Alícuota en porcentaje, no el importe. Tampoco se envía en clase C. */
  iva?: number
}

export interface PayloadComprobante {
  tipo_comprobante: string
  concepto: ConceptoComprobante
  fecha: string
  referencia_externa: string
  punto_venta?: number
  /** Sólo en notas: el id que la API le dio al comprobante que la nota corrige. */
  comprobante_asociado_id?: number
  /** Alternativa al anterior: la referencia externa con la que se emitió el original. */
  referencia_externa_asociada?: string
  cliente: {
    documento_tipo: DocumentoTipo
    /** null cuando el tipo es `consumidor_final`. */
    documento_numero: string | null
    razon_social: string
    condicion_iva_receptor_id: CondicionIvaReceptorId
  }
  items: ItemComprobante[]
  total: number
  moneda: 'PES'
}

export interface OpcionesEmision {
  condicionEmisor: CondicionEmisor
  /** Punto de venta con el que se emite. Si se omite, la API usa el configurado en el emisor. */
  puntoVenta?: number
  /** Para poder validar la fecha contra la ventana que admite ARCA. Inyectable para los tests. */
  hoy?: Date
  concepto?: ConceptoComprobante
  /** Fuerza la letra en vez de derivarla del receptor. */
  letra?: LetraComprobante
  /** Para una nota de crédito o débito: la factura que corrige. */
  original?: Factura
  /** El resto de los comprobantes, para calcular cuánto queda del original sin acreditar. */
  facturas?: Factura[]
}

/** Condiciones de IVA del receptor que reciben comprobante clase A, según el contrato: responsable
 * inscripto (1), monotributo (6), monotributista social (13) y trabajador independiente promovido
 * (16). Todos ellos exigen CUIT. El resto recibe clase B. */
const CONDICIONES_FACTURA_A: CondicionIvaReceptorId[] = [1, 6, 13, 16]

/** Días de tolerancia de la fecha del comprobante, por concepto. */
const DIAS_TOLERANCIA: Record<ConceptoComprobante, number> = {
  productos: 5,
  servicios: 10,
  productos_y_servicios: 10,
}

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
    case 'consumidor_final':
      // No lleva número: es la forma de emitir sin identificar al receptor.
      return true
    case 'cdi':
    case 'pasaporte':
    case 'documento_extranjero':
      return receptor.documentoNumero.trim().length > 0
  }
}

function diasDeDiferencia(fechaISO: string, hoy: Date): number {
  const fecha = new Date(`${fechaISO}T00:00:00`)
  const referencia = new Date(`${hoy.toISOString().slice(0, 10)}T00:00:00`)
  return Math.round((referencia.getTime() - fecha.getTime()) / 86400000)
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
    problemas.push(...validarNota(f, opciones.original, opciones.facturas ?? []))
    if (opciones.original && !referenciaApiDe(opciones.original)) {
      problemas.push(
        'El comprobante original no se emitió desde el sistema, así que la API no lo conoce y no se le puede asociar una nota. La nota queda registrada acá, pero hay que emitirla por Comprobantes en Línea.',
      )
    }
  }

  if (!(f.monto > 0)) {
    problemas.push('El monto tiene que ser mayor a cero.')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) {
    problemas.push('La fecha del comprobante no es válida.')
  } else {
    // ARCA sólo autoriza dentro de una ventana alrededor de hoy: 5 días para productos, 10 para
    // servicios. Una factura vieja cargada en el sistema ya no se puede emitir con su fecha.
    const tolerancia = DIAS_TOLERANCIA[opciones.concepto ?? 'productos']
    const dias = diasDeDiferencia(f.fecha, opciones.hoy ?? new Date())
    if (Math.abs(dias) > tolerancia) {
      problemas.push(
        `ARCA sólo autoriza comprobantes con fecha dentro de los ${tolerancia} días. Éste tiene ${Math.abs(dias)} días de diferencia.`,
      )
    }
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

  // En una factura C el precio es el final y el contrato prohíbe mandar tipo_impuesto e iva. En A
  // y B el precio unitario va neto y el total con IVA.
  const esC = letra === 'c'
  const alicuota = esC ? 0 : (alicuotaIvaDeFactura(f) ?? 0)
  const neto = esC ? f.monto : f.monto - (f.iva ?? 0)

  const item: ItemComprobante = {
    descripcion: descripcionItem(f),
    cantidad: 1,
    precio_unitario: redondear(neto),
    ...(esC ? {} : { tipo_impuesto: alicuota > 0 ? ('gravado' as const) : ('exento' as const), iva: alicuota }),
  }

  // Una nota viaja con la referencia al comprobante que corrige.
  const asociado =
    f.tipoComprobante !== 'factura' && opciones.original ? referenciaApiDe(opciones.original) : null

  return {
    tipo_comprobante: `${f.tipoComprobante}_${letra}`,
    concepto: opciones.concepto ?? 'productos',
    fecha: f.fecha,
    referencia_externa: referenciaExternaDeFactura(f),
    ...(opciones.puntoVenta ? { punto_venta: opciones.puntoVenta } : {}),
    ...(asociado ?? {}),
    cliente: {
      documento_tipo: receptor.documentoTipo,
      documento_numero:
        receptor.documentoTipo === 'consumidor_final' ? null : limpiarCuit(receptor.documentoNumero),
      razon_social: receptor.razonSocial.trim(),
      condicion_iva_receptor_id: receptor.condicionIvaReceptorId,
    },
    items: [item],
    total: redondear(f.monto),
    moneda: 'PES',
  }
}

// --- Lectura de la respuesta -----------------------------------------------------------------
//
// El contrato define la respuesta como `{ ok, mensaje, mensaje_api, error_type, data }`, donde
// `data` es un ReceiptDetail. Leemos de ahí, con una salvedad que no se negocia: **sin un CAE en la
// respuesta el comprobante no se marca como autorizado**, diga lo que diga `data.estado`. Mostrar
// un CAE que no existe es peor que pedir que alguien revise.
//
// `pendiente_confirmacion` merece su propio estado: ARCA no contestó a tiempo y puede haber
// autorizado igual. Se resuelve consultando con /reintentar, nunca emitiendo de nuevo.

type Diccionario = Record<string, unknown>

const CONTENEDORES = ['data', 'comprobante']

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
  const valor = buscar(respuesta, ['mensajes_arca'])
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
  const cae = texto(respuesta, ['cae'])
  const estadoApi = texto(respuesta, ['estado'])
  const qr = buscar(respuesta, ['qr'])

  return {
    comprobanteId: texto(respuesta, ['id']) ?? '',
    referenciaExterna,
    estado: cae ? 'autorizado' : estadoApi === 'pendiente_confirmacion' ? 'pendiente_confirmacion' : 'pendiente',
    cae,
    caeVencimiento: texto(respuesta, ['cae_vencimiento']),
    puntoVenta: numero(respuesta, ['punto_venta']),
    numeroComprobante: numero(respuesta, ['numero_comprobante']),
    // El contrato define el QR como un objeto `{ url }`.
    qr: typeof qr === 'object' && qr !== null ? texto(qr, ['url']) : texto(respuesta, ['qr']),
    pdfA4: texto(respuesta, ['imprimir_a4_url']),
    pdfTicket: texto(respuesta, ['imprimir_ticket_url']),
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

// --- Notas de crédito y débito ----------------------------------------------------------------
//
// ARCA exige que una nota diga a qué comprobante se aplica. El contrato lo resuelve más simple de
// lo que se podía suponer: no hay que armar la referencia fiscal (tipo, punto de venta, número),
// alcanza con decirle a la API cuál de SUS comprobantes es el original, por su `id` o por la
// `referencia_externa` con la que se emitió.
//
// La consecuencia práctica importa: sólo se le puede emitir una nota a un comprobante que también
// se haya emitido desde acá. Una factura vieja cargada a mano no existe para la API, por más que
// tenga su número de ARCA anotado.

export interface ReferenciaApi {
  comprobante_asociado_id?: number
  referencia_externa_asociada?: string
}

/**
 * Cómo referenciar el comprobante original ante la API. Prefiere el id propio de la API; si no lo
 * hay, usa la referencia externa con la que se emitió. Devuelve `null` cuando el original no pasó
 * por la API, que es cuando la nota no se puede emitir desde el sistema.
 */
export function referenciaApiDe(original: Factura): ReferenciaApi | null {
  const emision = original.emision
  if (!emision) return null

  const id = Number(emision.comprobanteId)
  if (Number.isInteger(id) && id > 0) return { comprobante_asociado_id: id }

  if (emision.referenciaExterna) return { referencia_externa_asociada: emision.referenciaExterna }

  return null
}

/** Punto de venta y número de un comprobante ya emitido, venga de una emisión nuestra o del
 * número cargado a mano con el formato `PPPP-NNNNNNNN`. */
export function identificarComprobante(f: Factura): { puntoVenta: number; numero: number } | null {
  const emision = f.emision
  if (emision?.estado === 'autorizado' && emision.puntoVenta !== undefined && emision.numeroComprobante !== undefined) {
    return { puntoVenta: emision.puntoVenta, numero: emision.numeroComprobante }
  }

  const partes = /^(\d{1,5})-(\d{1,8})$/.exec(f.numero?.trim() ?? '')
  if (!partes) return null
  return { puntoVenta: Number(partes[1]), numero: Number(partes[2]) }
}

/**
 * Cuánto queda del original para acreditar: su monto menos las notas de crédito que ya se le
 * aplicaron. Una nota de crédito no puede devolver más de lo que se facturó.
 */
export function montoDisponibleParaNota(original: Factura, facturas: Factura[]): number {
  const acreditado = facturas
    .filter((f) => f.comprobanteAsociadoId === original.id && f.tipoComprobante === 'nota_credito')
    .reduce((suma, f) => suma + f.monto, 0)

  return redondear(Math.max(0, original.monto - acreditado))
}

/** Problemas propios de una nota, además de los que ya mira `validarFacturaParaEmision`. */
export function validarNota(nota: Factura, original: Factura | undefined, facturas: Factura[]): string[] {
  const problemas: string[] = []

  if (!nota.comprobanteAsociadoId) {
    problemas.push('La nota tiene que indicar qué comprobante corrige.')
    return problemas
  }

  if (!original) {
    problemas.push('No se encuentra el comprobante que esta nota corrige.')
    return problemas
  }

  if (original.tipoComprobante !== 'factura') {
    problemas.push('Una nota corrige una factura, no otra nota.')
  }

  if (original.tipo !== nota.tipo) {
    problemas.push('La nota y el comprobante que corrige tienen que ser los dos emitidos o los dos recibidos.')
  }

  if (!identificarComprobante(original)) {
    problemas.push(
      'El comprobante original no tiene número de ARCA. Cargale el número con el formato 0003-00000145 o emitilo primero.',
    )
  }

  if (nota.tipoComprobante === 'nota_credito') {
    // Se compara contra el disponible sin contar a esta misma nota, para poder editarla.
    const otras = facturas.filter((f) => f.id !== nota.id)
    const disponible = montoDisponibleParaNota(original, otras)
    if (nota.monto > disponible + 0.01) {
      problemas.push(
        `La nota de crédito no puede superar lo que queda del original: ${disponible.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}.`,
      )
    }
  }

  return problemas
}
