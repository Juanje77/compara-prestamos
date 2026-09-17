import { beforeAll, describe, expect, it } from 'vitest'
import type { DatosReceptor, Factura } from './cfo'
import {
  interpretarRespuestaEmision,
  mapearFacturaAPayload,
  referenciaExternaDeFactura,
  type OpcionesEmision,
  type PayloadComprobante,
} from './facturacionElectronica'

// Prueba de integración contra la API fiscal real, en su ambiente de pruebas.
//
// No corre en `npm test`: se saltea sola si no hay token. Para correrla:
//
//   SISTEMAS360_TOKEN=<token de PRUEBAS> npm run test:api
//
// Lo que verifica no es la API del proveedor —eso ya lo hace él— sino que NUESTRO mapeo produzca
// algo que la API acepte, y que sepamos leer lo que devuelve. Por eso arma los payloads con
// `mapearFacturaAPayload` en vez de escribirlos a mano: si el mapeo se rompe, esto se entera.
//
// Usa la cabecera `X-S360-Escenario-Prueba` para provocar los casos raros —timeouts, rechazos,
// autorizaciones que quedan sin confirmar— que en el estudio de factibilidad figuraban como
// imposibles de ensayar antes de producción. Resulta que sí se pueden.

// El tsconfig de la app no incluye los tipos de Node, y no vale la pena agregarlos por esto: el
// resto del código corre en el navegador y tenerlos habilitaría usar APIs de Node por error.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

const TOKEN = env.SISTEMAS360_TOKEN
const BASE_URL = (env.SISTEMAS360_BASE_URL ?? 'https://api.sistemas360.ar').replace(/\/$/, '')
const EMISOR_ID = env.SISTEMAS360_EMISOR_ID

/** Sufijo único por corrida: las referencias externas son idempotentes dentro del emisor, así que
 * sin esto la segunda corrida devolvería los comprobantes de la primera. */
const CORRIDA = Date.now().toString(36)

type Escenario =
  | 'servicio_no_disponible'
  | 'pendiente_recuperable'
  | 'pendiente_persistente'
  | 'rechazo_fiscal'
  | 'rechazo_fecha'
  | 'rechazo_punto_venta'
  | 'rechazo_receptor'
  | 'rechazo_importes'
  | 'rechazo_asociado'
  | 'certificado_invalido'
  | 'numeracion_no_confirmada'
  | 'aprobado_con_observaciones'

interface Respuesta {
  status: number
  cuerpo: Record<string, unknown> & { data?: Record<string, unknown> }
}

async function llamar(ruta: string, opciones: RequestInit = {}): Promise<Respuesta> {
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers,
    },
  })

  let cuerpo = {}
  try {
    cuerpo = await respuesta.json()
  } catch {
    cuerpo = {}
  }

  return { status: respuesta.status, cuerpo }
}

function emitirPayload(payload: PayloadComprobante, escenario?: Escenario) {
  return llamar('/api/comprobantes', {
    method: 'POST',
    headers: escenario ? { 'X-S360-Escenario-Prueba': escenario } : {},
    body: JSON.stringify({ ...payload, ...(EMISOR_ID ? { emisor_id: Number(EMISOR_ID) } : {}) }),
  })
}

const CONSUMIDOR_FINAL: DatosReceptor = {
  documentoTipo: 'dni',
  documentoNumero: '30111222',
  razonSocial: 'Cliente de Prueba',
  condicionIvaReceptorId: 5,
}

const RI: OpcionesEmision = { condicionEmisor: 'responsable_inscripto' }

/** Una factura con fecha de hoy, para caer dentro de la ventana que admite ARCA. */
function factura(sufijo: string, extra: Partial<Factura> = {}): Factura {
  return {
    id: `${CORRIDA}-${sufijo}`,
    tipo: 'emitida',
    tipoComprobante: 'factura',
    contraparte: 'Cliente de Prueba',
    monto: 12100,
    iva: 2100,
    fecha: new Date().toISOString().slice(0, 10),
    detalle: 'Producto de prueba',
    receptor: CONSUMIDOR_FINAL,
    ...extra,
  }
}

