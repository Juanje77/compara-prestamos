import { describe, expect, it, vi } from 'vitest'

/** Simula el lector de Excel: devuelve las filas que le pasemos, sin tocar ningún archivo. */
function conFilas(filas: unknown[][]) {
  vi.doMock('read-excel-file/browser', () => ({ readSheet: async () => filas }))
}

async function importar(filas: unknown[][]) {
  vi.resetModules()
  conFilas(filas)
  const { importarChequesDesdeExcel: fn } = await import('./excelImport')
  return fn(new File([], 'cheques.xlsx'))
}

const ENCABEZADO = ['Número', 'Banco', 'Proveedor', 'Monto', 'Fecha de emisión', 'Fecha de pago']

describe('importarChequesDesdeExcel', () => {
  it('lee una chequera completa', async () => {
    const r = await importar([
      ENCABEZADO,
      ['00012345', 'Banco Nación', 'Proveedor SA', 450000, new Date('2026-10-05T00:00:00Z'), new Date('2026-12-10T00:00:00Z')],
    ])
    expect(r).toEqual([
      {
        numero: '00012345',
        banco: 'Banco Nación',
        contraparte: 'Proveedor SA',
        monto: 450000,
        fechaEmision: '2026-10-05',
        fechaCobro: '2026-12-10',
      },
    ])
  })

  it('tolera encabezados con otro nombre, mayúsculas o sin acentos', async () => {
    const r = await importar([
      ['NRO', 'ENTIDAD', 'Beneficiario', 'Importe', 'Libramiento', 'Vencimiento'],
      ['1', 'Galicia', 'Otro SRL', 1000, new Date('2026-01-02T00:00:00Z'), new Date('2026-03-02T00:00:00Z')],
    ])
    expect(r[0].contraparte).toBe('Otro SRL')
    expect(r[0].monto).toBe(1000)
  })

  it('sin banco ni número igual importa: se completan después a mano', async () => {
    const r = await importar([
      ['Proveedor', 'Monto', 'Fecha de pago'],
      ['Proveedor SA', 5000, new Date('2026-12-10T00:00:00Z')],
    ])
    expect(r[0].banco).toBe('')
    expect(r[0].numero).toBeUndefined()
  })

  it('sin fecha de emisión la toma igual a la de pago', async () => {
    const r = await importar([
      ['Proveedor', 'Monto', 'Fecha de pago'],
      ['Proveedor SA', 5000, new Date('2026-12-10T00:00:00Z')],
    ])
    expect(r[0].fechaEmision).toBe('2026-12-10')
  })

  it('saltea la fila sin fecha de pago: sin eso no se puede proyectar', async () => {
    const r = await importar([ENCABEZADO, ['1', 'Nación', 'Proveedor SA', 450000, null, null]])
    expect(r).toEqual([])
  })

  it('saltea filas sin importe o con importe negativo', async () => {
    const r = await importar([
      ENCABEZADO,
      ['1', 'Nación', 'Proveedor SA', null, null, new Date('2026-12-10T00:00:00Z')],
      ['2', 'Nación', 'Proveedor SA', -100, null, new Date('2026-12-10T00:00:00Z')],
      ['3', 'Nación', '', 100, null, new Date('2026-12-10T00:00:00Z')],
    ])
    expect(r).toEqual([])
  })

  it('avisa si falta la columna del beneficiario o la del monto', async () => {
    await expect(importar([['Banco', 'Fecha de pago'], ['Nación', new Date()]])).rejects.toThrow(/Proveedor/)
  })

  it('avisa si falta la fecha de pago, que es la que ubica el cheque en la caja', async () => {
    await expect(
      importar([['Proveedor', 'Monto'], ['Proveedor SA', 1000]]),
    ).rejects.toThrow(/Fecha de pago/)
  })

  it('un archivo con solo el encabezado no importa nada', async () => {
    expect(await importar([ENCABEZADO])).toEqual([])
  })
})
