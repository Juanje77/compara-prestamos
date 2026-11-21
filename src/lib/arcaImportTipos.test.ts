import { describe, expect, it, vi } from 'vitest'

// Se reemplaza la lectura del Excel para poder darle filas a mano: lo que se prueba es cómo se
// interpreta el archivo de ARCA, no la librería que lo abre.
const filas: unknown[][] = []
vi.mock('read-excel-file/browser', () => ({ readSheet: async () => filas }))

const { importarComprobantesArca } = await import('./arcaImport')

/** ARCA nombra la columna de la contraparte según de qué archivo se trate: en los emitidos es el
 * receptor de la factura, en los recibidos el emisor. */
function encabezados(contraparte: 'Denominacion Receptor' | 'Denominacion Emisor') {
  return ['Fecha', 'Tipo', 'Punto de Venta', 'Numero Desde', contraparte, 'Tipo Cambio', 'Moneda', 'Total IVA', 'Imp. Total']
}

/** Una fila del Excel, en el orden de los encabezados de arriba. */
function fila(tipoTexto: string, { total = 121000, iva = 21000, moneda = '$', tipoCambio = 1 } = {}) {
  return ['01/10/2026', tipoTexto, 3, 1234, 'Distribuidora Sur SA', tipoCambio, moneda, iva, total]
}

async function importar(filasDatos: unknown[][], titulo = 'Mis Comprobantes Emitidos - CUIT 20-12345678-9') {
  const recibidos = titulo.toLowerCase().includes('recibidos')
  filas.length = 0
  filas.push([titulo], encabezados(recibidos ? 'Denominacion Emisor' : 'Denominacion Receptor'), ...filasDatos)
  return importarComprobantesArca(new File([], 'arca.xlsx'))
}

describe('qué tipos de comprobante reconoce el importador de ARCA', () => {
  // La letra no cambia nada: lo que define el comportamiento es si es factura, nota de crédito o
  // nota de débito. Van todas las clases porque un monotributista solo ve C, y si alguna se
  // omitiera en silencio el error aparecería recién al cuadrar el IVA.
  it.each([
    ['1 - Factura A', 'factura'],
    ['6 - Factura B', 'factura'],
    ['11 - Factura C', 'factura'],
    ['51 - Factura M', 'factura'],
    ['19 - Factura de Exportación E', 'factura'],
    ['3 - Nota de Crédito A', 'nota_credito'],
    ['8 - Nota de Crédito B', 'nota_credito'],
    ['13 - Nota de Crédito C', 'nota_credito'],
    ['53 - Nota de Crédito M', 'nota_credito'],
    ['2 - Nota de Débito A', 'nota_debito'],
    ['7 - Nota de Débito B', 'nota_debito'],
    ['12 - Nota de Débito C', 'nota_debito'],
  ])('%s → %s', async (texto, esperado) => {
    const r = await importar([fila(texto)])
    expect(r.omitidas).toBe(0)
    expect(r.facturas[0].tipoComprobante).toBe(esperado)
  })

  it('una nota de crédito C entra aunque no tenga IVA discriminado', () => {
    // Un monotributista no discrimina IVA: la columna viene vacía y el comprobante tiene que
    // entrar igual, no omitirse.
    return importar([fila('13 - Nota de Crédito C', { iva: null as never, total: 50_000 })]).then((r) => {
      expect(r.omitidas).toBe(0)
      expect(r.facturas[0]).toMatchObject({ tipoComprobante: 'nota_credito', monto: 50_000 })
    })
  })

  it('omite lo que no reconoce, y lo cuenta', () => {
    return importar([fila('99 - Comprobante raro'), fila('13 - Nota de Crédito C')]).then((r) => {
      expect(r.omitidas).toBe(1)
      expect(r.facturas).toHaveLength(1)
    })
  })

  it('las notas de crédito del archivo de recibidos también entran', () => {
    return importar(
      [fila('13 - Nota de Crédito C')],
      'Mis Comprobantes Recibidos - CUIT 20-12345678-9',
    ).then((r) => {
      expect(r.facturas[0].tipo).toBe('recibida')
      expect(r.facturas[0].tipoComprobante).toBe('nota_credito')
    })
  })
})
