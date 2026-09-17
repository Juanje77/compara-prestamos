// Cliente de los endpoints propios de facturación (api/guardar-token-fiscal.js y
// api/emitir-comprobante.js).
//
// Todo pasa por el backend: el token de emisión nunca se descarga al navegador, y esta capa no
// tiene forma de leerlo. Lo único que viaja de vuelta es si está configurado y su pista.
import { auth } from './firebase'
import type { PayloadComprobante } from './facturacionElectronica'

export type AmbienteFiscal = 'pruebas' | 'produccion'

export interface EstadoTokenFiscal {
  configurado: boolean
  /** Últimos cuatro caracteres, enmascarados — nunca el token entero. */
  pista: string | null
  ambiente: AmbienteFiscal | null
  actualizadoEn: string | null
}

export interface ResultadoEmisionApi {
  referenciaExterna: string
  respuesta: unknown
}

/** Error de la API con el detalle que devolvió el servidor, para poder mostrarlo tal cual. */
export class ErrorFacturacion extends Error {
  readonly status: number
  readonly detalle: unknown
  /** true cuando la emisión quedó en estado desconocido y volver a mandarla es seguro: el payload
   * lleva `referencia_externa`, así que la API devuelve el comprobante ya registrado. */
  readonly reintentable: boolean

  constructor(mensaje: string, status: number, detalle?: unknown, reintentable = false) {
    super(mensaje)
    this.name = 'ErrorFacturacion'
    this.status = status
    this.detalle = detalle
    this.reintentable = reintentable
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const usuario = auth?.currentUser
  if (!usuario) throw new ErrorFacturacion('Tenés que iniciar sesión.', 401)

  const idToken = await usuario.getIdToken()

  const respuesta = await fetch(ruta, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  })

  let cuerpo: Record<string, unknown> | null = null
  try {
    cuerpo = (await respuesta.json()) as Record<string, unknown>
  } catch {
    cuerpo = null
  }

  if (!respuesta.ok) {
    throw new ErrorFacturacion(
      typeof cuerpo?.error === 'string' ? cuerpo.error : 'No se pudo completar la operación.',
      respuesta.status,
      cuerpo?.detalle,
      cuerpo?.reintentable === true,
    )
  }

  return cuerpo as T
}

export function consultarTokenFiscal(): Promise<EstadoTokenFiscal> {
  return pedir<EstadoTokenFiscal>('/api/guardar-token-fiscal')
}

export function guardarTokenFiscal(token: string, ambiente: AmbienteFiscal): Promise<EstadoTokenFiscal> {
  return pedir<EstadoTokenFiscal>('/api/guardar-token-fiscal', {
    method: 'POST',
    body: JSON.stringify({ token, ambiente }),
  })
}

export function revocarTokenFiscal(): Promise<EstadoTokenFiscal> {
  return pedir<EstadoTokenFiscal>('/api/guardar-token-fiscal', { method: 'DELETE' })
}

export function emitirComprobante(payload: PayloadComprobante): Promise<ResultadoEmisionApi> {
  return pedir<ResultadoEmisionApi>('/api/emitir-comprobante', {
    method: 'POST',
    body: JSON.stringify({ payload }),
  })
}
