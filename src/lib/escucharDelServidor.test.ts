import { describe, expect, it, vi } from 'vitest'
import { escucharDelServidor } from './escucharDelServidor'

type Snap = { exists: () => boolean; data: () => unknown; metadata: { fromCache: boolean } }
function snapshot(deCache: boolean, datos?: unknown): Snap {
  return { exists: () => datos !== undefined, data: () => datos, metadata: { fromCache: deCache } }
}

/** Un onSnapshot de mentira que deja disparar las respuestas a mano, en el orden que se quiera. */
function fakeOnSnapshot() {
  const registro: { opciones: unknown; onNext: (s: Snap) => void; onError: () => void } = {
    opciones: undefined,
    onNext: () => {},
    onError: () => {},
  }
  const baja = vi.fn()
  const onSnapshot = ((_ref: unknown, opciones: unknown, onNext: (s: Snap) => void, onError: () => void) => {
    registro.opciones = opciones
    registro.onNext = onNext
    registro.onError = onError
    return baja
  }) as never
  return { registro, baja, onSnapshot }
}

describe('escucharDelServidor', () => {
  it('pide los cambios de metadata: es el único aviso de que el servidor contestó', () => {
    const { registro, onSnapshot } = fakeOnSnapshot()
    escucharDelServidor(onSnapshot, {} as never, () => {}, () => {})
    expect(registro.opciones).toEqual({ includeMetadataChanges: true })
  })

  it('ignora la respuesta de la caché: puede estar vacía por falta de red', () => {
    const { registro, onSnapshot } = fakeOnSnapshot()
    const alLlegar = vi.fn()
    escucharDelServidor(onSnapshot, {} as never, alLlegar, () => {})
    registro.onNext(snapshot(true))
    expect(alLlegar).not.toHaveBeenCalled()
  })

  it('avisa cuando el servidor confirma que el documento no existe — la cuenta nueva', () => {
    const { registro, onSnapshot } = fakeOnSnapshot()
    const alLlegar = vi.fn()
    escucharDelServidor(onSnapshot, {} as never, alLlegar, () => {})
    // Caché y servidor dicen lo mismo: vacío. Solo cambia de dónde salió, y ese aviso llega
    // únicamente con includeMetadataChanges. Sin él, acá no pasaba nada nunca.
    registro.onNext(snapshot(true))
    registro.onNext(snapshot(false))
    expect(alLlegar).toHaveBeenCalledTimes(1)
    expect(alLlegar.mock.calls[0][0].exists()).toBe(false)
  })

  it('avisa con los datos cuando el servidor confirma que sí existe', () => {
    const { registro, onSnapshot } = fakeOnSnapshot()
    const alLlegar = vi.fn()
    escucharDelServidor(onSnapshot, {} as never, alLlegar, () => {})
    registro.onNext(snapshot(false, { plan: 'full' }))
    expect(alLlegar.mock.calls[0][0].data()).toEqual({ plan: 'full' })
  })

  it('pasa el error tal cual, para que quien escucha pueda seguir adelante', () => {
    const { registro, onSnapshot } = fakeOnSnapshot()
    const alFallar = vi.fn()
    escucharDelServidor(onSnapshot, {} as never, () => {}, alFallar)
    registro.onError()
    expect(alFallar).toHaveBeenCalled()
  })

  it('devuelve la baja del listener', () => {
    const { baja, onSnapshot } = fakeOnSnapshot()
    expect(escucharDelServidor(onSnapshot, {} as never, () => {}, () => {})).toBe(baja)
  })
})
