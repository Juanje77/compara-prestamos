import { describe, expect, it } from 'vitest'
import { BLOQUES_POR_MODULO as TABLA_FRONT, bloquesDe as bloquesDeFront } from '../src/lib/permisos'
import {
  BLOQUES_POR_MODULO,
  armarCodigo,
  bloquesDe,
  claimsDeMiembro,
  claimsSinEmpresa,
  emailValido,
  estadoInvitacion,
  generarSecreto,
  hashCoincide,
  hashSecreto,
  normalizarEmail,
  normalizarModulos,
  partirCodigo,
  plantillaInvitacion,
} from './_empresa.js'

describe('la copia de la tabla de permisos', () => {
  // Esta es la razón de ser del archivo de tests: la tabla está escrita dos veces (acá en JS para
  // el backend, y en TypeScript para el front) y si se separan, el token lleva bloques que no
  // corresponden a los módulos que muestra la pantalla.
  it('dice exactamente lo mismo que src/lib/permisos.ts', () => {
    expect(BLOQUES_POR_MODULO).toEqual(TABLA_FRONT)
  })

  it('calcula los mismos bloques que el front para cualquier combinación', () => {
    const modulos = Object.keys(TABLA_FRONT)
    for (const m of modulos) expect(bloquesDe([m])).toEqual(bloquesDeFront([m]))
    expect(bloquesDe(modulos)).toEqual(bloquesDeFront(modulos))
  })
})

describe('normalizarModulos', () => {
  it('descarta lo que no es un módulo real', () => {
    expect(normalizarModulos(['facturas', 'inventado', 42, null])).toEqual(['facturas'])
  })

  it('saca repetidos y ordena, para que dos listas iguales se guarden igual', () => {
    expect(normalizarModulos(['sueldos', 'facturas', 'sueldos'])).toEqual(['facturas', 'sueldos'])
  })

  it('devuelve vacío si no le mandan una lista', () => {
    expect(normalizarModulos(undefined)).toEqual([])
    expect(normalizarModulos('facturas')).toEqual([])
  })
})

describe('bloquesDe', () => {
  it('le da los sueldos a quien tiene márgenes por sector', () => {
    // No es un descuido: el margen de un sector incluye el costo de la nómina asignada.
    expect(bloquesDe(['margenes'])).toContain('sueldos')
  })

  it('no le da los sueldos a quien solo carga comprobantes', () => {
    expect(bloquesDe(['facturas', 'clientes', 'proveedores'])).toEqual(['comercial'])
  })

  it('con backup da acceso a todo, porque es una copia del negocio entero', () => {
    expect(bloquesDe(['backup'])).toEqual(['comercial', 'impuestos', 'negocio', 'sueldos', 'tesoreria'])
  })
})

describe('el código de invitación', () => {
  it('vuelve entero de ida y de vuelta', () => {
    const secreto = generarSecreto()
    expect(partirCodigo(armarCodigo('empresa1', 'inv1', secreto))).toEqual({
      empresaId: 'empresa1',
      invitacionId: 'inv1',
      secreto,
    })
  })

  it('rechaza lo que no tiene las tres partes o trae un secreto corto', () => {
    expect(partirCodigo('empresa1.inv1')).toBeNull()
    expect(partirCodigo('empresa1.inv1.corto')).toBeNull()
    expect(partirCodigo(null)).toBeNull()
  })

  it('genera secretos distintos cada vez', () => {
    expect(generarSecreto()).not.toBe(generarSecreto())
  })

  it('hashea con el pepper, así un hash robado no sirve sin él', () => {
    expect(hashSecreto('abc', 'pepper1')).not.toBe(hashSecreto('abc', 'pepper2'))
    expect(hashSecreto('abc', 'p')).toBe(hashSecreto('abc', 'p'))
  })

  it('compara hashes sin romperse con largos distintos', () => {
    expect(hashCoincide('aaaa', 'aaaa')).toBe(true)
    expect(hashCoincide('aaaa', 'aaab')).toBe(false)
    expect(hashCoincide('aaaa', 'aa')).toBe(false)
    expect(hashCoincide('aaaa', undefined)).toBe(false)
  })
})

describe('estadoInvitacion', () => {
  const vigente = { vence: 2000 }

  it('vigente mientras no se usó ni venció', () => {
    expect(estadoInvitacion(vigente, 1000)).toBe('vigente')
  })

  it('usada una sola vez', () => {
    expect(estadoInvitacion({ ...vigente, aceptadaEn: 500 }, 1000)).toBe('usada')
  })

  it('vencida por fecha', () => {
    expect(estadoInvitacion(vigente, 3000)).toBe('vencida')
  })

  it('revocada', () => {
    expect(estadoInvitacion({ ...vigente, revocadaEn: 900 }, 1000)).toBe('revocada')
  })

  it('inexistente cuando no hay nada', () => {
    expect(estadoInvitacion(null)).toBe('inexistente')
  })
})

describe('los claims del token', () => {
  it('llevan los bloques calculados, no los que mande el navegador', () => {
    expect(claimsDeMiembro({}, 'empresa1', ['margenes'])).toEqual({
      empresaId: 'empresa1',
      modulos: ['margenes'],
      bloques: ['comercial', 'sueldos'],
    })
  })

  it('conservan la marca del segundo factor', () => {
    // Los claims se pisan enteros: perderla dejaría al usuario afuera hasta pasar el código otra vez.
    expect(claimsDeMiembro({ mfaHasta: 123 }, 'e', ['facturas']).mfaHasta).toBe(123)
    expect(claimsSinEmpresa({ mfaHasta: 123 }).mfaHasta).toBe(123)
  })

  it('al dar de baja dejan la empresa en null, no la borran de a pedazos', () => {
    expect(claimsSinEmpresa({})).toEqual({ empresaId: null, modulos: null, bloques: null })
  })
})

describe('mails', () => {
  it('acepta direcciones normales y rechaza las que no lo son', () => {
    expect(emailValido('juan@ejemplo.com.ar')).toBe(true)
    expect(emailValido('juan@ejemplo')).toBe(false)
    expect(emailValido('sin arroba')).toBe(false)
  })

  it('normaliza para comparar', () => {
    expect(normalizarEmail('  Juan@Ejemplo.COM ')).toBe('juan@ejemplo.com')
  })

  it('la invitación lleva el link y dice que vence', () => {
    const { texto, html, asunto } = plantillaInvitacion({
      codigo: 'a.b.c',
      empresa: 'Metalúrgica SA',
      url: 'https://fincorp.com.ar/empresas?invitacion=a.b.c',
    })
    expect(asunto).toContain('Metalúrgica SA')
    expect(texto).toContain('https://fincorp.com.ar/empresas?invitacion=a.b.c')
    expect(html).toContain('https://fincorp.com.ar/empresas?invitacion=a.b.c')
    expect(texto).toContain('7 días')
  })
})
