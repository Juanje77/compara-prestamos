import { useRef, useState } from 'react'
import { AlertTriangle, Camera, Check, RotateCcw } from 'lucide-react'
import type { Factura, TipoComprobante } from '../lib/cfo'
import { consultarCuit, leerFactura } from '../lib/facturacionApi'
import {
  MOTIVO_REVISION_LABEL,
  cuitValido,
  formatearCuit,
  normalizarLecturaDelModelo,
  numeroComprobante,
  revisarFacturaLeida,
  type FacturaLeida,
} from '../lib/lecturaFactura'
import { formatoMoneda } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { Card } from './Card'
import { Button } from './Button'

// Leer una factura de compra de una foto y cargarla como comprobante recibido.
//
// El modelo transcribe, pero acá nada se guarda sin pasar por revisarFacturaLeida: si algo no
// cierra, los campos quedan editables con el motivo a la vista y el usuario confirma. Una compra
// mal cargada ensucia el IVA, el margen y el control del 80% del monotributo, y se descubre tres
// meses después — así que el default es desconfiar.

interface Props {
  /** Las ya cargadas, para no duplicar una factura que se fotografió dos veces. */
  facturas: Factura[]
  onAgregar: (factura: Omit<Factura, 'id'>) => void
}

type Estado = 'vacio' | 'leyendo' | 'revisando'

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Ya está cargada si coincide el proveedor, el número y la fecha: los tres a la vez. */
function yaEstaCargada(facturas: Factura[], leida: FacturaLeida, numero?: string): boolean {
  if (!numero || !leida.fecha) return false
  return facturas.some((f) => f.tipo === 'recibida' && f.numero === numero && f.fecha === leida.fecha)
}

async function aBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  let binario = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i])
  return btoa(binario)
}

