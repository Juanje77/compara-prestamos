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
