// Backup a Google Drive: una copia del negocio en el Drive del propio cliente, fuera de FinCorp.
//
// Por qué afuera: los backups automáticos viven en la misma base que los datos, así que cubren un
// error de la app o un borrado, pero no un problema con la cuenta. Una copia en el Drive del
// cliente es independiente de todo esto y la puede abrir aunque FinCorp no exista más.
//
// Permiso pedido: drive.file, el más acotado que hay — da acceso únicamente a los archivos que
// crea esta app, no al resto del Drive. FinCorp no puede leer nada más aunque quisiera.
//
// El access token NO se guarda: vive en memoria y se pide de nuevo cuando vence, igual que el
// token de emisión de facturas. Lo único que queda guardado es un sí/no de "este cliente conectó
// Drive", para poder reconectar sin molestarlo.

import { slugNegocio } from './negocioData'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CARPETA = 'FinCorp backups'
const MIME_CARPETA = 'application/vnd.google-apps.folder'
const CLAVE_CONECTADO = 'compara-prestamos.drive-conectado'

/** Cuántas copias se conservan en la carpeta de Drive antes de empezar a borrar las más viejas. */
export const MAX_BACKUPS_DRIVE = 30

export interface ArchivoDrive {
  id: string
  nombre: string
  creadoEn: string
}

// --- Lógica pura (la parte que se puede testear sin red ni Google) ----------------------------

/** El nombre lleva la fecha adelante para que Drive los ordene solo y se lea de un vistazo cuál es
 * cuál. Es el mismo criterio con el que después se decide qué borrar y si ya hay copia de hoy. */
export function nombreArchivoBackup(nombreNegocio: string, fecha: string): string {
  const s = slugNegocio(nombreNegocio)
  return `${fecha}-fincorp${s ? `-${s}` : ''}.json`
}

/** La fecha que lleva el nombre de un backup, o null si el archivo no sigue ese formato. */
export function fechaDeArchivo(nombre: string): string | null {
  const m = nombre.match(/^(\d{4}-\d{2}-\d{2})-fincorp/)
  return m ? m[1] : null
}

/** Si todavía no hay una copia del día en Drive. Una por día alcanza: para volver atrás unas horas
 * está el historial de la nube, esto es la red de más afuera. */
export function faltaBackupDelDia(archivos: ArchivoDrive[], hoy: string): boolean {
  return !archivos.some((a) => fechaDeArchivo(a.nombre) === hoy)
}

/** Cuáles sobran una vez guardada la copia nueva: las más viejas por fecha. Los archivos con un
 * nombre que no se entiende quedan siempre, porque no hay forma de saber qué son. */
export function backupsAEliminar(archivos: ArchivoDrive[], max = MAX_BACKUPS_DRIVE): ArchivoDrive[] {
  const fechados = archivos
    .filter((a) => fechaDeArchivo(a.nombre) !== null)
    .sort((a, b) => (fechaDeArchivo(a.nombre) ?? '').localeCompare(fechaDeArchivo(b.nombre) ?? ''))
  const excedente = fechados.length - max
  return excedente > 0 ? fechados.slice(0, excedente) : []
}

/** El cuerpo de un upload multipart de Drive: primero el metadata, después el contenido. */
export function cuerpoMultipart(metadata: unknown, contenido: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    contenido,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

// --- Conexión con Google ----------------------------------------------------------------------

interface TokenClient {
  requestAccessToken: (opciones?: { prompt?: string }) => void
  callback: (respuesta: { access_token?: string; error?: string }) => void
}

type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (respuesta: { access_token?: string; error?: string }) => void
      }) => TokenClient
      revoke: (token: string, done: () => void) => void
    }
  }
}

function clientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
}

/** Si la integración está configurada en este deploy. Sin client id, la sección ni se muestra. */
export function driveDisponible(): boolean {
  return !!clientId()
}

export function driveConectadoAlgunaVez(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONECTADO) === 'si'
  } catch {
    return false
  }
}

function recordarConexion(conectado: boolean) {
  try {
    if (conectado) localStorage.setItem(CLAVE_CONECTADO, 'si')
    else localStorage.removeItem(CLAVE_CONECTADO)
  } catch {
    // localStorage no disponible — se puede seguir usando Drive, solo que hay que reconectar a mano.
  }
}

let scriptCargado: Promise<GoogleGlobal> | null = null

function cargarGis(): Promise<GoogleGlobal> {
  if (!scriptCargado) {
    scriptCargado = new Promise((resolver, rechazar) => {
      const ya = (window as unknown as { google?: GoogleGlobal }).google
      if (ya?.accounts?.oauth2) return resolver(ya)
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => {
        const g = (window as unknown as { google?: GoogleGlobal }).google
        if (g?.accounts?.oauth2) resolver(g)
        else rechazar(new Error('No se pudo cargar la conexión con Google.'))
      }
      script.onerror = () => rechazar(new Error('No se pudo cargar la conexión con Google.'))
      document.head.appendChild(script)
    })
  }
  return scriptCargado
}

/** El token vive solo en memoria — es una credencial, no va a localStorage. */
let token: { valor: string; venceEn: number } | null = null

function tokenVigente(): string | null {
  // Un minuto de margen: no vale la pena arrancar una subida con un token a punto de vencer.
  return token && token.venceEn - 60_000 > Date.now() ? token.valor : null
}

/**
 * Consigue un access token. Con `silencioso` no muestra nada al cliente: sirve para reconectar al
 * abrir la app si ya había dado permiso antes, y si Google pide interacción, falla sin molestar.
 * Sin `silencioso` abre la ventana de Google (tiene que salir de un click del cliente).
 */
