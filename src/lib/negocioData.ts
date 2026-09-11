import type { CuentaBancaria, Deuda } from './cfo'

export interface NegocioData {
  ingresos: number
  meses: number
  montos: Record<string, number>
  cuentas: CuentaBancaria[]
  deudas: Deuda[]
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
