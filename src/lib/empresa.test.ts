import { describe, expect, it } from 'vitest'
import { accesoDeDueno, accesoDesdeClaims, invitacionEnLaUrl } from './empresa'
import { BLOQUES } from './negocioBloques'

describe('accesoDesdeClaims', () => {
  it('sin claims es el dueño de su propia cuenta, como era antes de que esto existiera', () => {
    expect(accesoDesdeClaims('u1', undefined)).toEqual(accesoDeDueno('u1'))
    expect(accesoDesdeClaims('u1', {})).toEqual(accesoDeDueno('u1'))
  })

  it('el dueño ve todos los bloques', () => {
    expect(accesoDeDueno('u1').bloques).toEqual(BLOQUES)
  })

  it('un empleado apunta a los datos de la empresa, no a los suyos', () => {
    const acceso = accesoDesdeClaims('empleado1', {
      empresaId: 'dueno1',
      modulos: ['facturas'],
      bloques: ['comercial'],
    })
    expect(acceso).toEqual({
      esDueno: false,
      empresaId: 'dueno1',
      modulos: ['facturas'],
      bloques: ['comercial'],
    })
  })

  it('descarta un bloque inventado en el token', () => {
    // No es la defensa real —el token lo firma el servidor— pero tampoco hay que pedirle a
    // Firestore un documento que no existe por un claim con basura adentro.
    const acceso = accesoDesdeClaims('e1', { empresaId: 'd1', modulos: [], bloques: ['comercial', 'inventado'] })
    expect(acceso.bloques).toEqual(['comercial'])
  })

  it('un empresaId que apunta a uno mismo se trata como dueño', () => {
    expect(accesoDesdeClaims('u1', { empresaId: 'u1' }).esDueno).toBe(true)
  })

  it('un empresaId con forma rara no deja la app a medias', () => {
    expect(accesoDesdeClaims('u1', { empresaId: 42 }).esDueno).toBe(true)
    expect(accesoDesdeClaims('u1', { empresaId: '' }).esDueno).toBe(true)
  })

  it('un empleado sin bloques no lee nada, pero sigue siendo empleado', () => {
    const acceso = accesoDesdeClaims('e1', { empresaId: 'd1' })
    expect(acceso.esDueno).toBe(false)
    expect(acceso.bloques).toEqual([])
  })
})

describe('invitacionEnLaUrl', () => {
  it('toma el código del link del mail', () => {
    expect(invitacionEnLaUrl('?invitacion=d1.i1.secreto')).toBe('d1.i1.secreto')
  })

  it('devuelve null cuando no hay nada', () => {
    expect(invitacionEnLaUrl('')).toBeNull()
    expect(invitacionEnLaUrl('?otra=cosa')).toBeNull()
    expect(invitacionEnLaUrl('?invitacion=')).toBeNull()
  })
})
