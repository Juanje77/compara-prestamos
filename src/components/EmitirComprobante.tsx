import { useState } from 'react'
import {
  CONDICIONES_IVA_RECEPTOR,
  type DatosEmisorFiscal,
  type DatosReceptor,
  type DocumentoTipo,
  type Factura,
  type ResultadoEmision,
} from '../lib/cfo'
import {
  interpretarRespuestaEmision,
  letraSugerida,
  mapearFacturaAPayload,
  validarFacturaParaEmision,
} from '../lib/facturacionElectronica'
import { emitirComprobante, ErrorFacturacion } from '../lib/facturacionApi'

// Diálogo de emisión. Completa los datos fiscales del receptor —que la factura no tenía, porque
// hasta ahora alcanzaba con el nombre en texto libre— y manda el comprobante.
//
// La emisión es irreversible: una vez que ARCA otorga el CAE no hay vuelta atrás, se corrige con
// una nota de crédito. Por eso el botón muestra antes exactamente qué se va a emitir.

const DOCUMENTOS: { id: DocumentoTipo; nombre: string }[] = [
  { id: 'cuit', nombre: 'CUIT' },
  { id: 'cuil', nombre: 'CUIL' },
  { id: 'dni', nombre: 'DNI' },
  { id: 'sin_identificar', nombre: 'Sin identificar' },
]

const ETIQUETA: Record<Factura['tipoComprobante'], string> = {
  factura: 'factura',
  nota_credito: 'nota de crédito',
  nota_debito: 'nota de débito',
}

const RECEPTOR_VACIO: DatosReceptor = {
  documentoTipo: 'dni',
  documentoNumero: '',
  razonSocial: '',
  condicionIvaReceptorId: 5,
}

interface Props {
  factura: Factura
  /** Todos los comprobantes: una nota necesita encontrar el que corrige. */
  facturas: Factura[]
  emisor: DatosEmisorFiscal
  onEmitida: (id: string, receptor: DatosReceptor, emision: ResultadoEmision) => void
  onCerrar: () => void
}

export function EmitirComprobante({ factura, facturas, emisor, onEmitida, onCerrar }: Props) {
  const [receptor, setReceptor] = useState<DatosReceptor>(
    () => factura.receptor ?? { ...RECEPTOR_VACIO, razonSocial: factura.contraparte },
  )
  const [detalle, setDetalle] = useState(factura.detalle ?? '')
  const [emitiendo, setEmitiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reintentable, setReintentable] = useState(false)

  const candidata: Factura = { ...factura, receptor, detalle: detalle.trim() || undefined }
  const original = factura.comprobanteAsociadoId
    ? facturas.find((f) => f.id === factura.comprobanteAsociadoId)
    : undefined
  const opciones = { condicionEmisor: emisor.condicion, original, facturas }
  const problemas = validarFacturaParaEmision(candidata, opciones)
  const letra = letraSugerida(emisor.condicion, receptor).toUpperCase()

  async function handleEmitir() {
    setEmitiendo(true)
    setError(null)
    setReintentable(false)
    try {
      const payload = mapearFacturaAPayload(candidata, opciones)
      const resultado = await emitirComprobante(payload)
      const emision = interpretarRespuestaEmision(
        resultado.referenciaExterna,
        resultado.respuesta,
        new Date().toISOString(),
      )
      onEmitida(factura.id, receptor, emision)
      onCerrar()
    } catch (e) {
      if (e instanceof ErrorFacturacion) {
        setError(e.message)
        setReintentable(e.reintentable)
      } else {
        setError(e instanceof Error ? e.message : 'No se pudo emitir el comprobante.')
      }
    } finally {
      setEmitiendo(false)
    }
  }

  const campo = {
    borderColor: 'var(--border)',
    background: 'var(--surface-1)',
    color: 'var(--text-primary)',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border p-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Emitir {ETIQUETA[factura.tipoComprobante]} {letra}
        </h3>
        <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {factura.contraparte} · {new Date(`${factura.fecha}T00:00:00`).toLocaleDateString('es-AR')} ·{' '}
          {factura.monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
        </p>

        <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Datos fiscales del receptor
        </p>
        <div className="mb-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={receptor.documentoTipo}
              onChange={(e) => setReceptor({ ...receptor, documentoTipo: e.target.value as DocumentoTipo })}
              className="w-36 shrink-0 rounded-lg border px-2 py-1.5 text-sm"
              style={campo}
            >
              {DOCUMENTOS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Número de documento"
              value={receptor.documentoNumero}
              onChange={(e) => setReceptor({ ...receptor, documentoNumero: e.target.value })}
              disabled={receptor.documentoTipo === 'sin_identificar'}
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            />
          </div>
          <input
            type="text"
            placeholder="Razón social o nombre"
            value={receptor.razonSocial}
            onChange={(e) => setReceptor({ ...receptor, razonSocial: e.target.value })}
            className="w-full rounded-lg border px-3 py-1.5 text-sm"
            style={campo}
          />
          <select
            value={receptor.condicionIvaReceptorId}
            onChange={(e) =>
              setReceptor({
                ...receptor,
                condicionIvaReceptorId: Number(e.target.value) as DatosReceptor['condicionIvaReceptorId'],
              })
            }
            className="w-full rounded-lg border px-3 py-1.5 text-sm"
            style={campo}
          >
            {CONDICIONES_IVA_RECEPTOR.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Detalle de lo facturado (opcional)"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="w-full rounded-lg border px-3 py-1.5 text-sm"
            style={campo}
          />
        </div>

        {problemas.length > 0 && (
          <ul
            className="mb-3 space-y-1 rounded-lg border-l-2 py-2 pl-3"
            style={{ borderColor: 'var(--status-critical)' }}
          >
            {problemas.map((p) => (
              <li key={p} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div
            className="mb-3 rounded-lg border-l-2 py-2 pl-3"
            style={{ borderColor: 'var(--status-critical)' }}
          >
            <p className="text-xs" style={{ color: 'var(--status-critical)' }}>
              {error}
            </p>
            {reintentable && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Volvé a intentar: el pedido lleva una referencia única, así que si el comprobante ya
                quedó autorizado la API devuelve ése mismo en vez de emitir uno nuevo.
              </p>
            )}
          </div>
        )}

        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Emitir es irreversible: una vez otorgado el CAE, el comprobante sólo se corrige con una
          nota de crédito.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEmitir}
            disabled={emitiendo || problemas.length > 0}
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            style={{
              background: problemas.length === 0 ? 'var(--series-blue)' : 'var(--surface-2)',
              color: problemas.length === 0 ? '#fff' : 'var(--text-muted)',
            }}
          >
            {emitiendo ? 'Emitiendo…' : `Emitir ${ETIQUETA[factura.tipoComprobante]} ${letra}`}
          </button>
        </div>
      </div>
    </div>
  )
}
