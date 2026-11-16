import { beforeEach, describe, expect, it, vi } from 'vitest'

// El único punto de contacto con Firestore. Se reemplaza entero para poder manejar a mano el
// orden en que llegan los snapshots, que es justo donde estaba el error.
type Listener = { ruta: string; opciones: unknown; onNext: (snap: unknown) => void; onError: () => void }
const listeners: Listener[] = []

vi.mock('./firebase', () => ({ app: {}, firebaseHabilitado: true }))
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...partes: string[]) => ({ ruta: partes.join('/') }),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: (ref: { ruta: string }, opciones: unknown, onNext: (s: unknown) => void, onError: () => void) => {
    listeners.push({ ruta: ref.ruta, opciones, onNext, onError })
    return () => {}
  },
}))

/** Lo que entrega el SDK: el mismo documento llega primero desde la caché y después confirmado. */
function snapshot({ existe, datos, deCache }: { existe: boolean; datos?: unknown; deCache: boolean }) {
  return { exists: () => existe, data: () => datos ?? {}, metadata: { fromCache: deCache } }
}

describe('suscribirseADatosUsuario', () => {
  beforeEach(() => {
    listeners.length = 0
    vi.resetModules()
  })

  /** Suscribe y espera a que se registren los listeners (obtenerApi es asincrónico). */
  async function suscribir(onDatos: (d: unknown) => void) {
    const { suscribirseADatosUsuario } = await import('./userSync')
    suscribirseADatosUsuario('u1', onDatos, ['tesoreria'])
    await vi.waitFor(() => expect(listeners.length).toBe(2))
  }

  it('pide los cambios de metadata, que es como se entera de que el servidor contestó', async () => {
    await suscribir(() => {})
    for (const l of listeners) {
      expect(l.opciones, `listener de ${l.ruta}`).toEqual({ includeMetadataChanges: true })
    }
  })

  it('no da por buena la respuesta de la caché: podría estar vacía por falta de red', async () => {
    const onDatos = vi.fn()
    await suscribir(onDatos)
    for (const l of listeners) l.onNext(snapshot({ existe: false, deCache: true }))
    expect(onDatos).not.toHaveBeenCalled()
  })

  it('arranca igual cuando el documento no existe en el servidor — el caso de la cuenta nueva', async () => {
    const onDatos = vi.fn()
    await suscribir(onDatos)
    // Caché y servidor dicen exactamente lo mismo: vacío. Solo cambia de dónde salió, y es
    // justamente ese aviso el que antes no llegaba y dejaba la pantalla cargando.
    for (const l of listeners) l.onNext(snapshot({ existe: false, deCache: true }))
    for (const l of listeners) l.onNext(snapshot({ existe: false, deCache: false }))
    expect(onDatos).toHaveBeenCalledWith(null)
  })

  it('entrega los datos cuando el servidor confirma lo que hay guardado', async () => {
    const onDatos = vi.fn()
    await suscribir(onDatos)
    const bloque = listeners.find((l) => l.ruta === 'users/u1/datos/tesoreria')!
    const principal = listeners.find((l) => l.ruta === 'users/u1')!
    bloque.onNext(snapshot({ existe: true, datos: { cuentas: [{ id: 'c1' }] }, deCache: false }))
    principal.onNext(snapshot({ existe: false, deCache: false }))
    expect(onDatos).toHaveBeenCalledTimes(1)
    expect(onDatos.mock.calls[0][0]).toMatchObject({ negocioData: { cuentas: [{ id: 'c1' }] } })
  })

  it('sigue adelante si un bloque es rechazado por permisos', async () => {
    const onDatos = vi.fn()
    await suscribir(onDatos)
    listeners.find((l) => l.ruta === 'users/u1/datos/tesoreria')!.onError()
    listeners.find((l) => l.ruta === 'users/u1')!.onNext(snapshot({ existe: false, deCache: false }))
    expect(onDatos).toHaveBeenCalledWith(null)
  })
})
