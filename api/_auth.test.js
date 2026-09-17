import { describe, expect, it } from 'vitest'
import { planHabilitaEmitir, refPlan, refTokenFiscal } from './_auth.js'

const AHORA = new Date('2026-09-17T12:00:00Z')

describe('planHabilitaEmitir', () => {
  it('habilita a un Full activo', () => {
    expect(planHabilitaEmitir({ plan: 'full', estado: 'activo' }, AHORA)).toBe(true)
  })

  it('no habilita a los planes de abajo, aunque estén activos', () => {
    expect(planHabilitaEmitir({ plan: 'premium', estado: 'activo' }, AHORA)).toBe(false)
    expect(planHabilitaEmitir({ plan: 'basico', estado: 'activo' }, AHORA)).toBe(false)
  })

  it('no habilita a un Full que no está activo', () => {
    expect(planHabilitaEmitir({ plan: 'full', estado: 'pausado' }, AHORA)).toBe(false)
    expect(planHabilitaEmitir({ plan: 'full', estado: 'cancelado' }, AHORA)).toBe(false)
    expect(planHabilitaEmitir({ plan: 'full', estado: 'pendiente' }, AHORA)).toBe(false)
  })

  it('habilita durante la prueba gratis y deja de hacerlo cuando vence', () => {
    const enCurso = { plan: 'full', estado: 'activo', esPrueba: true, pruebaFin: '2026-09-25T00:00:00Z' }
    const vencida = { plan: 'full', estado: 'activo', esPrueba: true, pruebaFin: '2026-09-01T00:00:00Z' }

    expect(planHabilitaEmitir(enCurso, AHORA)).toBe(true)
    expect(planHabilitaEmitir(vencida, AHORA)).toBe(false)
  })

  it('ignora pruebaFin cuando no es una prueba', () => {
    // Un plan pago que alguna vez vino de una prueba no caduca por esa fecha vieja.
    const pago = { plan: 'full', estado: 'activo', esPrueba: false, pruebaFin: '2026-09-01T00:00:00Z' }

    expect(planHabilitaEmitir(pago, AHORA)).toBe(true)
  })

  it('no habilita cuando no hay documento de plan', () => {
    expect(planHabilitaEmitir(undefined, AHORA)).toBe(false)
    expect(planHabilitaEmitir(null, AHORA)).toBe(false)
    expect(planHabilitaEmitir({}, AHORA)).toBe(false)
  })
})

describe('rutas de Firestore', () => {
  // Doble mínimo: nos importa la ruta que se arma, no Firestore.
  const db = {
    collection: (nombre) => ({
      doc: (id) => ({
        collection: (sub) => ({ doc: (subId) => `${nombre}/${id}/${sub}/${subId}` }),
      }),
    }),
  }

  it('el token vive fuera del alcance del SDK del navegador', () => {
    expect(refTokenFiscal(db, 'u1')).toBe('users/u1/secretos/fiscal')
  })

  it('el plan sigue donde ya lo leen las otras funciones', () => {
    expect(refPlan(db, 'u1')).toBe('users/u1/meta/plan')
  })
})
