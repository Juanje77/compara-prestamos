// Lectura de una factura de compra a partir de una foto o un PDF.
//
// El modelo de IA extrae los campos, pero acá no se le cree: lo que decide si un comprobante se
// carga solo o va a revisión es esta lógica, que es determinística y se puede testear. La IA
// propone, las cuentas y ARCA disponen.
//
// El criterio es deliberadamente conservador. Una factura de compra mal cargada ensucia la
// Posición de IVA, el margen y el control del 80% del monotributo, y el cliente se entera tres
// meses después. Ante la duda, a revisar.

import type { TipoComprobante } from './cfo'

/** Lo que el modelo devuelve por cada factura leída. Todo opcional: una foto mala puede no dejar
 * leer la mitad, y eso es un resultado válido que termina en revisión, no un error. */
export interface FacturaLeida {
  cuitEmisor?: string
  razonSocialEmisor?: string
  tipoComprobante?: TipoComprobante
  /** Letra del comprobante: A, B, C, M. */
  letra?: string
  puntoVenta?: number
  numero?: number
  fecha?: string
  neto?: number
  iva?: number
  total?: number
  cae?: string
}

export type MotivoRevision =
  | 'falta-total'
  | 'falta-fecha'
  | 'falta-cuit'
  | 'cuit-invalido'
  | 'totales-no-cierran'
  | 'fecha-futura'
  | 'fecha-muy-vieja'
  | 'cuit-no-verificado'
  | 'duplicada'

export const MOTIVO_REVISION_LABEL: Record<MotivoRevision, string> = {
  'falta-total': 'No se pudo leer el importe total.',
  'falta-fecha': 'No se pudo leer la fecha.',
  'falta-cuit': 'No se pudo leer el CUIT del proveedor.',
  'cuit-invalido': 'El CUIT leído no es válido.',
  'totales-no-cierran': 'El neto más el IVA no da el total.',
  'fecha-futura': 'La fecha es posterior a hoy.',
  'fecha-muy-vieja': 'La fecha tiene más de un año.',
  'cuit-no-verificado': 'No se pudo confirmar el CUIT contra el padrón de ARCA.',
  duplicada: 'Ya hay un comprobante cargado con ese proveedor, número y fecha.',
}

export interface RevisionFactura {
  /** true solo si no quedó ningún motivo de revisión: ahí se puede cargar sin intervención. */
  confiable: boolean
  motivos: MotivoRevision[]
}

/** Tolerancia al comparar neto + IVA contra el total. Un peso alcanza para absorber el redondeo
 * de cada alícuota sin dejar pasar un error de lectura de verdad. */
export const TOLERANCIA_TOTALES = 1

/**
 * Valida el CUIT con su dígito verificador (módulo 11), el mismo cálculo que usa ARCA. Atrapa un
 * dígito mal leído, que es el error más común al sacarle una foto a una factura arrugada.
 */
export function cuitValido(cuit: string | undefined): boolean {
  const limpio = String(cuit ?? '').replace(/\D/g, '')
  if (limpio.length !== 11) return false
  // Un CUIT con todos los dígitos iguales pasa el módulo 11 pero no existe.
  if (/^(\d)\1{10}$/.test(limpio)) return false

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(limpio[i]), 0)
  const resto = suma % 11
  const verificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto
  return verificador === Number(limpio[10])
}

/** Formatea un CUIT leído como 30-12345678-9. Devuelve el original si no tiene 11 dígitos. */
export function formatearCuit(cuit: string): string {
  const limpio = cuit.replace(/\D/g, '')
  if (limpio.length !== 11) return cuit
  return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}`
}

export interface ContextoRevision {
  /** Hoy, para medir si la fecha leída tiene sentido. */
  hoy?: Date
  /** true si el CUIT se pudo confirmar contra el padrón de ARCA. Sin confirmar, va a revisión:
   * es justamente la verificación que convierte "la IA cree" en "ARCA confirma". */
  cuitVerificado?: boolean
  /** true si ya hay un comprobante igual cargado — ver pareceDuplicada. */
  duplicada?: boolean
}

/**
 * Qué hay que revisar a mano antes de dar por buena esta lectura. Sin motivos, se puede cargar
 * sola; con uno solo, va a la bandeja de pendientes con el motivo a la vista.
 */
export function revisarFacturaLeida(f: FacturaLeida, ctx: ContextoRevision = {}): RevisionFactura {
  const motivos: MotivoRevision[] = []
  const hoy = ctx.hoy ?? new Date()

  if (f.total === undefined || f.total <= 0) motivos.push('falta-total')
  if (!f.fecha) motivos.push('falta-fecha')
  if (!f.cuitEmisor) motivos.push('falta-cuit')
  else if (!cuitValido(f.cuitEmisor)) motivos.push('cuit-invalido')
  else if (ctx.cuitVerificado !== true) motivos.push('cuit-no-verificado')

  // El neto y el IVA solo se cruzan si se leyeron los dos: una factura C no discrimina IVA, y ahí
  // exigir que la suma cierre mandaría a revisión todas las compras a monotributistas.
  if (f.total !== undefined && f.neto !== undefined && f.iva !== undefined) {
    if (Math.abs(f.neto + f.iva - f.total) > TOLERANCIA_TOTALES) motivos.push('totales-no-cierran')
  }

  if (f.fecha) {
    const fecha = new Date(`${f.fecha}T00:00:00`)
    const hoyISO = hoy.toISOString().slice(0, 10)
    const haceUnAnio = new Date(hoy)
    haceUnAnio.setFullYear(haceUnAnio.getFullYear() - 1)
    if (f.fecha > hoyISO) motivos.push('fecha-futura')
    else if (fecha < haceUnAnio) motivos.push('fecha-muy-vieja')
  }

  if (ctx.duplicada) motivos.push('duplicada')

  return { confiable: motivos.length === 0, motivos }
}

/** El número completo del comprobante, como se escribe: 0003-00001234. */
export function numeroComprobante(puntoVenta?: number, numero?: number): string | undefined {
  if (puntoVenta === undefined || numero === undefined) return undefined
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`
}

