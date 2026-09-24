import { useCallback, useEffect, useState } from 'react'
import { CloudUpload, Download, HardDriveDownload, RotateCcw, Save, Upload } from 'lucide-react'
import { slugNegocio, type NegocioData } from '../lib/negocioData'
import { MAX_BACKUPS_AUTOMATICOS, type BackupAutomaticoEntry } from '../lib/userSync'
import {
  MAX_BACKUPS_DRIVE,
  conectarDrive,
  desconectarDrive,
  driveConectadoAlgunaVez,
  driveDisponible,
  guardarBackupEnDrive,
  leerBackupDeDrive,
  listarBackupsDrive,
  type ArchivoDrive,
} from '../lib/googleDrive'
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
  /** Guarda una copia en la nube en este momento. Sin esto (negocio sin login) el botón no se
   * muestra: no habría dónde guardarla. */
  onGuardarAhora?: () => Promise<void>
}

/** Si el archivo no trae ni esto, no es un backup de FinCorp (o está corrupto) — mejor cortar acá
 * que restaurar un negocio a medio vaciar. */
const CAMPOS_MINIMOS: (keyof NegocioData)[] = ['facturas', 'cuentas', 'movimientosTesoreria']

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

/** Los automáticos son de un día (2026-09-24); los pedidos a mano traen la hora
 * (2026-09-24T14-30), y ahí se muestra, que es lo que los distingue entre sí. */
