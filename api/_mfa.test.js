import { describe, expect, it } from 'vitest'
import {
  BLOQUEO_MS,
  CONFIANZA_DISPOSITIVO_MS,
  MAX_DISPOSITIVOS,
  dispositivoConfiado,
  hashDispositivo,
  registroConDispositivo,
  registroSinDispositivos,
  LARGO_CODIGO,
  MAX_ENVIOS_POR_HORA,
  MAX_INTENTOS,
  VENCIMIENTO_MS,
  formatoDeCodigoValido,
  generarCodigo,
  hashCodigo,
  hashesIguales,
  puedeEnviarCodigo,
  registroConCodigoNuevo,
  verificarIntento,
} from './_mfa.js'

const AHORA = 1_800_000_000_000
const PEPPER = 'pepper-de-prueba'
const UID = 'usuario-1'

function registroVigente(codigo = '123456', extra = {}) {
  return {
    hash: hashCodigo(codigo, UID, PEPPER),
    venceEn: AHORA + VENCIMIENTO_MS,
    intentos: 0,
    bloqueadoHasta: null,
    envios: [AHORA],
    ...extra,
  }
}

const hashDe = (codigo) => hashCodigo(codigo, UID, PEPPER)

describe('generarCodigo', () => {
  it('siempre tiene el largo esperado, incluso cuando arranca en cero', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigo()
      expect(c).toHaveLength(LARGO_CODIGO)
      expect(c).toMatch(/^\d+$/)
    }
  })

  it('no repite el mismo código una y otra vez', () => {
    const generados = new Set(Array.from({ length: 50 }, generarCodigo))
    expect(generados.size).toBeGreaterThan(40)
  })
})

describe('hashCodigo', () => {
  it('no guarda el código en claro', () => {
    expect(hashCodigo('123456', UID, PEPPER)).not.toContain('123456')
  })

  it('el mismo código en dos cuentas da hashes distintos', () => {
    expect(hashCodigo('123456', 'a', PEPPER)).not.toBe(hashCodigo('123456', 'b', PEPPER))
  })

  it('sin el pepper del servidor, el hash no se puede recalcular', () => {
    expect(hashCodigo('123456', UID, PEPPER)).not.toBe(hashCodigo('123456', UID, 'otro'))
  })
})

describe('hashesIguales', () => {
  it('reconoce dos hashes iguales', () => {
    expect(hashesIguales(hashDe('123456'), hashDe('123456'))).toBe(true)
  })

  it('rechaza distintos, y también largos distintos sin romper', () => {
    expect(hashesIguales(hashDe('123456'), hashDe('654321'))).toBe(false)
    expect(hashesIguales('abc', 'abcd')).toBe(false)
    expect(hashesIguales(undefined, null)).toBe(true)
  })
})

describe('formatoDeCodigoValido', () => {
  it('acepta seis dígitos y nada más', () => {
    expect(formatoDeCodigoValido('123456')).toBe(true)
    expect(formatoDeCodigoValido('12345')).toBe(false)
    expect(formatoDeCodigoValido('1234567')).toBe(false)
    expect(formatoDeCodigoValido('12345a')).toBe(false)
    expect(formatoDeCodigoValido(undefined)).toBe(false)
  })
})

describe('verificarIntento', () => {
  it('con el código correcto, entra', () => {
    const r = verificarIntento(registroVigente(), hashDe('123456'), AHORA)
    expect(r.resultado).toBe('ok')
  })

  it('el código es de un solo uso: la segunda vez ya no sirve', () => {
    const primera = verificarIntento(registroVigente(), hashDe('123456'), AHORA)
    expect(primera.resultado).toBe('ok')
    const segunda = verificarIntento(primera.registro, hashDe('123456'), AHORA)
    expect(segunda.resultado).toBe('sin-codigo')
  })

  it('un código equivocado suma un intento y avisa cuántos quedan', () => {
    const r = verificarIntento(registroVigente(), hashDe('000000'), AHORA)
    expect(r.resultado).toBe('incorrecto')
    expect(r.registro.intentos).toBe(1)
    expect(r.intentosRestantes).toBe(MAX_INTENTOS - 1)
  })

  it('a los intentos fallidos configurados, bloquea', () => {
    let registro = registroVigente()
    let ultimo
    for (let i = 0; i < MAX_INTENTOS; i++) {
      ultimo = verificarIntento(registro, hashDe('000000'), AHORA)
      registro = ultimo.registro
    }
    expect(ultimo.resultado).toBe('bloqueado')
    expect(registro.bloqueadoHasta).toBe(AHORA + BLOQUEO_MS)
  })

  it('al bloquear tira el código: no queda uno vivo esperando a que pase el bloqueo', () => {
    let registro = registroVigente()
    for (let i = 0; i < MAX_INTENTOS; i++) registro = verificarIntento(registro, hashDe('000000'), AHORA).registro
    expect(registro.hash).toBeNull()
  })

  it('bloqueado, ni siquiera el código correcto entra', () => {
    const registro = registroVigente('123456', { bloqueadoHasta: AHORA + BLOQUEO_MS })
    const r = verificarIntento(registro, hashDe('123456'), AHORA)
    expect(r.resultado).toBe('bloqueado')
    expect(r.esperaMs).toBe(BLOQUEO_MS)
  })

  it('el bloqueo se vence solo: no deja a nadie afuera para siempre', () => {
    const registro = registroVigente('123456', { bloqueadoHasta: AHORA })
    expect(verificarIntento(registro, hashDe('123456'), AHORA + 1).resultado).toBe('ok')
  })

  it('un código vencido no sirve, y se borra', () => {
    const registro = registroVigente('123456', { venceEn: AHORA - 1 })
    const r = verificarIntento(registro, hashDe('123456'), AHORA)
    expect(r.resultado).toBe('vencido')
    expect(r.registro.hash).toBeNull()
  })

  it('sin haber pedido código, no hay nada que verificar', () => {
    expect(verificarIntento(null, hashDe('123456'), AHORA).resultado).toBe('sin-codigo')
  })
})

