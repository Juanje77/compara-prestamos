import { describe, expect, it } from 'vitest'
import { DIAS_GRACIA_SUSCRIPCION, diasRestantesGracia, enPeriodoDeGracia, type PlanUsuario } from './plan'

function plan(parcial: Partial<PlanUsuario>): PlanUsuario {
  return { plan: 'premium', estado: 'activo', esPrueba: false, pruebaFin: null, pausadoDesde: null, ...parcial }
}

function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
}

describe('enPeriodoDeGracia', () => {
  it('es falso con el plan activo', () => {
    expect(enPeriodoDeGracia(plan({ estado: 'activo', pausadoDesde: haceDias(1) }))).toBe(false)
  })

  it('es verdadero recién pausado, dentro de los días de gracia', () => {
    expect(enPeriodoDeGracia(plan({ estado: 'pausado', pausadoDesde: haceDias(1) }))).toBe(true)
  })

  it('sigue siendo verdadero justo antes de agotarse la gracia', () => {
    expect(enPeriodoDeGracia(plan({ estado: 'cancelado', pausadoDesde: haceDias(DIAS_GRACIA_SUSCRIPCION - 1) }))).toBe(true)
  })

  it('es falso una vez agotados los días de gracia', () => {
    expect(enPeriodoDeGracia(plan({ estado: 'pausado', pausadoDesde: haceDias(DIAS_GRACIA_SUSCRIPCION + 1) }))).toBe(false)
  })

  it('es falso sin pausadoDesde, aunque el estado esté pausado', () => {
    expect(enPeriodoDeGracia(plan({ estado: 'pausado', pausadoDesde: null }))).toBe(false)
  })
})

describe('diasRestantesGracia', () => {
  it('cuenta hacia abajo desde los días de gracia totales', () => {
    const dias = diasRestantesGracia(plan({ estado: 'pausado', pausadoDesde: haceDias(2) }))
    expect(dias).toBe(DIAS_GRACIA_SUSCRIPCION - 2)
  })

  it('da 0 fuera del período de gracia', () => {
    expect(diasRestantesGracia(plan({ estado: 'activo' }))).toBe(0)
    expect(diasRestantesGracia(plan({ estado: 'pausado', pausadoDesde: haceDias(DIAS_GRACIA_SUSCRIPCION + 1) }))).toBe(0)
  })
})
