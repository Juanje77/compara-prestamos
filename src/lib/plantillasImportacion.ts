// ---------------------------------------------------------------------------
// Plantillas de Excel descargables para cada importador de excelImport.ts —
// mismos encabezados que reconocen esos parsers, con un par de filas de
// ejemplo, para que el cliente sepa exactamente cómo armar su planilla antes
// de importarla.
// ---------------------------------------------------------------------------

type Celda = string | number | { value: string | number; fontWeight?: 'bold' }

function encabezado(...columnas: string[]): Celda[] {
  return columnas.map((c) => ({ value: c, fontWeight: 'bold' as const }))
}

async function descargarHoja(sheet: string, data: Celda[][], nombreArchivo: string) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  await writeXlsxFile([{ sheet, data }]).toFile(nombreArchivo)
}

/** Para Stock — misma planilla sirve de lista de precios a importar. */
export async function descargarPlantillaProductos() {
  await descargarHoja(
    'Productos',
    [
      encabezado('Código', 'Producto', 'Costo', 'Precio', 'Stock', 'Stock mínimo', 'Servicio'),
      ['A001', 'Tornillo 3/4', 50, 120, 200, 20, ''],
      ['A002', 'Chapa galvanizada', 3000, 6500, 40, 5, ''],
      ['', 'Instalación a domicilio', 0, 15000, '', '', 'Si'],
    ],
    'plantilla-productos.xlsx',
  )
}

/** Para Cobranzas y pagos — "Cobros a importar" o "Pagos a importar" según el tipo. */
export async function descargarPlantillaMovimientos(tipo: 'cobro' | 'pago') {
  const etiquetaContraparte = tipo === 'cobro' ? 'Cliente' : 'Proveedor'
  await descargarHoja(
    'Movimientos',
    [
      encabezado(etiquetaContraparte, 'Monto', 'Fecha'),
      [tipo === 'cobro' ? 'Cliente de ejemplo SA' : 'Proveedor de ejemplo SA', 150000, '2026-09-30'],
      [tipo === 'cobro' ? 'Otro cliente SRL' : 'Otro proveedor SRL', 85000, '2026-10-05'],
    ],
    `plantilla-${tipo === 'cobro' ? 'cobros' : 'pagos'}.xlsx`,
  )
}

/** Para Tesorería — extracto bancario a conciliar. */
export async function descargarPlantillaExtracto() {
  await descargarHoja(
    'Extracto',
    [
      encabezado('Fecha', 'Descripción', 'Monto', 'Saldo'),
      ['2026-09-05', 'IMP DEB CRED LEY 25413', -1850, 998150],
      ['2026-09-10', 'TRANSFERENCIA RECIBIDA', 150000, 1148150],
    ],
    'plantilla-extracto-bancario.xlsx',
  )
}
