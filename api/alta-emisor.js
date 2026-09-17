// Da de alta el CUIT del cliente como emisor dentro de la cuenta de FinCorp.
//
// Un emisor no es una cuenta ni un usuario: es el registro de un contribuyente que factura. El
// cliente no se loguea en ningún lado ni ve esta llamada — completa su CUIT en la app y esto pasa
// por detrás. La API lo verifica contra el padrón de ARCA y devuelve el emisor_id, que después
// viaja en cada emisión para decir de quién es la factura.
import { obtenerFirestoreAdmin } from './_firebaseAdmin.js'
import { planHabilitaEmitir, refPlan, uidAutenticado } from './_auth.js'
import { llamarApiFiscal } from './_sistemas360.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' })
    return
  }

  const uid = await uidAutenticado(req)
  if (!uid) {
    res.status(401).json({ error: 'Sesión no válida.' })
    return
  }

  const cuit = String(req.body?.cuit ?? '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(cuit)) {
    res.status(400).json({ error: 'El CUIT tiene que tener 11 dígitos.' })
    return
  }

  try {
    const db = obtenerFirestoreAdmin()
    const planSnap = await refPlan(db, uid).get()

    if (!planHabilitaEmitir(planSnap.data())) {
      res.status(403).json({ error: 'La facturación electrónica es parte del plan Full.' })
      return
    }
  } catch {
    res.status(500).json({ error: 'No se pudo verificar el plan.' })
    return
  }

  const { status, cuerpo } = await llamarApiFiscal('/api/emisores', {
    method: 'POST',
    body: JSON.stringify({
      cuit,
      nombre_fantasia: typeof req.body?.razonSocial === 'string' ? req.body.razonSocial.slice(0, 255) : undefined,
    }),
  })

  if (status !== 201 && status !== 200) {
    res.status(status).json({
      error: 'No se pudo dar de alta el CUIT ante el servicio de facturación.',
      detalle: cuerpo,
    })
    return
  }

  res.status(200).json({ emisor: cuerpo?.data ?? null })
}