describe.skipIf(!TOKEN)('API fiscal — ambiente de pruebas', () => {
  beforeAll(async () => {
    const { status, cuerpo } = await llamar('/api/ping')
    expect(status, 'el token no valida').toBe(200)

    const data = cuerpo.data as Record<string, unknown>

    // Freno duro: esto emite comprobantes. Contra un token de producción serían reales.
    expect(
      data?.entorno,
      'ABORTADO: el token es de PRODUCCIÓN. Esta prueba emite comprobantes y no debe correr contra él.',
    ).toBe('pruebas')

    if (data?.token_tipo === 'cuenta' && !EMISOR_ID) {
      throw new Error('El token es de cuenta: hace falta SISTEMAS360_EMISOR_ID para saber quién emite.')
    }
  })

  describe('camino feliz', () => {
    it('emite una factura B y devuelve un CAE que sabemos leer', async () => {
      const f = factura('b')
      const { status, cuerpo } = await emitirPayload(mapearFacturaAPayload(f, RI))

      expect([200, 201]).toContain(status)

      const emision = interpretarRespuestaEmision(referenciaExternaDeFactura(f), cuerpo, new Date().toISOString())

      expect(emision.estado).toBe('autorizado')
      expect(emision.cae).toBeTruthy()
      expect(emision.numeroComprobante).toBeGreaterThan(0)
      expect(emision.puntoVenta).toBeGreaterThan(0)
      expect(emision.pdfA4).toContain('/imprimir-a4')
    })

    it('emite una factura C sin mandar IVA, usando el perfil fiscal de pruebas', async () => {
      const f = factura('c', { iva: undefined })
      const payload = mapearFacturaAPayload(f, { condicionEmisor: 'monotributo' })

      // El contrato permite sobrescribir la condición del emisor sólo para este comprobante.
      const { status, cuerpo } = await emitirPayload({
        ...payload,
        perfil_fiscal_pruebas: { condicion_iva: 'monotributo' },
      })

      expect([200, 201], JSON.stringify(cuerpo)).toContain(status)
      expect(cuerpo.data?.tipo_comprobante).toBe('factura_c')
    })
  })

  describe('idempotencia', () => {
    it('repetir la misma referencia devuelve el mismo comprobante, no uno nuevo', async () => {
      const f = factura('idem')
      const payload = mapearFacturaAPayload(f, RI)

      const primera = await emitirPayload(payload)
      const segunda = await emitirPayload(payload)

      expect([200, 201]).toContain(primera.status)
      // El contrato dice que la repetición baja a 200 y devuelve el original.
      expect(segunda.status).toBe(200)
      expect(segunda.cuerpo.data?.id).toBe(primera.cuerpo.data?.id)
      expect(segunda.cuerpo.data?.numero_comprobante).toBe(primera.cuerpo.data?.numero_comprobante)
    })
  })

  describe('lo que no se podía ensayar antes de producción', () => {
    it('una autorización que queda sin confirmar se resuelve consultando, no emitiendo de nuevo', async () => {
      const f = factura('pend-rec')
      const emitida = await emitirPayload(mapearFacturaAPayload(f, RI), 'pendiente_recuperable')
      const id = emitida.cuerpo.data?.id

      expect(id, JSON.stringify(emitida.cuerpo)).toBeTruthy()

      const consulta = await llamar(`/api/comprobantes/${id}/reintentar`, { method: 'POST' })

      expect(consulta.status).toBe(200)
      expect(consulta.cuerpo.data?.id).toBe(id)
      // Se completó sin emitir otro comprobante: el id es el mismo.
      expect(consulta.cuerpo.data?.estado).not.toBe('pendiente_confirmacion')
    })

    it('una que no se confirma nunca devuelve 409, y sigue siendo un solo comprobante', async () => {
      const f = factura('pend-persis')
      const emitida = await emitirPayload(mapearFacturaAPayload(f, RI), 'pendiente_persistente')
      const id = emitida.cuerpo.data?.id

      const consulta = await llamar(`/api/comprobantes/${id}/reintentar`, { method: 'POST' })

      expect(consulta.status).toBe(409)
      expect(consulta.cuerpo.data?.id).toBe(id)
    })

    it('un rechazo fiscal no deja el comprobante autorizado', async () => {
      const f = factura('rechazo')
      const { cuerpo } = await emitirPayload(mapearFacturaAPayload(f, RI), 'rechazo_fiscal')

      const emision = interpretarRespuestaEmision(referenciaExternaDeFactura(f), cuerpo, new Date().toISOString())

      expect(emision.estado).not.toBe('autorizado')
      expect(emision.cae).toBeFalsy()
    })

    it('aprobado con observaciones sigue siendo autorizado', async () => {
      const f = factura('observado')
      const { cuerpo } = await emitirPayload(mapearFacturaAPayload(f, RI), 'aprobado_con_observaciones')

      const emision = interpretarRespuestaEmision(referenciaExternaDeFactura(f), cuerpo, new Date().toISOString())

      expect(emision.estado).toBe('autorizado')
      expect(emision.cae).toBeTruthy()
    })

    it('el servicio caído se distingue de un rechazo', async () => {
      const f = factura('caido')
      const { status } = await emitirPayload(mapearFacturaAPayload(f, RI), 'servicio_no_disponible')

      // 503 y 504 son "no sabemos"; 422 sería "está mal". La diferencia decide si se reintenta.
      expect([503, 504]).toContain(status)
    })
  })

  describe('notas de crédito', () => {
    it('se asocia al comprobante original por su id y la API la acepta', async () => {
      const original = factura('nc-original')
      const emitida = await emitirPayload(mapearFacturaAPayload(original, RI))
      const id = emitida.cuerpo.data?.id

      expect(id, JSON.stringify(emitida.cuerpo)).toBeTruthy()

      const conEmision: Factura = {
        ...original,
        emision: interpretarRespuestaEmision(
          referenciaExternaDeFactura(original),
          emitida.cuerpo,
          new Date().toISOString(),
        ),
      }

      const nota = factura('nc', {
        tipoComprobante: 'nota_credito',
        monto: 6050,
        iva: 1050,
        comprobanteAsociadoId: conEmision.id,
      })

      const payload = mapearFacturaAPayload(nota, { ...RI, original: conEmision, facturas: [conEmision] })

      expect(payload.comprobante_asociado_id).toBe(Number(id))
      expect(payload.tipo_comprobante).toBe('nota_credito_b')

      const { status, cuerpo } = await emitirPayload(payload)

      expect([200, 201], JSON.stringify(cuerpo)).toContain(status)
      expect(cuerpo.data?.comprobante_asociado_id).toBe(Number(id))
    })
  })

  describe('padrón', () => {
    it('devuelve los datos fiscales que hoy faltan en el modelo de factura', async () => {
      // CUIT de ARCA, que siempre existe en el padrón.
      const { status, cuerpo } = await llamar('/api/cuit/33693450239')

      expect(status).toBe(200)
      expect(cuerpo.data?.razon_social).toBeTruthy()
      expect(cuerpo.data?.condicion_iva_receptor_id).toBeGreaterThan(0)
    })
  })
})
