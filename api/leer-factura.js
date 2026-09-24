// Lee una factura de compra a partir de una foto o un PDF, con un modelo con visión.
//
// El modelo solo transcribe: devuelve los campos tal como están impresos, y toda la interpretación
// (formatos, dígito verificador del CUIT, que las cuentas cierren) queda del lado del front, en
// src/lib/lecturaFactura.ts, que se testea sin red. Cuanto menos tenga que decidir el modelo,
// menos se equivoca y más fácil es saber por qué falló.
//
// La clave de la API vive solo acá, como el resto de las credenciales: nunca llega al navegador.
import { planHabilitaEmitir, refPlan, uidAutenticado } from './_auth.js'
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { dentroDelLimite, ipDe } from './_rateLimit.js'

const MODELO = 'claude-opus-5'
/** Tope de tamaño del archivo que se manda al modelo, en bytes. Una foto de celular entra de
 * sobra; más que esto es un PDF con veinte páginas que no es una factura sola. */
const MAX_BYTES = 8 * 1024 * 1024
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

const INSTRUCCIONES = `Sos un asistente que transcribe facturas de compra argentinas.

Devolvé SOLO un objeto JSON, sin texto alrededor y sin bloques de código, con estas claves:
- cuitEmisor: el CUIT de quien emitió la factura (el vendedor/proveedor), como aparece impreso.
- razonSocialEmisor: el nombre o razón social del emisor.
- tipoComprobante: "Factura", "Nota de Crédito" o "Nota de Débito".
- letra: la letra del comprobante (A, B, C, E o M).
- puntoVenta: el punto de venta, solo los dígitos.
- numero: el número de comprobante, solo los dígitos.
- fecha: la fecha de emisión, tal como está impresa.
- neto: el importe neto gravado.
- iva: el total de IVA. Si el comprobante no discrimina IVA, omitilo.
- total: el importe total.
- cae: el CAE o CAEA.

Reglas:
- Copiá los valores tal como están impresos, sin convertir formatos ni recalcular nada.
- Si un dato no se lee con seguridad, omití esa clave. Nunca la inventes ni la estimes.
- El emisor es el proveedor, no el receptor: no confundas los dos CUIT que aparecen.`

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'La lectura de facturas no está configurada en el servidor todavía.' })
    return
  }

  const uid = await uidAutenticado(req)
  if (!uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  // Cada lectura cuesta plata, así que se limita por usuario además de por IP.
  if (!dentroDelLimite(`leer-factura:${uid}`, { maximo: 40, ventanaMs: 60 * 60 * 1000 })) {
    res.status(429).json({ error: 'Llegaste al límite de lecturas por hora. Probá más tarde.' })
    return
  }
  if (!dentroDelLimite(`leer-factura-ip:${ipDe(req)}`, { maximo: 60, ventanaMs: 60 * 60 * 1000 })) {
    res.status(429).json({ error: 'Demasiadas lecturas desde esta conexión. Probá más tarde.' })
    return
  }

  const { archivoBase64, tipoArchivo } = req.body ?? {}
  if (typeof archivoBase64 !== 'string' || !archivoBase64) {
    res.status(400).json({ error: 'Falta el archivo a leer.' })
    return
  }
  if (!TIPOS_ACEPTADOS.includes(tipoArchivo)) {
    res.status(400).json({ error: 'El archivo tiene que ser una imagen (JPG, PNG, WEBP) o un PDF.' })
    return
  }
  // base64 ocupa ~4/3 de lo que pesa el archivo original.
  if ((archivoBase64.length * 3) / 4 > MAX_BYTES) {
    res.status(413).json({ error: 'El archivo es muy grande. Sacá la foto con menos resolución o recortala.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const planSnap = await refPlan(db, uid).get()
    if (!planHabilitaEmitir(planSnap.data())) {
      res.status(403).json({ error: 'Tu plan no incluye la lectura de facturas.' })
      return
    }
  } catch {
    res.status(500).json({ error: 'No se pudo verificar tu plan.' })
    return
  }

  const contenido =
    tipoArchivo === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: tipoArchivo, data: archivoBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: tipoArchivo, data: archivoBase64 } }

  let respuesta
  try {
    respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 1024,
        system: INSTRUCCIONES,
        messages: [{ role: 'user', content: [contenido, { type: 'text', text: 'Transcribí esta factura.' }] }],
      }),
    })
  } catch {
    res.status(502).json({ error: 'No se pudo contactar al servicio de lectura.' })
    return
  }

  if (!respuesta.ok) {
    res.status(502).json({ error: 'El servicio de lectura rechazó la consulta.' })
    return
  }

  const datos = await respuesta.json()
  const texto = (datos?.content ?? []).find((b) => b.type === 'text')?.text ?? ''
  // El modelo puede envolver el JSON en un bloque de código aunque se le pida que no: se recorta
  // desde la primera llave hasta la última en vez de fallar por eso.
  const desde = texto.indexOf('{')
  const hasta = texto.lastIndexOf('}')
  if (desde === -1 || hasta <= desde) {
    res.status(422).json({ error: 'No se pudo leer la factura de esa imagen.' })
    return
  }

  try {
    res.status(200).json({ lectura: JSON.parse(texto.slice(desde, hasta + 1)) })
  } catch {
    res.status(422).json({ error: 'No se pudo leer la factura de esa imagen.' })
  }
}
