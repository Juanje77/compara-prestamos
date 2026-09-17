import { describe, expect, it } from 'vitest'
import { datosDePrueba, puedeOtorgarsePrueba } from './_prueba.js'

describe('puedeOtorgarsePrueba', () => {
  it('se la da a quien no tiene ningún documento de plan', () => {
    expect(puedeOtorgarsePrueba(undefined)).toBe(true)
    expect(puedeOtorgarsePrueba(null)).toBe(true)
    expect(puedeOtorgarsePrueba({})).toBe(true)
  })

  it('se la da a quien abandonó un checkout', () => {
    // Éste era el caso roto: crear-suscripcion deja el documento en "pendiente" apenas se toca un
    // plan, y con la regla vieja ese usuario se quedaba sin prueba para siempre.
    const abandonado = { plan: 'full', estado: 'pendiente', esPrueba: false, mpPreapprovalId: 'abc' }

    expect(puedeOtorgarsePrueba(abandonado)).toBe(true)
  })

  it('no se la da dos veces', () => {
    expect(puedeOtorgarsePrueba({ pruebaOtorgadaEn: '2026-09-01T00:00:00.000Z' })).toBe(false)
    // Quienes la recibieron antes de que existiera esa marca quedan cubiertos igual.
    expect(puedeOtorgarsePrueba({ esPrueba: true })).toBe(false)
    expect(puedeOtorgarsePrueba({ pruebaFin: '2026-09-30T00:00:00.000Z' })).toBe(false)
  })

  it('no se la da a quien ya tuvo una suscripción real, en cualquier estado', () => {
    for (const estado of ['activo', 'pausado', 'cancelado']) {
      expect(puedeOtorgarsePrueba({ plan: 'premium', estado })).toBe(false)
    }
  })

  it('una prueba vencida sigue contando como usada', () => {
    const vencida = { plan: 'full', estado: 'activo', esPrueba: true, pruebaFin: '2020-01-01T00:00:00.000Z' }

    expect(puedeOtorgarsePrueba(vencida)).toBe(false)
  })
})

describe('datosDePrueba', () => {
  const AHORA = new Date('2026-09-17T12:00:00.000Z')

  it('otorga Full activo por los días que correspondan', () => {
    const d = datosDePrueba(15, AHORA)

    expect(d).toMatchObject({ plan: 'full', estado: 'activo', esPrueba: true })
    expect(d.pruebaFin).toBe('2026-10-02T12:00:00.000Z')
  })

  it('deja la marca que impide una segunda prueba', () => {
    const d = datosDePrueba(15, AHORA)

    expect(d.pruebaOtorgadaEn).toBe('2026-09-17T12:00:00.000Z')
    expect(puedeOtorgarsePrueba(d)).toBe(false)
  })
})