// --- Normalización de lo que devuelve el modelo ---------------------------------------------
//
// El modelo devuelve JSON, pero copia los valores como están impresos en la factura: importes con
// símbolo y separadores de miles argentinos, fechas en dd/mm/aaaa, CUIT con guiones. Convertirlo
// es determinístico, así que se hace acá y se testea, en vez de pedirle al modelo que además
// formatee —cuanto menos tenga que interpretar, menos se equivoca—.

/** Un importe escrito a la argentina ("$ 1.234.567,89") a número. undefined si no se entiende. */
export function aNumero(valor: unknown): number | undefined {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined
  if (typeof valor !== 'string') return undefined
  const limpio = valor.replace(/[^\d,.-]/g, '')
  if (!limpio) return undefined
  // El último separador es el decimal: cuál es depende de cómo esté escrito el número.
  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')
  let normalizado: string
  if (ultimaComa > ultimoPunto) normalizado = limpio.replace(/\./g, '').replace(',', '.')
  else if (ultimoPunto > ultimaComa) normalizado = limpio.replace(/,/g, '')
  else normalizado = limpio
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : undefined
}

/** Una fecha impresa en la factura a ISO. Acepta dd/mm/aaaa, dd-mm-aaaa y aaaa-mm-dd. */
export function aFechaISO(valor: unknown): string | undefined {
  if (typeof valor !== 'string' || !valor.trim()) return undefined
  const texto = valor.trim()
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return texto
  const dmy = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (!dmy) return undefined
  const [, d, m, y] = dmy
  const anio = y.length === 2 ? `20${y}` : y
  const dia = Number(d)
  const mes = Number(m)
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return undefined
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

const TIPOS_POR_TEXTO: [RegExp, TipoComprobante][] = [
  [/nota\s*de\s*cr[eé]dito|^nc$/i, 'nota_credito'],
  [/nota\s*de\s*d[eé]bito|^nd$/i, 'nota_debito'],
  [/factura|^fc?$/i, 'factura'],
]

function aTipoComprobante(valor: unknown): TipoComprobante | undefined {
  const texto = String(valor ?? '')
  return TIPOS_POR_TEXTO.find(([re]) => re.test(texto))?.[1]
}

/**
 * Convierte la respuesta del modelo en una FacturaLeida, campo por campo. Lo que no se entiende
 * queda sin cargar en vez de romper: un campo vacío manda la factura a revisión, que es el
 * resultado correcto, mientras que una excepción dejaría al usuario sin nada.
 */
export function normalizarLecturaDelModelo(crudo: unknown): FacturaLeida {
  if (typeof crudo !== 'object' || crudo === null) return {}
  const c = crudo as Record<string, unknown>
  const cuit = String(c.cuitEmisor ?? '').replace(/\D/g, '')
  const letra = String(c.letra ?? '').trim().toUpperCase()
  const puntoVenta = aNumero(c.puntoVenta)
  const numero = aNumero(c.numero)

  return {
    cuitEmisor: cuit.length === 11 ? cuit : undefined,
    razonSocialEmisor: typeof c.razonSocialEmisor === 'string' ? c.razonSocialEmisor.trim() || undefined : undefined,
    tipoComprobante: aTipoComprobante(c.tipoComprobante),
    letra: /^[ABCEM]$/.test(letra) ? letra : undefined,
    puntoVenta: puntoVenta !== undefined ? Math.trunc(puntoVenta) : undefined,
    numero: numero !== undefined ? Math.trunc(numero) : undefined,
    fecha: aFechaISO(c.fecha),
    neto: aNumero(c.neto),
    iva: aNumero(c.iva),
    total: aNumero(c.total),
    cae: typeof c.cae === 'string' ? c.cae.replace(/\D/g, '') || undefined : undefined,
  }
}
