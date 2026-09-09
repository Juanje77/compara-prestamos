import type { LoanOffer } from '../data/loans'

/** Cuota mensual fija por sistema francés de amortización. */
export function cuotaFrancesa(monto: number, tnaPct: number, plazoMeses: number): number {
  const i = tnaPct / 100 / 12
  if (i === 0) return monto / plazoMeses
  const factor = Math.pow(1 + i, plazoMeses)
  return (monto * i * factor) / (factor - 1)
}

export interface OfertaCalculada extends LoanOffer {
  cuotaMensual: number
  costoTotal: number
  interesTotal: number
  dentroDeRango: boolean
}

export function calcularOferta(oferta: LoanOffer, monto: number, plazoMeses: number): OfertaCalculada {
  const cuotaMensual = cuotaFrancesa(monto, oferta.tna, plazoMeses)
  const costoTotal = cuotaMensual * plazoMeses
  const dentroDeRango =
    monto >= oferta.montoMin &&
    monto <= oferta.montoMax &&
    plazoMeses >= oferta.plazoMinMeses &&
    plazoMeses <= oferta.plazoMaxMeses

  return {
    ...oferta,
    cuotaMensual,
    costoTotal,
    interesTotal: costoTotal - monto,
    dentroDeRango,
  }
}

/** Ordena de más a menos conveniente según CFT (menor CFT = más conveniente). */
export function rankearPorCFT(ofertas: OfertaCalculada[]): OfertaCalculada[] {
  return [...ofertas].sort((a, b) => a.cft - b.cft)
}

export function formatoMoneda(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor)
}

export function formatoPorcentaje(valor: number): string {
  return `${valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`
}
