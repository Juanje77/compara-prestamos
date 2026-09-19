import { useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import type { NegocioData } from '../lib/negocioData'
import { MAX_BACKUPS_AUTOMATICOS, type BackupAutomaticoEntry } from '../lib/userSync'
import { Card } from './Card'

// Backup del negocio: un volcado completo de NegocioData a un .json que el cliente guarda donde
// quiera y puede volver a cargar para restaurar todo tal cual estaba. Además de la descarga manual,
// mientras el negocio esté logueado FinCorp guarda solo un snapshot por día en Firestore (ver
// guardarBackupAutomaticoSiHaceFalta en userSync.ts) — acá se listan para bajarlos o restaurarlos
// sin depender de que el cliente se haya acordado de descargar uno a mano.

interface Props {
  datos: NegocioData
  onRestaurar: (datos: Partial<NegocioData>) => void
  /** Historial de backups automáticos diarios (más reciente primero ya no hace falta: se ordena
   * acá) — vacío si el negocio nunca estuvo logueado o todavía no pasó un día completo. */
  backupsAutomaticos: BackupAutomaticoEntry[]
  /** Trae el cuerpo completo de un backup automático puntual — se pide recién al tocar Descargar
   * o Restaurar en esa fila, no de entrada para todo el historial. */
  onObtenerBackupAutomatico: (id: string) => Promise<Partial<NegocioData> | null>
}

/** Si el archivo no trae ni esto, no es un backup de FinCorp (o está corrupto) — mejor cortar acá
 * que restaurar un negocio a medio vaciar. */
const CAMPOS_MINIMOS: (keyof NegocioData)[] = ['facturas', 'cuentas', 'movimientosTesoreria']

function slugNegocio(nombreNegocio: string): string {
  return nombreNegocio
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function descargarComoArchivo(datos: unknown, sufijo: string, nombreNegocio: string) {
  const slug = slugNegocio(nombreNegocio)
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fincorp-backup${slug ? `-${slug}` : ''}-${sufijo}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function fechaLegible(id: string): string {
  return new Date(`${id}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CONFIRMACION_RESTAURAR =
  'Esto reemplaza todos los datos actuales del negocio por los del backup. No se puede deshacer. ¿Confirmás?'

export function Backup({ datos, onRestaurar, backupsAutomaticos, onObtenerBackupAutomatico }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [restaurado, setRestaurado] = useState(false)
  /** Id del backup automático sobre el que hay una acción en curso (descargar o restaurar), para
   * deshabilitar solo los botones de esa fila y no todo el historial. */
  const [filaOcupada, setFilaOcupada] = useState<string | null>(null)

  function handleDescargar() {
    descargarComoArchivo(datos, new Date().toISOString().slice(0, 10), datos.nombreNegocio)
  }

  async function handleArchivoElegido(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    setError(null)
    setRestaurado(false)
    setRestaurando(true)
    try {
      const parsed = JSON.parse(await file.text())
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('El archivo no tiene el formato de un backup de FinCorp.')
      }
      if (!CAMPOS_MINIMOS.every((campo) => campo in parsed)) {
        throw new Error('El archivo no parece un backup de FinCorp: le faltan datos básicos.')
      }
      if (!window.confirm(CONFIRMACION_RESTAURAR)) return
      onRestaurar(parsed as Partial<NegocioData>)
      setRestaurado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setRestaurando(false)
      inputEl.value = ''
    }
  }

  async function handleDescargarAutomatico(id: string) {
    setError(null)
    setFilaOcupada(id)
    try {
      const data = await onObtenerBackupAutomatico(id)
      if (!data) throw new Error('No se pudo leer ese backup — puede haber un problema de conexión.')
      descargarComoArchivo(data, id, datos.nombreNegocio)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer ese backup.')
    } finally {
      setFilaOcupada(null)
    }
  }

  async function handleRestaurarAutomatico(id: string) {
    if (!window.confirm(CONFIRMACION_RESTAURAR)) return
    setError(null)
    setRestaurado(false)
    setFilaOcupada(id)
    try {
      const data = await onObtenerBackupAutomatico(id)
      if (!data) throw new Error('No se pudo leer ese backup — puede haber un problema de conexión.')
      onRestaurar(data)
      setRestaurado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer ese backup.')
    } finally {
      setFilaOcupada(null)
    }
  }

  const historial = [...backupsAutomaticos].sort((a, b) => b.id.localeCompare(a.id))

  return (
    <Card as="section">
      <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        Backup
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Descargá una copia completa de todo lo que cargaste en FinCorp —comprobantes, cuentas, cheques,
        sueldos, stock, tesorería, todo— en un único archivo. Es tuya: guardala donde quieras, y si
        algún día necesitás restaurar el negocio tal como estaba, la volvés a cargar acá mismo.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDescargar}
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
        >
          <Download size={14} aria-hidden="true" /> Descargar backup
        </button>

        <label
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <Upload size={14} aria-hidden="true" /> {restaurando ? 'Restaurando…' : 'Restaurar desde un backup'}
          <input
            type="file"
            accept=".json"
            onChange={handleArchivoElegido}
            className="hidden"
            disabled={restaurando}
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--status-critical)' }}>
          {error}
        </p>
      )}
      {restaurado && !error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--status-good-text)' }}>
          Backup restaurado. Navegá por el resto de las secciones para revisarlo.
        </p>
      )}

      <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Restaurar un backup reemplaza los datos actuales, no los combina — si tenías algo cargado que
        todavía no respaldaste, se pierde.
      </p>

      <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--gridline)' }}>
        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Backups automáticos
        </h3>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Mientras estés logueado, FinCorp guarda solo una copia por día (las últimas{' '}
          {MAX_BACKUPS_AUTOMATICOS}), sin que tengas que acordarte de nada.
        </p>

        {historial.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Todavía no hay ningún backup automático generado.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {historial.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="flex-1 capitalize" style={{ color: 'var(--text-primary)' }}>
                  {fechaLegible(b.id)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDescargarAutomatico(b.id)}
                  disabled={filaOcupada === b.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                  style={{ borderColor: 'var(--border)', color: 'var(--series-blue)' }}
                >
                  <Download size={12} aria-hidden="true" /> Descargar
                </button>
                <button
                  type="button"
                  onClick={() => handleRestaurarAutomatico(b.id)}
                  disabled={filaOcupada === b.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <RotateCcw size={12} aria-hidden="true" /> {filaOcupada === b.id ? 'Un momento…' : 'Restaurar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
