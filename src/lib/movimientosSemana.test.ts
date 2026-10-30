import { beforeEach, describe, expect, it } from 'vitest'

// Los tests corren en Node, sin navegador, y este módulo guarda en localStorage. Un sustituto en
// memoria alcanza: lo que se prueba es la lógica de qué se guarda, no el almacenamiento del
// navegador. Se instala antes de importar el módulo, que lee `localStorage` al escribir.
const almacen = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => void almacen.set(k, v),
    removeItem: (k: string) => void almacen.delete(k),
    clear: () => almacen.clear(),
  },
})

const { agregarMovimiento, alternarCumplido, editarMovimiento, obtenerMovimientos, vaciarSemana } =
  await import('./movimientosSemana')

beforeEach(() => {
  vaciarSemana()
})

describe('editarMovimiento', () => {
  it('corrige el importe sin tocar lo demás', () => {
    const m = agregarMovimiento('cobro', 'Cliente A', 100, '2026-10-01')
    editarMovimiento(m.id, { monto: 250 })
    const guardado = obtenerMovimientos().find((x) => x.id === m.id)!
    expect(guardado.monto).toBe(250)
    expect(guardado.concepto).toBe('Cliente A')
    expect(guardado.fecha).toBe('2026-10-01')
  })

  it('corrige concepto y fecha juntos', () => {
    const m = agregarMovimiento('pago', 'Proveedro', 100, '2026-10-01')
    editarMovimiento(m.id, { concepto: 'Proveedor', fecha: '2026-11-15' })
    const guardado = obtenerMovimientos().find((x) => x.id === m.id)!
    expect(guardado.concepto).toBe('Proveedor')
    expect(guardado.fecha).toBe('2026-11-15')
  })

  it('corregir un dato no descobra lo que ya estaba cumplido', () => {
    const m = agregarMovimiento('cobro', 'Cliente', 100, '2026-10-01')
    alternarCumplido(m.id)
    editarMovimiento(m.id, { monto: 120 })
    expect(obtenerMovimientos().find((x) => x.id === m.id)!.cumplido).toBe(true)
  })

  it('no toca los otros movimientos', () => {
    const a = agregarMovimiento('cobro', 'A', 100, '2026-10-01')
    const b = agregarMovimiento('cobro', 'B', 200, '2026-10-02')
    editarMovimiento(a.id, { monto: 999 })
    expect(obtenerMovimientos().find((x) => x.id === b.id)!.monto).toBe(200)
  })

  it('un id que no existe no rompe ni agrega nada', () => {
    agregarMovimiento('cobro', 'A', 100, '2026-10-01')
    editarMovimiento('inexistente', { monto: 1 })
    expect(obtenerMovimientos()).toHaveLength(1)
  })

  it('cambiar la fecha reordena la lista, que sale ordenada por fecha', () => {
    const a = agregarMovimiento('cobro', 'A', 100, '2026-10-01')
    agregarMovimiento('cobro', 'B', 200, '2026-10-02')
    editarMovimiento(a.id, { fecha: '2026-12-01' })
    expect(obtenerMovimientos().map((m) => m.concepto)).toEqual(['B', 'A'])
  })
})
