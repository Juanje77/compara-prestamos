import { describe, expect, it } from 'vitest'
import { claveComprobante, quitarDuplicados } from './arcaImport'

/** Una fila como la que devuelve el importador de ARCA. */
function fila(parcial: Partial<Parameters<typeof claveComprobante>[0]> = {}) {
  return {
    tipo: 'recibida' as const,
    tipoComprobante: 'factura' as const,
    contraparte: 'Distribuidora Sur SA',
    numero: '0003-00001234',
    fecha: '2026-10-01',
    monto: 121000,
    ...parcial,
  }
}

describe('claveComprobante', () => {
  it('el mismo comprobante da la misma clave', () => {
    expect(claveComprobante(fila())).toBe(claveComprobante(fila()))
  })

  it('no se marea con mayúsculas ni espacios en el nombre del proveedor', () => {
    expect(claveComprobante(fila({ contraparte: '  DISTRIBUIDORA SUR SA ' }))).toBe(claveComprobante(fila()))
  })

  it('distingue emitidas de recibidas con el mismo número', () => {
    expect(claveComprobante(fila({ tipo: 'emitida' }))).not.toBe(claveComprobante(fila()))
  })

  it('distingue una factura de su nota de crédito', () => {
    expect(claveComprobante(fila({ tipoComprobante: 'nota_credito' }))).not.toBe(claveComprobante(fila()))
  })

  it('distingue el mismo número de dos proveedores distintos', () => {
    expect(claveComprobante(fila({ contraparte: 'Otro Proveedor' }))).not.toBe(claveComprobante(fila()))
  })

  it('con número, el monto no cambia la clave: una corrección de importe sigue siendo el mismo comprobante', () => {
    expect(claveComprobante(fila({ monto: 999 }))).toBe(claveComprobante(fila()))
  })

  it('sin número cae a fecha y monto, que es lo único que queda', () => {
    const sinNumero = fila({ numero: undefined })
    expect(claveComprobante(sinNumero)).toBe(claveComprobante(fila({ numero: undefined })))
    expect(claveComprobante(sinNumero)).not.toBe(claveComprobante(fila({ numero: undefined, monto: 1 })))
  })
})

describe('quitarDuplicados', () => {
  it('deja pasar lo que no estaba', () => {
    const r = quitarDuplicados([fila()], [])
    expect(r.nuevos).toHaveLength(1)
    expect(r.duplicados).toBe(0)
  })

  it('saltea lo que ya está cargado', () => {
    const r = quitarDuplicados([fila()], [fila()])
    expect(r.nuevos).toHaveLength(0)
    expect(r.duplicados).toBe(1)
  })

  it('subir el mismo archivo dos veces no agrega nada', () => {
    const archivo = [fila(), fila({ numero: '0003-00001235' }), fila({ numero: '0003-00001236' })]
    const primera = quitarDuplicados(archivo, [])
    expect(primera.nuevos).toHaveLength(3)
    const segunda = quitarDuplicados(archivo, primera.nuevos)
    expect(segunda.nuevos).toHaveLength(0)
    expect(segunda.duplicados).toBe(3)
  })

  it('un archivo con filas repetidas adentro tampoco las duplica', () => {
    const r = quitarDuplicados([fila(), fila()], [])
    expect(r.nuevos).toHaveLength(1)
    expect(r.duplicados).toBe(1)
  })

  it('importar el mes siguiente agrega solo lo nuevo', () => {
    const yaCargado = [fila({ numero: '0003-00001234' }), fila({ numero: '0003-00001235' })]
    const archivoNuevo = [
      fila({ numero: '0003-00001235' }),
      fila({ numero: '0003-00001236' }),
      fila({ numero: '0003-00001237' }),
    ]
    const r = quitarDuplicados(archivoNuevo, yaCargado)
    expect(r.nuevos.map((f) => f.numero)).toEqual(['0003-00001236', '0003-00001237'])
    expect(r.duplicados).toBe(1)
  })

  it('no toca el orden ni el contenido de lo que deja pasar', () => {
    const archivo = [fila({ numero: 'a' }), fila({ numero: 'b' })]
    expect(quitarDuplicados(archivo, []).nuevos).toEqual(archivo)
  })
})