export function LectorFacturas({ facturas, onAgregar }: Props) {
  const [estado, setEstado] = useState<Estado>('vacio')
  const [error, setError] = useState<string | null>(null)
  const [cargada, setCargada] = useState<string | null>(null)
  const [leida, setLeida] = useState<FacturaLeida>({})
  const [cuitVerificado, setCuitVerificado] = useState(false)
  const inputArchivo = useRef<HTMLInputElement>(null)

  const campo = { borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }
  const numero = numeroComprobante(leida.puntoVenta, leida.numero)
  const revision = revisarFacturaLeida(leida, {
    cuitVerificado,
    duplicada: yaEstaCargada(facturas, leida, numero),
  })

  function reiniciar() {
    setEstado('vacio')
    setLeida({})
    setCuitVerificado(false)
    setError(null)
    if (inputArchivo.current) inputArchivo.current.value = ''
  }

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setCargada(null)
    setEstado('leyendo')
    try {
      const { lectura } = await leerFactura(await aBase64(file), file.type)
      const normalizada = normalizarLecturaDelModelo(lectura)
      setLeida(normalizada)
      // El CUIT contra el padrón es lo que convierte "el modelo cree" en "ARCA confirma". Si la
      // consulta falla, no se da por verificado y la factura va a revisión, que es lo correcto.
      if (normalizada.cuitEmisor && cuitValido(normalizada.cuitEmisor)) {
        try {
          const { contribuyente } = await consultarCuit(normalizada.cuitEmisor)
          if (contribuyente) {
            setCuitVerificado(true)
            const razon = (contribuyente as { razon_social?: string }).razon_social
            if (razon) setLeida((prev) => ({ ...prev, razonSocialEmisor: razon }))
          }
        } catch {
          // Queda sin verificar: lo dice la revisión.
        }
      }
      setEstado('revisando')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
      setEstado('vacio')
    } finally {
      if (inputArchivo.current) inputArchivo.current.value = ''
    }
  }

  function cambiar(cambios: Partial<FacturaLeida>) {
    setLeida((prev) => {
      const siguiente = { ...prev, ...cambios }
      // Tocar el CUIT invalida la verificación anterior: ya no es el que confirmó ARCA.
      if ('cuitEmisor' in cambios) setCuitVerificado(false)
      return siguiente
    })
  }

  function handleCargar() {
    if (leida.total === undefined || !leida.fecha) return
    onAgregar({
      tipo: 'recibida',
      tipoComprobante: leida.tipoComprobante ?? 'factura',
      contraparte: leida.razonSocialEmisor?.trim() || formatearCuit(leida.cuitEmisor ?? '') || 'Proveedor',
      monto: leida.total,
      iva: leida.iva,
      fecha: leida.fecha,
      fechaEstimadaCobroPago: leida.fecha,
      numero,
    })
    setCargada(`${leida.razonSocialEmisor ?? 'El comprobante'} por ${formatoMoneda(leida.total)}`)
    reiniciar()
  }

  return (
    <div className="space-y-6">
      <Card as="section">
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Leer una factura de compra
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Sacale una foto a la factura que te dio el proveedor y se carga sola en Comprobantes. Desde
          el celular se abre la cámara directo. Antes de guardar nada, se confirma el CUIT contra el
          padrón de ARCA y se revisa que las cuentas cierren: lo que no cierra te lo mostramos para
          que lo corrijas.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            <Camera size={14} aria-hidden="true" />
            {estado === 'leyendo' ? 'Leyendo…' : 'Sacar foto o subir archivo'}
            <input
              ref={inputArchivo}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleArchivo}
              className="hidden"
              disabled={estado === 'leyendo'}
            />
          </label>
          {estado === 'revisando' && (
            <button
              type="button"
              onClick={reiniciar}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <RotateCcw size={14} aria-hidden="true" /> Descartar
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--status-critical)' }}>
            {error}
          </p>
        )}
        {cargada && (
          <p className="mt-3 inline-flex items-start gap-1.5 text-sm" style={{ color: 'var(--status-good-text)' }}>
            <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Se cargó {cargada}. Mirala en
            Comprobantes.
          </p>
        )}
      </Card>

      {estado === 'revisando' && (
        <Card as="section">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Revisá lo que se leyó
            </h3>
            {revision.confiable ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--status-good-text)' }}
              >
                <Check size={12} aria-hidden="true" /> Confirmado contra ARCA
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--status-warning)' }}
              >
                <AlertTriangle size={12} aria-hidden="true" /> Revisar antes de cargar
              </span>
            )}
          </div>

          {!revision.confiable && (
            <ul className="mb-4 space-y-1">
              {revision.motivos.map((m) => (
                <li key={m} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  · {MOTIVO_REVISION_LABEL[m]}
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">CUIT del proveedor</span>
              <input
                type="text"
                value={leida.cuitEmisor ?? ''}
                onChange={(e) => cambiar({ cuitEmisor: e.target.value.replace(/\D/g, '') || undefined })}
                className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
            <label className="text-xs sm:col-span-2" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">Razón social</span>
              <input
                type="text"
                value={leida.razonSocialEmisor ?? ''}
                onChange={(e) => cambiar({ razonSocialEmisor: e.target.value || undefined })}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">Tipo</span>
              <select
                value={leida.tipoComprobante ?? 'factura'}
                onChange={(e) => cambiar({ tipoComprobante: e.target.value as TipoComprobante })}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              >
                <option value="factura">Factura</option>
                <option value="nota_credito">Nota de Crédito</option>
                <option value="nota_debito">Nota de Débito</option>
              </select>
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">Punto de venta</span>
              <input
                type="number"
                min={0}
                value={leida.puntoVenta ?? ''}
                onChange={(e) => cambiar({ puntoVenta: e.target.value ? Number(e.target.value) : undefined })}
                className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">Número</span>
              <input
                type="number"
                min={0}
                value={leida.numero ?? ''}
                onChange={(e) => cambiar({ numero: e.target.value ? Number(e.target.value) : undefined })}
                className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">Fecha</span>
              <input
                type="date"
                max={hoyISO()}
                value={leida.fecha ?? ''}
                onChange={(e) => cambiar({ fecha: e.target.value || undefined })}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">Neto</span>
              <InputMoneda
                value={leida.neto ?? 0}
                onChange={(v) => cambiar({ neto: v > 0 ? v : undefined })}
                className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">IVA</span>
              <InputMoneda
                value={leida.iva ?? 0}
                onChange={(v) => cambiar({ iva: v > 0 ? v : undefined })}
                className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="mb-1 block">Total</span>
              <InputMoneda
                value={leida.total ?? 0}
                onChange={(v) => cambiar({ total: v > 0 ? v : undefined })}
                className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
                style={campo}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variante="primario"
              onClick={handleCargar}
              disabled={leida.total === undefined || !leida.fecha}
            >
              Cargar en Comprobantes
            </Button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {revision.confiable
                ? 'Todo cierra: podés cargarlo tal cual.'
                : 'Corregí lo que haga falta y cargalo igual si está bien.'}
            </span>
          </div>
        </Card>
      )}
    </div>
  )
}
