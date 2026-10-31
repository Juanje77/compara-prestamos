import { describe, expect, it } from 'vitest'
import type { Bien } from './cfo'
import { amortizacionesDelAnio, amortizarBien } from './amortizaciones'

function bien(extra: Partial<Bien> = {}): Bien {
  return { id: 'b1', concepto: 'Camioneta', tipo: 'vehiculo', valorEstimado: 12000000, ...extra } as Bien
}

describe('amortizarBien', () => {
  it('un bien de alta en enero amortiza el año entero', () => {
    const a = amortizarBien(bien({ fechaAlta: '2026-01-01', vidaUtilAnios: 5 }), 2026)!
    expect(a.cuotaAnual).toBe(2400000)
    expect(a.mesesEnElPeriodo).toBe(12)
    expect(a.delPeriodo).toBe(2400000)
  })

  it('uno de alta a mitad de año amortiza solo los meses que estuvo', () => {
    // Septiembre a diciembre: cuatro meses, no el ejercicio entero.
    const a = amortizarBien(bien({ fechaAlta: '2026-09-01', vidaUtilAnios: 5 }), 2026)!
    expect(a.mesesEnElPeriodo).toBe(4)
    expect(a.delPeriodo).toBe(800000)
  })

  it('en los ejercicios siguientes amortiza el año completo', () => {
    const a = amortizarBien(bien({ fechaAlta: '2026-09-01', vidaUtilAnios: 5 }), 2027)!
    expect(a.mesesEnElPeriodo).toBe(12)
    expect(a.delPeriodo).toBe(2400000)
  })

  it('la acumulada arrastra desde el alta y el residual baja', () => {
    const a = amortizarBien(bien({ fechaAlta: '2026-01-01', vidaUtilAnios: 5 }), 2027)!
    expect(a.acumulada).toBe(4800000)
    expect(a.residual).toBe(7200000)
  })

  it('terminada la vida útil deja de amortizar y el residual queda en cero', () => {
    const a = amortizarBien(bien({ fechaAlta: '2020-01-01', vidaUtilAnios: 5 }), 2026)!
    expect(a.delPeriodo).toBe(0)
    expect(a.acumulada).toBe(12000000)
    expect(a.residual).toBe(0)
  })

  it('el año en que termina la vida útil amortiza solo la parte que queda', () => {
    // Alta en julio de 2021, cinco años: la vida útil termina en julio de 2026.
    const a = amortizarBien(bien({ fechaAlta: '2021-07-01', vidaUtilAnios: 5 }), 2026)!
    expect(a.mesesEnElPeriodo).toBe(6)
    expect(a.delPeriodo).toBe(1200000)
  })

  it('un bien anterior al ejercicio que se mira no amortiza de más', () => {
    const a = amortizarBien(bien({ fechaAlta: '2027-03-01', vidaUtilAnios: 5 }), 2026)!
    expect(a.mesesEnElPeriodo).toBe(0)
    expect(a.delPeriodo).toBe(0)
  })

  it('sin fecha de alta o sin vida útil no amortiza', () => {
    // Inventar una vida útil daría un número que el contador no puso.
    expect(amortizarBien(bien({ vidaUtilAnios: 5 }), 2026)).toBeNull()
    expect(amortizarBien(bien({ fechaAlta: '2026-01-01' }), 2026)).toBeNull()
    expect(amortizarBien(bien({ fechaAlta: '2026-01-01', vidaUtilAnios: 0 }), 2026)).toBeNull()
  })

  it('nunca amortiza más que el valor del bien', () => {
    const a = amortizarBien(bien({ fechaAlta: '2010-01-01', vidaUtilAnios: 5 }), 2026)!
    expect(a.acumulada).toBeLessThanOrEqual(12000000)
  })
})

describe('amortizacionesDelAnio', () => {
  it('suma lo del período y separa los que no tienen datos', () => {
    const r = amortizacionesDelAnio(
      [
        bien({ id: 'a', fechaAlta: '2026-01-01', vidaUtilAnios: 5 }),
        bien({ id: 'b', concepto: 'Local', valorEstimado: 50000000 }),
      ],
      2026,
    )
    expect(r.totalDelPeriodo).toBe(2400000)
    expect(r.sinDatos.map((b) => b.id)).toEqual(['b'])
  })

  it('sin bienes da cero y nada pendiente', () => {
    expect(amortizacionesDelAnio([], 2026)).toEqual({ detalle: [], totalDelPeriodo: 0, sinDatos: [] })
  })
})
