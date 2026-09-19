import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import type { NegocioData } from '../lib/negocioData'
import { Card } from './Card'

// Backup manual del negocio: un volcado completo de NegocioData a un .json que el cliente guarda
// donde quiera, y que después puede volver a cargar acá mismo para restaurar todo tal cual estaba.
// No reemplaza el guardado automático (local + Firestore) — es una copia que el cliente controla.

interface Props {
  datos: NegocioData
  onRestaurar: (datos: Partial<NegocioData>) => void
}

/** Si el archivo no trae ni esto, no es un backup de FinCorp (o está corrupto) — mejor cortar acá
 * que restaurar un negocio a medio vaciar. */
const CAMPOS_MINIMOS: (keyof NegocioData)[] = ['facturas', 'cuentas', 'movimientosTesoreria']

function nombreArchivo(nombreNegocio: string): string {
  const slug = nombreNegocio
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const fecha = new Date().toISOString().slice(0, 10)
  return `fincorp-backup${slug ? `-${slug}` : ''}-${fecha}.json`
}

export function Backup({ datos, onRestaurar }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [restaurado, setRestaurado] = useState(false)

  function handleDescargar() {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo(datos.nombreNegocio)
    a.click()
    URL.revokeObjectURL(url)
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
      if (
        !window.confirm(
          'Esto reemplaza todos los datos actuales del negocio por los del backup. No se puede deshacer. ¿Confirmás?',
        )
      ) {
        return
      }
      onRestaurar(parsed as Partial<NegocioData>)
      setRestaurado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setRestaurando(false)
      inputEl.value = ''
    }
  }

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
    </Card>
  )
}
