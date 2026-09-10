export type TipoMovimiento = 'cobro' | 'pago'

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  concepto: string
  monto: number
  fecha: string
  cumplido: boolean
}

const STORAGE_KEY = 'compara-prestamos.movimientos-semana'

function leerStorage(): Movimiento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function escribirStorage(movimientos: Movimiento[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movimientos))
  } catch {
    // localStorage no disponible (modo privado, etc.) — se ignora silenciosamente
  }
}

export function obtenerMovimientos(): Movimiento[] {
  return leerStorage().sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function agregarMovimiento(tipo: TipoMovimiento, concepto: string, monto: number, fecha: string): Movimiento {
  const nuevo: Movimiento = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo,
    concepto,
    monto,
    fecha,
    cumplido: false,
  }
  escribirStorage([...leerStorage(), nuevo])
  return nuevo
}

export function agregarMovimientos(tipo: TipoMovimiento, filas: { concepto: string; monto: number; fecha: string }[]) {
  const nuevos: Movimiento[] = filas.map((f) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo,
    concepto: f.concepto,
    monto: f.monto,
    fecha: f.fecha,
    cumplido: false,
  }))
  escribirStorage([...leerStorage(), ...nuevos])
  return nuevos
}

export function alternarCumplido(id: string) {
  escribirStorage(leerStorage().map((m) => (m.id === id ? { ...m, cumplido: !m.cumplido } : m)))
}

export function eliminarMovimiento(id: string) {
  escribirStorage(leerStorage().filter((m) => m.id !== id))
}

export function vaciarSemana() {
  escribirStorage([])
}
