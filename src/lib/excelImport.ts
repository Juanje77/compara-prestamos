export interface FilaImportada {
  concepto: string
  monto: number
  fecha: string
}

const ALIAS_CONCEPTO = ['cliente', 'concepto', 'razon social', 'nombre', 'proveedor', 'cuenta']
const ALIAS_MONTO = ['monto', 'importe', 'total', 'valor', 'saldo']
const ALIAS_FECHA = ['fecha', 'vencimiento', 'fecha de cobro', 'fecha cobro', 'fecha de pago', 'fecha de vencimiento']

function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function aFechaISO(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'string' && valor.trim()) {
    const parsed = new Date(valor)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Lee un Excel de cuentas a cobrar o gastos a pagar. Busca columnas por nombre (tolerando
 * variantes en español y mayúsculas/acentos) en vez de exigir un formato exacto de planilla.
 */
export async function importarMovimientosDesdeExcel(file: File): Promise<FilaImportada[]> {
  const { readSheet } = await import('read-excel-file/browser')
  const filas = await readSheet(file)
  if (filas.length < 2) return []

  const encabezados = filas[0].map(normalizar)
  const idxConcepto = encabezados.findIndex((h) => ALIAS_CONCEPTO.includes(h))
  const idxMonto = encabezados.findIndex((h) => ALIAS_MONTO.includes(h))
  const idxFecha = encabezados.findIndex((h) => ALIAS_FECHA.includes(h))

  if (idxConcepto === -1 || idxMonto === -1) {
    throw new Error(
      'No se encontraron columnas de "Cliente/Proveedor" y "Monto" en el archivo. Verificá que la primera fila tenga esos encabezados.',
    )
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const resultado: FilaImportada[] = []

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i]
    const concepto = fila[idxConcepto]
    const monto = fila[idxMonto]
    if (!concepto || typeof monto !== 'number' || monto <= 0) continue

    const fecha = idxFecha !== -1 ? (aFechaISO(fila[idxFecha]) ?? hoy) : hoy
    resultado.push({ concepto: String(concepto).trim(), monto, fecha })
  }

  return resultado
}

export interface FilaProductoImportada {
  codigo?: string
  nombre: string
  costoUnitario: number
  precioVenta?: number
  stockActual: number
  stockMinimo?: number
  esServicio?: boolean
}

const ALIAS_CODIGO = ['codigo', 'sku', 'cod']
const ALIAS_NOMBRE = ['producto', 'nombre', 'descripcion', 'articulo', 'artículo']
const ALIAS_COSTO = ['costo', 'costo unitario', 'precio de costo', 'precio costo']
const ALIAS_PRECIO = ['precio', 'precio de venta', 'precio venta']
const ALIAS_STOCK = ['stock', 'cantidad', 'existencia', 'existencias', 'stock actual']
const ALIAS_STOCK_MINIMO = ['stock minimo', 'minimo', 'stock de seguridad']
const ALIAS_SERVICIO = ['servicio', 'es servicio', 'tipo']
const VALORES_SERVICIO = ['si', 'sí', 'x', 'servicio', 'service', 'true']

/**
 * Lee un Excel de catálogo de productos para el alta masiva en Stock. Solo exige una columna de
 * "Producto"/"Nombre" — el resto (código, costo, precio, stock, stock mínimo) es opcional.
 */
