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
 * Lee un Excel de cuentas a cobrar/pagar. Busca columnas por nombre (tolerando variantes en
 * español y mayúsculas/acentos) en vez de exigir un formato exacto de planilla.
 */
export async function importarCuentasDesdeExcel(file: File): Promise<FilaImportada[]> {
  const { readSheet } = await import('read-excel-file/browser')
  const filas = await readSheet(file)
  if (filas.length < 2) return []

  const encabezados = filas[0].map(normalizar)
  const idxConcepto = encabezados.findIndex((h) => ALIAS_CONCEPTO.includes(h))
  const idxMonto = encabezados.findIndex((h) => ALIAS_MONTO.includes(h))
  const idxFecha = encabezados.findIndex((h) => ALIAS_FECHA.includes(h))

  if (idxConcepto === -1 || idxMonto === -1) {
    throw new Error(
      'No se encontraron columnas de "Cliente" y "Monto" en el archivo. Verificá que la primera fila tenga esos encabezados.',
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
