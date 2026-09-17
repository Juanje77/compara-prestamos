// Cliente de los endpoints propios de facturación.
//
// El token de la API fiscal es de FinCorp y vive en el servidor: el navegador no lo ve ni puede
// pedirlo. Desde acá se piden acciones —dar de alta un CUIT, consultar el padrón, emitir— y el
// backend decide con qué credencial y con qué emisor las ejecuta.
import { auth } from './firebase'
import type { PayloadComprobante } from './facturacionElectronica'

/** Lo que devuelve el alta del CUIT ante la API fiscal. */
export interface EmisorFiscal {
  emisor_id: number
  cuit: string
  razon_social: string
  condicion_iva?: string | null
  estado_emisor: string
  estado_configuracion: string
  situacion_arca: string
}

/** Datos del receptor tal como los normaliza el padrón de ARCA. */
export interface ClienteSugerido {
  documento_tipo: string
  documento_numero: string
  razon_social: string
  condicion_iva_receptor_id: number
  direccion?: string
  localidad?: string
  provincia?: string
}

export interface Contribuyente {
  cuit: string
  razon_social: string
  condicion_iva?: string
  estado_clave?: string
  cliente_sugerido?: ClienteSugerido
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

/** Da de alta el CUIT del cliente como emisor. Idempotente del lado de la API: repetirlo con el
 * mismo CUIT devuelve el emisor que ya existe. */
export function darDeAltaEmisor(cuit: string, razonSocial?: string): Promise<{ emisor: EmisorFiscal | null }> {
  return pedir('/api/alta-emisor', { method: 'POST', body: JSON.stringify({ cuit, razonSocial }) })
}

/** Datos fiscales de un CUIT, para completar el receptor de una factura sin tipearlos. */
export function consultarCuit(cuit: string): Promise<{ contribuyente: Contribuyente | null }> {
  return pedir(`/api/consultar-cuit?cuit=${encodeURIComponent(cuit.replace(/\D/g, ''))}`)
}

export function emitirComprobante(payload: PayloadComprobante): Promise<ResultadoEmisionApi> {
  return pedir<ResultadoEmisionApi>('/api/emitir-comprobante', {
    method: 'POST',
    body: JSON.stringify({ payload }),
  })
}