export async function importarProductosDesdeExcel(file: File): Promise<FilaProductoImportada[]> {
  const { readSheet } = await import('read-excel-file/browser')
  const filas = await readSheet(file)
  if (filas.length < 2) return []

  const encabezados = filas[0].map(normalizar)
  const idxCodigo = encabezados.findIndex((h) => ALIAS_CODIGO.includes(h))
  const idxNombre = encabezados.findIndex((h) => ALIAS_NOMBRE.includes(h))
  const idxCosto = encabezados.findIndex((h) => ALIAS_COSTO.includes(h))
  const idxPrecio = encabezados.findIndex((h) => ALIAS_PRECIO.includes(h))
  const idxStock = encabezados.findIndex((h) => ALIAS_STOCK.includes(h))
  const idxStockMinimo = encabezados.findIndex((h) => ALIAS_STOCK_MINIMO.includes(h))
  const idxServicio = encabezados.findIndex((h) => ALIAS_SERVICIO.includes(h))

  if (idxNombre === -1) {
    throw new Error(
      'No se encontró una columna de "Producto" o "Nombre" en el archivo. Verificá que la primera fila tenga ese encabezado.',
    )
  }

  const resultado: FilaProductoImportada[] = []

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i]
    const nombre = fila[idxNombre]
    if (!nombre) continue

    const costoRaw = idxCosto !== -1 ? fila[idxCosto] : undefined
    const precioRaw = idxPrecio !== -1 ? fila[idxPrecio] : undefined
    const stockRaw = idxStock !== -1 ? fila[idxStock] : undefined
    const stockMinRaw = idxStockMinimo !== -1 ? fila[idxStockMinimo] : undefined
    const esServicio = idxServicio !== -1 && VALORES_SERVICIO.includes(normalizar(fila[idxServicio]))

    resultado.push({
      codigo: idxCodigo !== -1 && fila[idxCodigo] ? String(fila[idxCodigo]).trim() : undefined,
      nombre: String(nombre).trim(),
      costoUnitario: typeof costoRaw === 'number' ? costoRaw : 0,
      precioVenta: typeof precioRaw === 'number' ? precioRaw : undefined,
      // Un servicio no tiene stock, sin importar lo que diga la columna de stock del archivo.
      stockActual: esServicio ? 0 : typeof stockRaw === 'number' ? stockRaw : 0,
      stockMinimo: esServicio ? undefined : typeof stockMinRaw === 'number' ? stockMinRaw : undefined,
      esServicio: esServicio || undefined,
    })
  }

  return resultado
}

export interface FilaExtractoBancario {
  fecha: string
  descripcion?: string
  monto: number
  saldoDeclarado?: number
}

const ALIAS_FECHA_EXTRACTO = ['fecha', 'fecha de la operacion', 'fecha operacion', 'fecha operación']
const ALIAS_DESCRIPCION = ['descripcion', 'descripción', 'concepto', 'detalle', 'movimiento', 'leyenda']
const ALIAS_MONTO_EXTRACTO = ['monto', 'importe']
const ALIAS_DEBITO = ['debito', 'débito', 'egreso', 'salida']
const ALIAS_CREDITO = ['credito', 'crédito', 'ingreso', 'entrada']
const ALIAS_SALDO_EXTRACTO = ['saldo', 'saldo acumulado', 'saldo posterior', 'saldo parcial']

/**
 * Lee el extracto/movimientos de una cuenta bancaria para conciliar contra Tesorería. Acepta una
 * columna "Monto" con signo, o "Débito"/"Crédito" por separado (como exportan la mayoría de los
 * homebankings) — y una columna de "Saldo" opcional para poder comparar el saldo final.
 */
export async function importarExtractoBancario(file: File): Promise<FilaExtractoBancario[]> {
  const { readSheet } = await import('read-excel-file/browser')
  const filas = await readSheet(file)
  if (filas.length < 2) return []

  const encabezados = filas[0].map(normalizar)
  const idxFecha = encabezados.findIndex((h) => ALIAS_FECHA_EXTRACTO.includes(h))
  const idxDescripcion = encabezados.findIndex((h) => ALIAS_DESCRIPCION.includes(h))
  const idxMonto = encabezados.findIndex((h) => ALIAS_MONTO_EXTRACTO.includes(h))
  const idxDebito = encabezados.findIndex((h) => ALIAS_DEBITO.includes(h))
  const idxCredito = encabezados.findIndex((h) => ALIAS_CREDITO.includes(h))
  const idxSaldo = encabezados.findIndex((h) => ALIAS_SALDO_EXTRACTO.includes(h))

  if (idxFecha === -1 || (idxMonto === -1 && idxDebito === -1 && idxCredito === -1)) {
    throw new Error(
      'No se encontró una columna de "Fecha" y una de "Monto" (o "Débito"/"Crédito") en el archivo. Verificá los encabezados de la primera fila.',
    )
  }

  const resultado: FilaExtractoBancario[] = []

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i]
    const fecha = aFechaISO(fila[idxFecha])
    if (!fecha) continue

    let monto: number | null = null
    if (idxMonto !== -1 && typeof fila[idxMonto] === 'number') {
      monto = fila[idxMonto] as number
    } else {
      const debito = idxDebito !== -1 && typeof fila[idxDebito] === 'number' ? (fila[idxDebito] as number) : 0
      const credito = idxCredito !== -1 && typeof fila[idxCredito] === 'number' ? (fila[idxCredito] as number) : 0
      if (debito !== 0 || credito !== 0) monto = credito - Math.abs(debito)
    }
    if (monto === null || monto === 0) continue

    const saldoRaw = idxSaldo !== -1 ? fila[idxSaldo] : undefined

    resultado.push({
      fecha,
      descripcion: idxDescripcion !== -1 && fila[idxDescripcion] ? String(fila[idxDescripcion]).trim() : undefined,
      monto,
      saldoDeclarado: typeof saldoRaw === 'number' ? saldoRaw : undefined,
    })
  }

  return resultado
}

