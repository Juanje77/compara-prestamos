// Proxy sin estado hacia la API pública del BCRA (Central de Deudores).
// No se guarda ni se loggea el CUIT/CUIL consultado ni la respuesta en ningún lado:
// esta función solo reenvía la consulta y devuelve el resultado tal cual.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const cuit = String(req.query?.cuit || '').replace(/\D/g, '')

  if (!/^\d{11}$/.test(cuit)) {
    res.status(400).json({ error: 'CUIT/CUIL inválido. Debe tener 11 dígitos.' })
    return
  }

  try {
    const upstream = await fetch(`https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/${cuit}`, {
      headers: { Accept: 'application/json' },
    })

    if (upstream.status === 404) {
      res.status(200).json({ sinRegistros: true })
      return
    }

    if (!upstream.ok) {
      res.status(502).json({ error: `El servicio del BCRA respondió con un error (${upstream.status}).` })
      return
    }

    const data = await upstream.json()
    res.status(200).json(data)
  } catch {
    res.status(502).json({
      error: 'No se pudo contactar al servicio del BCRA en este momento. Intentá nuevamente en unos minutos.',
    })
  }
}