async function conseguirToken(silencioso: boolean): Promise<string> {
  const vigente = tokenVigente()
  if (vigente) return vigente

  const id = clientId()
  if (!id) throw new Error('La integración con Google Drive no está configurada en este servidor.')

  const google = await cargarGis()
  return new Promise<string>((resolver, rechazar) => {
    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (respuesta) => {
        if (!respuesta.access_token) {
          rechazar(new Error(respuesta.error ?? 'Google no devolvió el permiso.'))
          return
        }
        // GIS entrega tokens de una hora y no informa el vencimiento en este flujo.
        token = { valor: respuesta.access_token, venceEn: Date.now() + 55 * 60_000 }
        recordarConexion(true)
        resolver(respuesta.access_token)
      },
    })
    cliente.requestAccessToken({ prompt: silencioso ? '' : 'consent' })
  })
}

export async function conectarDrive(): Promise<void> {
  await conseguirToken(false)
}

/** Corta la conexión de este navegador. No borra lo que ya está guardado en el Drive del cliente. */
export function desconectarDrive(): void {
  token = null
  recordarConexion(false)
}

// --- Llamadas a la API de Drive -----------------------------------------------------------------

async function pedir(url: string, token: string, opciones: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...opciones,
    headers: { ...opciones.headers, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Google Drive rechazó la operación (${res.status}).`)
  }
  return res
}

async function idDeLaCarpeta(token: string): Promise<string> {
  const q = encodeURIComponent(`name='${CARPETA}' and mimeType='${MIME_CARPETA}' and trashed=false`)
  const res = await pedir(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, token)
  const { files } = (await res.json()) as { files: { id: string }[] }
  if (files.length > 0) return files[0].id

  const creada = await pedir('https://www.googleapis.com/drive/v3/files?fields=id', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: CARPETA, mimeType: MIME_CARPETA }),
  })
  return ((await creada.json()) as { id: string }).id
}

async function listarConToken(token: string): Promise<ArchivoDrive[]> {
  const carpeta = await idDeLaCarpeta(token)
  const q = encodeURIComponent(`'${carpeta}' in parents and trashed=false`)
  const res = await pedir(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&orderBy=name desc`,
    token,
  )
  const { files } = (await res.json()) as { files: { id: string; name: string; createdTime: string }[] }
  return files.map((f) => ({ id: f.id, nombre: f.name, creadoEn: f.createdTime }))
}

/** Las copias que hay hoy en la carpeta de FinCorp del Drive del cliente, de la más nueva a la más vieja. */
export async function listarBackupsDrive(): Promise<ArchivoDrive[]> {
  return listarConToken(await conseguirToken(true))
}

/**
 * Sube una copia del negocio. Si ya hay una del mismo día la reemplaza, así no se llena de
 * archivos, y borra las más viejas cuando pasan de MAX_BACKUPS_DRIVE.
 */
export async function guardarBackupEnDrive(
  datos: unknown,
  nombreNegocio: string,
  { silencioso = false }: { silencioso?: boolean } = {},
): Promise<ArchivoDrive> {
  const token = await conseguirToken(silencioso)
  const carpeta = await idDeLaCarpeta(token)
  const existentes = await listarConToken(token)

  const hoy = new Date().toISOString().slice(0, 10)
  const nombre = nombreArchivoBackup(nombreNegocio, hoy)
  const delDia = existentes.find((a) => fechaDeArchivo(a.nombre) === hoy)

  const boundary = `fincorp-${Date.now()}`
  const metadata = delDia ? { name: nombre } : { name: nombre, parents: [carpeta] }
  const cuerpo = cuerpoMultipart(metadata, JSON.stringify(datos, null, 2), boundary)

  const url = delDia
    ? `https://www.googleapis.com/upload/drive/v3/files/${delDia.id}?uploadType=multipart&fields=id,name,createdTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime'

  const res = await pedir(url, token, {
    method: delDia ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: cuerpo,
  })
  const json = (await res.json()) as { id: string; name: string; createdTime: string }
  const subido: ArchivoDrive = { id: json.id, nombre: json.name, creadoEn: json.createdTime }

  // Limpieza de los viejos: si falla, el backup igual quedó guardado, que es lo que importa.
  try {
    const quedan = [...existentes.filter((a) => a.id !== subido.id), subido]
    for (const sobrante of backupsAEliminar(quedan)) {
      await pedir(`https://www.googleapis.com/drive/v3/files/${sobrante.id}`, token, { method: 'DELETE' })
    }
  } catch {
    // Ver comentario de arriba.
  }

  return subido
}

/** Trae el contenido de una copia para restaurarla. */
export async function leerBackupDeDrive(id: string): Promise<unknown> {
  const token = await conseguirToken(true)
  const res = await pedir(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, token)
  return res.json()
}

/**
 * Sube la copia del día si todavía no está, sin molestar al cliente: si Google pide volver a dar
 * permiso, no hace nada y se espera al próximo intento (o al botón manual). Devuelve si subió algo.
 */
export async function guardarBackupDiarioEnDrive(datos: unknown, nombreNegocio: string): Promise<boolean> {
  if (!driveDisponible() || !driveConectadoAlgunaVez()) return false
  try {
    const existentes = await listarBackupsDrive()
    if (!faltaBackupDelDia(existentes, new Date().toISOString().slice(0, 10))) return false
    await guardarBackupEnDrive(datos, nombreNegocio, { silencioso: true })
    return true
  } catch {
    return false
  }
}