function fechaLegible(id: string): string {
  const [dia, hora] = id.split('T')
  const fecha = new Date(`${dia}T${hora ? hora.replace('-', ':') : '00:00'}:00`)
  const texto = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!hora) return texto
  return `${texto}, ${fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
}

const CONFIRMACION_RESTAURAR =
  'Esto reemplaza todos los datos actuales del negocio por los del backup. No se puede deshacer. ¿Confirmás?'

export function Backup({ datos, onRestaurar, backupsAutomaticos, onObtenerBackupAutomatico, onGuardarAhora }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [restaurado, setRestaurado] = useState(false)
  /** Id del backup automático sobre el que hay una acción en curso (descargar o restaurar), para
   * deshabilitar solo los botones de esa fila y no todo el historial. */
  const [filaOcupada, setFilaOcupada] = useState<string | null>(null)
  const [guardandoAhora, setGuardandoAhora] = useState(false)
  const [guardado, setGuardado] = useState(false)

  async function handleGuardarAhora() {
    if (!onGuardarAhora) return
    setError(null)
    setGuardado(false)
    setGuardandoAhora(true)
    try {
      await onGuardarAhora()
      setGuardado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la copia.')
    } finally {
      setGuardandoAhora(false)
    }
  }

  // --- Google Drive ---
  const [driveConectado, setDriveConectado] = useState(driveConectadoAlgunaVez)
  const [backupsDrive, setBackupsDrive] = useState<ArchivoDrive[] | null>(null)
  const [driveOcupado, setDriveOcupado] = useState(false)
  const [errorDrive, setErrorDrive] = useState<string | null>(null)

  const refrescarDrive = useCallback(async () => {
    try {
      setBackupsDrive(await listarBackupsDrive())
      setErrorDrive(null)
    } catch {
      // Lo más común es que el permiso de Google haya vencido: se pide de nuevo al usar un botón.
      setBackupsDrive(null)
    }
  }, [])

  useEffect(() => {
    if (driveDisponible() && driveConectado) void refrescarDrive()
  }, [driveConectado, refrescarDrive])

  async function conDrive(accion: () => Promise<void>) {
    setErrorDrive(null)
    setDriveOcupado(true)
    try {
      await accion()
    } catch (err) {
      setErrorDrive(err instanceof Error ? err.message : 'No se pudo hablar con Google Drive.')
    } finally {
      setDriveOcupado(false)
    }
  }

  const handleConectarDrive = () =>
    conDrive(async () => {
      await conectarDrive()
      setDriveConectado(true)
      await refrescarDrive()
    })

  const handleGuardarEnDrive = () =>
    conDrive(async () => {
      await guardarBackupEnDrive(datos, datos.nombreNegocio)
      setDriveConectado(true)
      await refrescarDrive()
    })

  function handleDesconectarDrive() {
    desconectarDrive()
    setDriveConectado(false)
    setBackupsDrive(null)
    setErrorDrive(null)
  }

  const handleRestaurarDeDrive = (archivo: ArchivoDrive) =>
    conDrive(async () => {
      if (!window.confirm(CONFIRMACION_RESTAURAR)) return
      const contenido = await leerBackupDeDrive(archivo.id)
      if (typeof contenido !== 'object' || contenido === null || Array.isArray(contenido)) {
        throw new Error('Ese archivo de Drive no tiene el formato de un backup de FinCorp.')
      }
      if (!CAMPOS_MINIMOS.every((campo) => campo in contenido)) {
        throw new Error('Ese archivo de Drive no parece un backup de FinCorp: le faltan datos básicos.')
      }
      onRestaurar(contenido as Partial<NegocioData>)
      setRestaurado(true)
    })

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

      {driveDisponible() && (
        <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--gridline)' }}>
          <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Copia en tu Google Drive
          </h3>
          <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Una copia diaria en tu propio Drive, en la carpeta "FinCorp backups". Queda afuera de
            FinCorp: la abrís vos aunque no puedas entrar acá. Se conservan las últimas{' '}
            {MAX_BACKUPS_DRIVE}. FinCorp pide el permiso más acotado que da Google, que es ver y
            tocar únicamente los archivos que crea esta app — no puede leer nada más de tu Drive.
          </p>

          <div className="flex flex-wrap gap-3">
            {!driveConectado ? (
              <button
                type="button"
                onClick={handleConectarDrive}
                disabled={driveOcupado}
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium disabled:opacity-60"
                style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
              >
                <CloudUpload size={14} aria-hidden="true" />
                {driveOcupado ? 'Conectando…' : 'Conectar con Google Drive'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGuardarEnDrive}
                  disabled={driveOcupado}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium disabled:opacity-60"
                  style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
                >
                  <CloudUpload size={14} aria-hidden="true" />
                  {driveOcupado ? 'Guardando…' : 'Guardar copia en Drive ahora'}
                </button>
                <button
                  type="button"
                  onClick={handleDesconectarDrive}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Desconectar
                </button>
              </>
            )}
          </div>

          {errorDrive && (
            <p className="mt-3 text-sm" style={{ color: 'var(--status-critical)' }}>
              {errorDrive}
            </p>
          )}

          {driveConectado && (
            <div className="mt-3">
              {backupsDrive === null ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Leyendo tu Drive… Si no aparece nada, tocá "Guardar copia en Drive ahora" para
                  volver a dar el permiso.
                </p>
              ) : backupsDrive.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Todavía no hay ninguna copia en tu Drive.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {backupsDrive.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                        {a.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestaurarDeDrive(a)}
                        disabled={driveOcupado}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      >
                        <HardDriveDownload size={12} aria-hidden="true" /> Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--gridline)' }}>
        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Backups automáticos
        </h3>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Mientras estés logueado, FinCorp guarda solo una copia por día (las últimas{' '}
          {MAX_BACKUPS_AUTOMATICOS}), sin que tengas que acordarte de nada. Y si estás por hacer un
          cambio grande, guardá una ahora mismo con el botón.
        </p>

        {onGuardarAhora && (
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleGuardarAhora}
              disabled={guardandoAhora}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium disabled:opacity-60"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              <Save size={14} aria-hidden="true" /> {guardandoAhora ? 'Guardando…' : 'Guardar una copia ahora'}
            </button>
            {guardado && (
              <span className="text-xs" style={{ color: 'var(--status-good-text)' }}>
                Copia guardada. Queda en la lista de abajo.
              </span>
            )}
          </div>
        )}

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
                <span className="flex-1" style={{ color: 'var(--text-primary)' }}>
                  {fechaLegible(b.id)}
                  {b.manual && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      A mano
                    </span>
                  )}
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
