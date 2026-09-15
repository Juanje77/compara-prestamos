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
}

const ALIAS_CODIGO = ['codigo', 'sku', 'cod']
const ALIAS_NOMBRE = ['producto', 'nombre', 'descripcion', 'articulo', 'artículo']
const ALIAS_COSTO = ['costo', 'costo unitario', 'precio de costo', 'precio costo']
const ALIAS_PRECIO = ['precio', 'precio de venta', 'precio venta']
const ALIAS_STOCK = ['stock', 'cantidad', 'existencia', 'existencias', 'stock actual']
const ALIAS_STOCK_MINIMO = ['stock minimo', 'minimo', 'stock de seguridad']

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

    resultado.push({
      codigo: idxCodigo !== -1 && fila[idxCodigo] ? String(fila[idxCodigo]).trim() : undefined,
      nombre: String(nombre).trim(),
      costoUnitario: typeof costoRaw === 'number' ? costoRaw : 0,
      precioVenta: typeof precioRaw === 'number' ? precioRaw : undefined,
      stockActual: typeof stockRaw === 'number' ? stockRaw : 0,
      stockMinimo: typeof stockMinRaw === 'number' ? stockMinRaw : undefined,
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
