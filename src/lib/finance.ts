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

export interface FilaAmortizacion {
  numero: number
  cuota: number
  interes: number
  capital: number
  saldo: number
}

/** Tabla de amortización mes a mes por sistema francés (cuota fija, interés decreciente). */
export function generarTablaAmortizacion(monto: number, tnaPct: number, plazoMeses: number): FilaAmortizacion[] {
  const i = tnaPct / 100 / 12
  const cuota = cuotaFrancesa(monto, tnaPct, plazoMeses)
  const filas: FilaAmortizacion[] = []
  let saldo = monto

  for (let numero = 1; numero <= plazoMeses; numero++) {
    const interes = saldo * i
    const capital = numero === plazoMeses ? saldo : cuota - interes
    saldo = Math.max(0, saldo - capital)
    filas.push({ numero, cuota: numero === plazoMeses ? capital + interes : cuota, interes, capital, saldo })
  }

  return filas
}

/**
 * Monto máximo de préstamo accesible dada una cuota mensual máxima (p. ej. un % del ingreso),
 * despejando el capital de la fórmula del sistema francés. Es la inversa de `cuotaFrancesa`.
 */
export function montoMaximoPorCuota(cuotaMaxima: number, tnaPct: number, plazoMeses: number): number {
  const i = tnaPct / 100 / 12
  if (i === 0) return cuotaMaxima * plazoMeses
  const factor = Math.pow(1 + i, plazoMeses)
  return (cuotaMaxima * (factor - 1)) / (i * factor)
}

/** Saldo de capital pendiente de un préstamo francés luego de pagar `cuotasPagadas` cuotas. */
export function saldoPendiente(monto: number, tnaPct: number, plazoMeses: number, cuotasPagadas: number): number {
  if (cuotasPagadas <= 0) return monto
  if (cuotasPagadas >= plazoMeses) return 0
  const i = tnaPct / 100 / 12
  const cuota = cuotaFrancesa(monto, tnaPct, plazoMeses)
  if (i === 0) return Math.max(0, monto - cuota * cuotasPagadas)
  const factor = Math.pow(1 + i, cuotasPagadas)
  const saldo = monto * factor - cuota * ((factor - 1) / i)
  return Math.max(0, saldo)
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
