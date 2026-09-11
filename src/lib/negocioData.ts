import type { CuentaBancaria, Deuda, Factura } from './cfo'

export interface NegocioData {
  ingresos: number
  meses: number
  montos: Record<string, number>
  cuentas: CuentaBancaria[]
  deudas: Deuda[]
  real: Record<string, number>
  facturas: Factura[]
  tasaCrecimiento: number
}

const STORAGE_KEY = 'compara-prestamos.negocio-empresa'

export function cargarNegocioData(): Partial<NegocioData> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

export function guardarNegocioData(data: NegocioData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage no disponible (modo privado, etc.) — se ignora silenciosamente
  }
}

/** Borra la copia local — se usa al cerrar sesión, para que el próximo usuario en este
 * mismo navegador no vea (ni un instante) los datos del anterior mientras carga Firestore. */
export function borrarNegocioDataLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // se ignora
  }
}