export interface FilaChequeImportada {
  numero?: string
  banco: string
  contraparte: string
  monto: number
  fechaEmision: string
  fechaCobro: string
}

const ALIAS_NUMERO = ['numero', 'nro', 'n', 'numero de cheque', 'nro cheque', 'cheque']
const ALIAS_BANCO = ['banco', 'entidad', 'banco emisor']
const ALIAS_CONTRAPARTE_CHEQUE = ['proveedor', 'beneficiario', 'cliente', 'a la orden de', 'contraparte', 'razon social', 'nombre']
const ALIAS_FECHA_EMISION = ['fecha de emision', 'fecha emision', 'emision', 'fecha libramiento', 'libramiento']
const ALIAS_FECHA_COBRO = ['fecha de pago', 'fecha pago', 'fecha de cobro', 'fecha cobro', 'vencimiento', 'fecha de vencimiento', 'pago diferido', 'fecha']

/**
 * Lee un Excel de chequera para dar de alta varios cheques de una.
 *
 * Lo único que se exige es el importe y a nombre de quién va: sin eso no hay cheque. Banco y
 * número se completan después a mano si faltan — es lo que pasa cuando alguien lleva la chequera
 * en una planilla propia, que casi nunca tiene todas las columnas.
 *
 * Las dos fechas se tratan distinto a propósito. La de pago es la que importa, porque es la que
 * ubica el cheque en la proyección de caja: si falta, el cheque no sirve para proyectar y la fila
 * se saltea. La de emisión, si falta, se toma igual a la de pago: suponer que se emitió el mismo
 * día que se paga es conservador y no cambia ningún número.
 */
export async function importarChequesDesdeExcel(file: File): Promise<FilaChequeImportada[]> {
  const { readSheet } = await import('read-excel-file/browser')
  const filas = await readSheet(file)
  if (filas.length < 2) return []

  const encabezados = filas[0].map(normalizar)
  const buscar = (alias: string[]) => encabezados.findIndex((h) => alias.includes(h))
  const idxNumero = buscar(ALIAS_NUMERO)
  const idxBanco = buscar(ALIAS_BANCO)
  const idxContraparte = buscar(ALIAS_CONTRAPARTE_CHEQUE)
  const idxMonto = buscar(ALIAS_MONTO)
  const idxEmision = buscar(ALIAS_FECHA_EMISION)
  const idxCobro = buscar(ALIAS_FECHA_COBRO)

  if (idxContraparte === -1 || idxMonto === -1) {
    throw new Error(
      'No se encontraron columnas de "Proveedor/Beneficiario" y "Monto" en el archivo. Verificá que la primera fila tenga esos encabezados.',
    )
  }
  if (idxCobro === -1) {
    throw new Error(
      'Falta la columna de "Fecha de pago" (o "Vencimiento"). Sin esa fecha el cheque no se puede ubicar en la proyección de caja.',
    )
  }

  const resultado: FilaChequeImportada[] = []

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i]
    const contraparte = fila[idxContraparte]
    const monto = fila[idxMonto]
    if (!contraparte || typeof monto !== 'number' || monto <= 0) continue

    const fechaCobro = aFechaISO(fila[idxCobro])
    if (!fechaCobro) continue

    const fechaEmision = idxEmision !== -1 ? aFechaISO(fila[idxEmision]) : null
    const numero = idxNumero !== -1 && fila[idxNumero] ? String(fila[idxNumero]).trim() : undefined

    resultado.push({
      numero,
      banco: idxBanco !== -1 && fila[idxBanco] ? String(fila[idxBanco]).trim() : '',
      contraparte: String(contraparte).trim(),
      monto,
      fechaEmision: fechaEmision ?? fechaCobro,
      fechaCobro,
    })
  }

  return resultado
}