describe('puedeEnviarCodigo', () => {
  it('sin envíos previos, se puede', () => {
    expect(puedeEnviarCodigo(null, AHORA)).toBe(true)
  })

  it('reenviar no es infinito: hay un tope por hora', () => {
    const envios = Array.from({ length: MAX_ENVIOS_POR_HORA }, (_, i) => AHORA - i * 1000)
    expect(puedeEnviarCodigo({ envios }, AHORA)).toBe(false)
  })

  it('los envíos de hace más de una hora no cuentan', () => {
    const envios = Array.from({ length: MAX_ENVIOS_POR_HORA }, () => AHORA - 2 * 60 * 60 * 1000)
    expect(puedeEnviarCodigo({ envios }, AHORA)).toBe(true)
  })

  it('bloqueado no se puede pedir otro: reenviar no es la salida del bloqueo', () => {
    expect(puedeEnviarCodigo({ bloqueadoHasta: AHORA + 1000, envios: [] }, AHORA)).toBe(false)
  })
})

describe('registroConCodigoNuevo', () => {
  it('pone el código nuevo con su vencimiento y reinicia los intentos', () => {
    const r = registroConCodigoNuevo({ intentos: 3, envios: [] }, hashDe('999999'), AHORA)
    expect(r.venceEn).toBe(AHORA + VENCIMIENTO_MS)
    expect(r.intentos).toBe(0)
    expect(r.envios).toEqual([AHORA])
  })

  it('va dejando el rastro de los envíos de la última hora', () => {
    const r = registroConCodigoNuevo({ envios: [AHORA - 1000, AHORA - 3 * 60 * 60 * 1000] }, 'h', AHORA)
    expect(r.envios).toEqual([AHORA - 1000, AHORA])
  })
})

describe('dispositivos confiados', () => {
  const hashDisp = (id) => hashDispositivo(id, UID, PEPPER)

  it('un dispositivo que nunca pasó el código no está confiado', () => {
    expect(dispositivoConfiado(null, hashDisp('pc-1'), AHORA)).toBe(false)
  })

  it('después de recordarlo, entra sin pedir código', () => {
    const r = registroConDispositivo(null, hashDisp('pc-1'), AHORA)
    expect(dispositivoConfiado(r, hashDisp('pc-1'), AHORA)).toBe(true)
  })

  it('otro dispositivo del mismo usuario sigue teniendo que verificarse', () => {
    const r = registroConDispositivo(null, hashDisp('pc-1'), AHORA)
    expect(dispositivoConfiado(r, hashDisp('celular'), AHORA)).toBe(false)
  })

  it('la confianza se vence', () => {
    const r = registroConDispositivo(null, hashDisp('pc-1'), AHORA)
    expect(dispositivoConfiado(r, hashDisp('pc-1'), AHORA + CONFIANZA_DISPOSITIVO_MS + 1)).toBe(false)
  })

  it('volver a entrar con el mismo dispositivo renueva, no duplica', () => {
    let r = registroConDispositivo(null, hashDisp('pc-1'), AHORA)
    r = registroConDispositivo(r, hashDisp('pc-1'), AHORA + 1000)
    expect(r.dispositivos).toHaveLength(1)
    expect(r.dispositivos[0].venceEn).toBe(AHORA + 1000 + CONFIANZA_DISPOSITIVO_MS)
  })

  it('no guarda el identificador en claro', () => {
    const r = registroConDispositivo(null, hashDisp('pc-1'), AHORA)
    expect(JSON.stringify(r)).not.toContain('pc-1')
  })

  it('se queda con los más nuevos cuando son demasiados', () => {
    let r = null
    for (let i = 0; i < MAX_DISPOSITIVOS + 5; i++) r = registroConDispositivo(r, hashDisp(`d-${i}`), AHORA + i)
    expect(r.dispositivos).toHaveLength(MAX_DISPOSITIVOS)
    expect(dispositivoConfiado(r, hashDisp('d-0'), AHORA)).toBe(false)
    expect(dispositivoConfiado(r, hashDisp(`d-${MAX_DISPOSITIVOS + 4}`), AHORA)).toBe(true)
  })

  it('olvidar todos deja a cada dispositivo teniendo que verificarse de nuevo', () => {
    const r = registroSinDispositivos(registroConDispositivo(null, hashDisp('pc-1'), AHORA))
    expect(dispositivoConfiado(r, hashDisp('pc-1'), AHORA)).toBe(false)
  })

  it('recordar un dispositivo no pisa el resto del registro', () => {
    const r = registroConDispositivo({ intentos: 2, envios: [AHORA] }, hashDisp('pc-1'), AHORA)
    expect(r.intentos).toBe(2)
    expect(r.envios).toEqual([AHORA])
  })
})
