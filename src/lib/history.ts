import type { TipoPrestamo } from '../data/loans'
import type { OfertaCalculada } from './finance'

export interface SimulacionGuardada {
  id: string
  fecha: string
  tipo: TipoPrestamo
  monto: number
  plazo: number
  ofertas: OfertaCalculada[]
}

const STORAGE_KEY = 'compara-prestamos.historial'
const MAX_ENTRADAS = 20

function leerStorage(): SimulacionGuardada[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function escribirStorage(entradas: SimulacionGuardada[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entradas))
  } catch {
    // localStorage no disponible (modo privado, etc.) — se ignora silenciosamente
  }
}

export function obtenerHistorial(): SimulacionGuardada[] {
  return leerStorage().sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export function guardarSimulacion(
  tipo: TipoPrestamo,
  monto: number,
  plazo: number,
  ofertas: OfertaCalculada[],
): SimulacionGuardada {
  const entrada: SimulacionGuardada = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fecha: new Date().toISOString(),
    tipo,
    monto,
    plazo,
    ofertas,
  }
  const actuales = leerStorage()
  const actualizadas = [entrada, ...actuales].slice(0, MAX_ENTRADAS)
  escribirStorage(actualizadas)
  return entrada
}

export function eliminarSimulacion(id: string) {
  escribirStorage(leerStorage().filter((e) => e.id !== id))
}

export function limpiarHistorial() {
  escribirStorage([])
}
