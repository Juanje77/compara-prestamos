import { describe, expect, it } from 'vitest'
import { emisorDe, planHabilitaEmitir, refFiscal, refPlan } from './_auth.js'

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

describe('refPlan', () => {
  // Doble mínimo: nos importa la ruta que se arma, no Firestore.
  const db = {
    collection: (nombre) => ({
      doc: (id) => ({
        collection: (sub) => ({ doc: (subId) => `${nombre}/${id}/${sub}/${subId}` }),
      }),
    }),
  }

  it('el plan sigue donde ya lo leen las otras funciones', () => {
    expect(refPlan(db, 'u1')).toBe('users/u1/meta/plan')
  })

  it('el emisor vive en meta, que solo escribe el servidor', () => {
    expect(refFiscal(db, 'u1')).toBe('users/u1/meta/fiscal')
  })
})

describe('emisorDe', () => {
  /** `fiscal` es lo que hay en meta/fiscal (lo escribe el servidor) y `usuario` el documento del
   * negocio (lo escribe el navegador). */
  const dbCon = (fiscal, usuario) => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ data: () => usuario }),
        collection: () => ({ doc: () => ({ get: async () => ({ data: () => fiscal }) }) }),
      }),
    }),
  })

  it('devuelve el emisor que registró el servidor', async () => {
    expect(await emisorDe(dbCon({ emisorId: 123 }, undefined), 'u1')).toEqual({ emisorId: 123, legado: false })
  })

  it('ignora lo que el usuario se haya escrito en su propio documento', async () => {
    // Éste es el punto del cambio: negocioData lo escribe el navegador, así que un emisor puesto
    // ahí no puede valer — si valiera, cualquiera factura con el CUIT de otro poniendo su número.
    const db = dbCon(undefined, { negocioData: { datosEmisorFiscal: { emisorId: 999 } } })
    expect((await emisorDe(db, 'u1')).emisorId).toBeNull()
  })

  it('marca como legado a quien lo tenía guardado del lado del navegador', async () => {
    const db = dbCon(undefined, { negocioData: { datosEmisorFiscal: { emisorId: 999 } } })
    expect((await emisorDe(db, 'u1')).legado).toBe(true)
  })

  it('no es legado quien nunca registró nada', async () => {
    for (const usuario of [undefined, {}, { negocioData: {} }, { negocioData: { datosEmisorFiscal: {} } }]) {
      expect(await emisorDe(dbCon(undefined, usuario), 'u1')).toEqual({ emisorId: null, legado: false })
    }
  })

  it('rechaza un emisorId que no sea un entero positivo', async () => {
    for (const basura of ['7', 0, -3, 1.5, true, null, {}]) {
      expect((await emisorDe(dbCon({ emisorId: basura }, undefined), 'u1')).emisorId).toBeNull()
    }
  })
})
