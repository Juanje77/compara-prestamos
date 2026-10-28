import { describe, expect, it } from 'vitest'
import {
  MAX_MESES_HISTORIAL,
  fotoAnteriorA,
  fotoDe,
  hayQueTomarFoto,
  registrarFoto,
  ultimosMeses,
  type FotoMensual,
} from './historialMensual'

function foto(mes: string, extra: Partial<FotoMensual> = {}): FotoMensual {
  return { mes, tomadaEn: 1000, ...extra }
}

describe('registrarFoto', () => {
  it('agrega la primera', () => {
    expect(registrarFoto([], foto('2026-01'))).toEqual([foto('2026-01')])
  })

  it('pisa la del mismo mes en vez de duplicarla', () => {
    // La del mes en curso es "cómo venimos hoy": tiene que reflejar lo último.
    const h = registrarFoto([foto('2026-01', { caja: 100 })], foto('2026-01', { caja: 500, tomadaEn: 2000 }))
    expect(h).toHaveLength(1)
    expect(h[0].caja).toBe(500)
    expect(h[0].tomadaEn).toBe(2000)
  })

  it('no toca las de otros meses', () => {
    const h = registrarFoto([foto('2026-01', { caja: 100 })], foto('2026-02', { caja: 200 }))
    expect(h.map((f) => f.mes)).toEqual(['2026-01', '2026-02'])
    expect(h[0].caja).toBe(100)
  })

  it('deja el historial ordenado aunque llegue desordenado', () => {
    let h: FotoMensual[] = []
    for (const m of ['2026-03', '2026-01', '2026-02']) h = registrarFoto(h, foto(m))
    expect(h.map((f) => f.mes)).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('no crece más allá del tope, tirando los meses más viejos', () => {
    let h: FotoMensual[] = []
    for (let i = 0; i < MAX_MESES_HISTORIAL + 5; i++) {
      h = registrarFoto(h, foto(`2020-${String((i % 12) + 1).padStart(2, '0')}`.replace('2020', String(2020 + Math.floor(i / 12)))))
    }
    expect(h).toHaveLength(MAX_MESES_HISTORIAL)
  })

  it('no modifica la lista que recibe', () => {
    const original = [foto('2026-01')]
    registrarFoto(original, foto('2026-02'))
    expect(original).toHaveLength(1)
  })
})

describe('fotoAnteriorA', () => {
  const h = [foto('2026-01'), foto('2026-02'), foto('2026-04')]

  it('devuelve la del mes anterior', () => {
    expect(fotoAnteriorA(h, '2026-02')?.mes).toBe('2026-01')
  })

  it('si falta un mes, salta al último que haya', () => {
    // Nadie abrió la app en marzo: comparar contra febrero es mucho mejor que no comparar.
    expect(fotoAnteriorA(h, '2026-04')?.mes).toBe('2026-02')
  })

  it('no hay anterior a la primera', () => {
    expect(fotoAnteriorA(h, '2026-01')).toBeNull()
    expect(fotoAnteriorA([], '2026-01')).toBeNull()
  })

  it('no se devuelve a sí misma', () => {
    expect(fotoAnteriorA(h, '2026-02')?.mes).not.toBe('2026-02')
  })
})

describe('hayQueTomarFoto', () => {
  const unDia = 24 * 60 * 60 * 1000

  it('sí, si no hay ninguna de ese mes', () => {
    expect(hayQueTomarFoto([], '2026-03')).toBe(true)
  })

  it('no, si ya se tomó hoy', () => {
    // Reescribir el documento en cada tecla sería multiplicar las escrituras sin ganancia.
    expect(hayQueTomarFoto([foto('2026-03', { tomadaEn: 1000 })], '2026-03', 1000 + unDia / 2)).toBe(false)
  })

  it('sí, si pasó un día', () => {
    expect(hayQueTomarFoto([foto('2026-03', { tomadaEn: 1000 })], '2026-03', 1000 + unDia)).toBe(true)
  })

  it('la foto de otro mes no cuenta', () => {
    expect(hayQueTomarFoto([foto('2026-02', { tomadaEn: 1000 })], '2026-03', 1000)).toBe(true)
  })
})

describe('fotoDe y ultimosMeses', () => {
  const h = [foto('2026-01'), foto('2026-02'), foto('2026-03')]

  it('encuentra un mes puntual', () => {
    expect(fotoDe(h, '2026-02')?.mes).toBe('2026-02')
    expect(fotoDe(h, '2025-12')).toBeNull()
  })

  it('los últimos N vienen de la más vieja a la más nueva', () => {
    expect(ultimosMeses(h, 2).map((f) => f.mes)).toEqual(['2026-02', '2026-03'])
  })

  it('pedir más de los que hay devuelve todos', () => {
    expect(ultimosMeses(h, 99)).toHaveLength(3)
  })
})
