// La posición financiera que se ve en Cobranzas y pagos: lo que hay, lo que va a entrar y lo que
// va a salir, desglosado por de dónde sale cada número.
//
// Se calcula sobre la MISMA lista de movimientos que muestra la pantalla, y no sobre las facturas
// y los cheques por separado, justamente porque esa lista ya resolvió el problema difícil: una
// factura abonada con un cheque aparece una sola vez (la representa el cheque), así que sumar las
// dos fuentes por su cuenta contaría esa plata dos veces. Acá solo se clasifica y se suma.
//
// Entra únicamente lo PENDIENTE. Lo ya cobrado o pagado no se proyecta: esa plata ya se movió y
// está —si el negocio lleva Tesorería— en el saldo de las cuentas, que es el primer renglón.

import type { Movimiento } from './movimientosSemana'

/** Los prefijos con los que se arma el id de cada movimiento según de dónde viene. Un movimiento
 * cargado a mano en esta pantalla no lleva ninguno. */
export const PREFIJO_FACTURA = 'factura:'
export const PREFIJO_CHEQUE = 'cheque:'
export const PREFIJO_SUELDO = 'sueldo:'

export type OrigenMovimiento = 'factura' | 'cheque' | 'sueldo' | 'manual'

export function origenDeMovimiento(id: string): OrigenMovimiento {
  if (id.startsWith(PREFIJO_FACTURA)) return 'factura'
  if (id.startsWith(PREFIJO_CHEQUE)) return 'cheque'
  if (id.startsWith(PREFIJO_SUELDO)) return 'sueldo'
  return 'manual'
}

export interface DesglosePosicion {
  cheques: number
  facturas: number
  sueldos: number
  /** Lo cargado a mano (o importado de Excel) en esta misma pantalla. */
  otros: number
  total: number
}

export interface PosicionFinanciera {
  /** Lo que ya está en caja y cuentas bancarias hoy. */
  caja: number
  aCobrar: DesglosePosicion
  aPagar: DesglosePosicion
  /** Caja más todo lo que falta cobrar. */
  disponibleProyectado: number
  /** Lo anterior menos todo lo que falta pagar: con cuánto se termina si entra y sale todo. */
  posicionNeta: number
}

function desgloseVacio(): DesglosePosicion {
  return { cheques: 0, facturas: 0, sueldos: 0, otros: 0, total: 0 }
}

/**
 * Arma la posición a partir del saldo en cuentas y de los movimientos pendientes.
 *
 * `caja` llega por separado porque no es una proyección: es plata que ya está. Los negocios que no
 * llevan Tesorería la tienen en cero, y ahí la posición pasa a leerse como "de lo que falta
 * cobrar, cuánto queda después de pagar", que sigue siendo útil.
 */
export function calcularPosicionFinanciera(caja: number, movimientos: Movimiento[]): PosicionFinanciera {
  const aCobrar = desgloseVacio()
  const aPagar = desgloseVacio()

  for (const m of movimientos) {
    if (m.cumplido) continue
    const lado = m.tipo === 'cobro' ? aCobrar : aPagar
    const origen = origenDeMovimiento(m.id)
    if (origen === 'factura') lado.facturas += m.monto
    else if (origen === 'cheque') lado.cheques += m.monto
    else if (origen === 'sueldo') lado.sueldos += m.monto
    else lado.otros += m.monto
    lado.total += m.monto
  }

  const disponibleProyectado = caja + aCobrar.total
  return { caja, aCobrar, aPagar, disponibleProyectado, posicionNeta: disponibleProyectado - aPagar.total }
}
