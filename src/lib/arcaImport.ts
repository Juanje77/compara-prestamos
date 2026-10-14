import { sumarDias, type TipoComprobante, type TipoFactura } from './cfo'

export interface FacturaImportadaArca {
  tipo: TipoFactura
  tipoComprobante: TipoComprobante
  contraparte: string
  monto: number
  fecha: string
  fechaEstimadaCobroPago: string
  numero?: string
  iva?: number
}

export interface ResultadoImportacionArca {
  facturas: FacturaImportadaArca[]
  omitidas: number
}

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function fechaArcaAISO(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  const texto = String(valor ?? '').trim()
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = new Date(texto)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

/** Clasifica el "Tipo" de comprobante de ARCA (ej: "1 - Factura A", "3 - Nota de Crédito A"). */
function tipoComprobanteDesde(tipoTexto: unknown): TipoComprobante | null {
  const t = normalizar(tipoTexto)
  if (t.includes('nota de credito')) return 'nota_credito'
  if (t.includes('nota de debito')) return 'nota_debito'
  if (t.includes('factura')) return 'factura'
  return null
}

/**
 * Lee el Excel de "Mis Comprobantes Emitidos/Recibidos" que se descarga desde ARCA (ex AFIP).
 * El archivo trae una fila de título ("Mis Comprobantes Emitidos - CUIT ...") antes de los
 * encabezados reales, de ahí se detecta si es un archivo de facturas emitidas o recibidas.
 * Se importan también las Notas de Crédito y Débito (con su propio signo se calcula la salud
 * financiera real) — solo se omiten comprobantes de un tipo no reconocido o con datos inválidos.
 */
export async function importarComprobantesArca(file: File, plazoDiasCobroPago = 30): Promise<ResultadoImportacionArca> {
  const { readSheet } = await import('read-excel-file/browser')
  const filas = await readSheet(file)

  const idxTitulo = filas.findIndex((f) => normalizar(f[0]).includes('mis comprobantes'))
  if (idxTitulo === -1) {
    throw new Error(
      'No se reconoce el archivo. Tiene que ser el Excel de "Mis Comprobantes Emitidos" o "Mis Comprobantes Recibidos" descargado desde ARCA.',
    )
  }
  const titulo = normalizar(filas[idxTitulo][0])
  const tipo: TipoFactura = titulo.includes('emitidos') ? 'emitida' : titulo.includes('recibidos') ? 'recibida' : (null as never)
  if (!tipo) {
    throw new Error('No se pudo determinar si el archivo es de comprobantes emitidos o recibidos.')
  }

  const idxHeader = filas.findIndex((f) => normalizar(f[0]) === 'fecha' && normalizar(f[1]) === 'tipo')
  if (idxHeader === -1) {
    throw new Error('No se encontró la fila de encabezados esperada ("Fecha", "Tipo", ...) en el archivo.')
  }

  const encabezados = filas[idxHeader].map(normalizar)
  const idxFecha = encabezados.indexOf('fecha')
  const idxTipoComprobante = encabezados.indexOf('tipo')
  const idxPtoVta = encabezados.indexOf('punto de venta')
  const idxNroDesde = encabezados.indexOf('numero desde')
  const idxDenominacion = encabezados.indexOf(tipo === 'recibida' ? 'denominacion emisor' : 'denominacion receptor')
  const idxMoneda = encabezados.indexOf('moneda')
  const idxTipoCambio = encabezados.indexOf('tipo cambio')
  const idxImpTotal = encabezados.indexOf('imp. total')
  // ARCA desglosa el IVA por alícuota (2,5%, 5%, 10,5%, 21%, 27%) en columnas separadas — la
  // columna con el total ya sumado se llama "Total IVA", no "IVA".
  const idxIva = encabezados.indexOf('total iva')

  if (idxDenominacion === -1 || idxImpTotal === -1) {
    throw new Error('El archivo no tiene las columnas esperadas de contraparte e importe total.')
  }

  const facturas: FacturaImportadaArca[] = []
  let omitidas = 0

  for (let i = idxHeader + 1; i < filas.length; i++) {
    const fila = filas[i]
    if (!fila || fila.every((c) => c === null || c === undefined)) continue

    const tipoComprobante = tipoComprobanteDesde(fila[idxTipoComprobante])
    const contraparte = String(fila[idxDenominacion] ?? '').trim()
    const impTotal = Number(fila[idxImpTotal])
    const fecha = fechaArcaAISO(fila[idxFecha])

    if (!tipoComprobante || !contraparte || !fecha || !impTotal || impTotal <= 0) {
      omitidas++
      continue
    }

    const moneda = String(fila[idxMoneda] ?? '$').trim()
    const tipoCambio = idxTipoCambio !== -1 ? Number(fila[idxTipoCambio]) || 1 : 1
    const monto = Math.abs(moneda === '$' ? impTotal : impTotal * tipoCambio)

    const ivaRaw = idxIva !== -1 ? Number(fila[idxIva]) : NaN
    const iva = !Number.isNaN(ivaRaw) ? Math.round(Math.abs(moneda === '$' ? ivaRaw : ivaRaw * tipoCambio)) : undefined

    const numero =
      idxPtoVta !== -1 && idxNroDesde !== -1
        ? `${String(fila[idxPtoVta]).padStart(4, '0')}-${String(fila[idxNroDesde]).padStart(8, '0')}`
        : undefined

    facturas.push({
      tipo,
      tipoComprobante,
      contraparte,
      monto: Math.round(monto),
      fecha,
      fechaEstimadaCobroPago: sumarDias(fecha, plazoDiasCobroPago),
      numero,
      iva,
    })
  }

  return { facturas, omitidas }
}

// --- Duplicados ---------------------------------------------------------------------------
//
// Importar dos veces el mismo archivo de ARCA es fácil de hacer y difícil de notar: no falla
// nada, simplemente queda todo al doble —la base de IVA, la de Ingresos Brutos, los ingresos del
// monotributo, el margen, el control del 80%— y el error aparece meses después, cuando ya se
// declaró. Por eso el importador compara contra lo que ya está cargado antes de agregar.

/**
 * La clave con la que dos comprobantes son "el mismo". El número (punto de venta y número) es lo
 * que los identifica de verdad, junto con el tipo y quién lo emitió.
 *
 * Se usa la contraparte y no el CUIT porque el Excel de ARCA trae la denominación, no el número:
 * si un proveedor aparece escrito distinto en dos archivos, ese duplicado se cuela. Es el límite
 * del dato que da ARCA, no una decisión.
 *
 * Sin número no hay clave confiable, así que ahí se cae a contraparte, fecha y monto: es más
 * flojo —dos compras iguales el mismo día al mismo proveedor se verían como una— pero deja pasar
 * menos duplicados que no comparar nada.
 */
export function claveComprobante(f: {
  tipo: TipoFactura
  tipoComprobante: TipoComprobante
  contraparte: string
  numero?: string
  fecha: string
  monto: number
}): string {
  const quien = f.contraparte.trim().toLowerCase()
  if (f.numero) return `${f.tipo}|${f.tipoComprobante}|${quien}|${f.numero}`
  return `${f.tipo}|${f.tipoComprobante}|${quien}|${f.fecha}|${Math.round(f.monto)}`
}

export interface ResultadoDeduplicado<T> {
  /** Los que hay que agregar: no estaban antes, y sin repetidos dentro del propio archivo. */
  nuevos: T[]
  /** Cuántos se saltearon por estar ya cargados o venir repetidos en el mismo archivo. */
  duplicados: number
}

/**
 * Saca de `importadas` lo que ya está en `existentes`, y también lo que viene repetido dentro del
 * propio archivo — un Excel puede traer la misma fila dos veces, y agregar las dos sería el mismo
 * problema que estamos evitando.
 */
export function quitarDuplicados<
  T extends { tipo: TipoFactura; tipoComprobante: TipoComprobante; contraparte: string; numero?: string; fecha: string; monto: number },
>(importadas: T[], existentes: Parameters<typeof claveComprobante>[0][]): ResultadoDeduplicado<T> {
  const vistas = new Set(existentes.map(claveComprobante))
  const nuevos: T[] = []
  let duplicados = 0

  for (const f of importadas) {
    const clave = claveComprobante(f)
    if (vistas.has(clave)) {
      duplicados++
      continue
    }
    vistas.add(clave)
    nuevos.push(f)
  }

  return { nuevos, duplicados }
}
