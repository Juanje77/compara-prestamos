// Mover plata de una cuenta a otra.
//
// No es un ingreso ni un egreso del negocio: la plata no entra ni sale, cambia de lugar. Por eso
// se registra como DOS movimientos atados —la salida de una cuenta y la entrada en la otra— y no
// como un ajuste suelto en cada una. Atados importa: si se pudiera borrar la salida y dejar la
// entrada, quedaría plata creada de la nada.
//
// Con cuentas de distinta moneda los dos importes son distintos y los dos se cargan a mano. Es
// como lo informa el banco —salieron tantos pesos, entraron tantos dólares— y evita que el
// sistema tenga que suponer a qué tipo de cambio se hizo la operación, que es un dato de la
// operación y no del día.

import type { CuentaBancaria, MovimientoTesoreria } from './cfo'

export interface DatosTransferencia {
  desdeId: string
  haciaId: string
  /** Lo que sale de la cuenta de origen, en la moneda de esa cuenta. */
  monto: number
  /** Lo que entra en la de destino. Solo distinto cuando las monedas no coinciden. */
  montoDestino?: number
  fecha: string
  concepto?: string
}

export type ErrorTransferencia = 'misma-cuenta' | 'cuenta-inexistente' | 'monto-invalido' | 'falta-monto-destino'

export interface ResultadoTransferencia {
  movimientos: [MovimientoTesoreria, MovimientoTesoreria]
}

/** Por qué una transferencia no se puede registrar, o null si está bien. */
export function validarTransferencia(datos: DatosTransferencia, cuentas: CuentaBancaria[]): ErrorTransferencia | null {
  const desde = cuentas.find((c) => c.id === datos.desdeId)
  const hacia = cuentas.find((c) => c.id === datos.haciaId)
  if (!desde || !hacia) return 'cuenta-inexistente'
  if (desde.id === hacia.id) return 'misma-cuenta'
  if (!(datos.monto > 0)) return 'monto-invalido'
  // Entre monedas distintas no se adivina: el tipo de cambio es de la operación, no del día.
  if ((desde.moneda ?? 'ARS') !== (hacia.moneda ?? 'ARS') && !(datos.montoDestino && datos.montoDestino > 0)) {
    return 'falta-monto-destino'
  }
  return null
}

export const MENSAJE_ERROR_TRANSFERENCIA: Record<ErrorTransferencia, string> = {
  'misma-cuenta': 'Elegí dos cuentas distintas.',
  'cuenta-inexistente': 'Alguna de las cuentas elegidas ya no existe.',
  'monto-invalido': 'Poné un importe mayor a cero.',
  'falta-monto-destino': 'Las cuentas están en monedas distintas: cargá también cuánto entra en la de destino.',
}

/**
 * Los dos movimientos de una transferencia. Devuelve null si los datos no sirven — el llamador
 * valida antes con validarTransferencia para poder decir qué está mal.
 *
 * El concepto se arma solo nombrando la otra cuenta, que es lo que uno quiere leer en el detalle
 * de cada una: en el origen "a Banco Nación", en el destino "de Caja".
 */
export function armarTransferencia(
  datos: DatosTransferencia,
  cuentas: CuentaBancaria[],
  generarId: () => string,
): ResultadoTransferencia | null {
  if (validarTransferencia(datos, cuentas)) return null
  const desde = cuentas.find((c) => c.id === datos.desdeId)!
  const hacia = cuentas.find((c) => c.id === datos.haciaId)!
  const transferenciaId = generarId()
  const detalle = datos.concepto?.trim()
  const sufijo = detalle ? ` — ${detalle}` : ''

  return {
    movimientos: [
      {
        id: generarId(),
        cuentaId: desde.id,
        tipo: 'egreso',
        monto: datos.monto,
        fecha: datos.fecha,
        concepto: `Transferencia a ${hacia.nombre}${sufijo}`,
        origen: 'transferencia',
        transferenciaId,
      },
      {
        id: generarId(),
        cuentaId: hacia.id,
        tipo: 'ingreso',
        // Mismo importe salvo que las monedas difieran, y ahí lo pone la persona.
        monto: datos.montoDestino && datos.montoDestino > 0 ? datos.montoDestino : datos.monto,
        fecha: datos.fecha,
        concepto: `Transferencia de ${desde.nombre}${sufijo}`,
        origen: 'transferencia',
        transferenciaId,
      },
    ],
  }
}

/** La otra pata de una transferencia, para borrar las dos juntas. */
export function patasDeLaTransferencia(movimiento: MovimientoTesoreria, movimientos: MovimientoTesoreria[]): MovimientoTesoreria[] {
  if (!movimiento.transferenciaId) return [movimiento]
  return movimientos.filter((m) => m.transferenciaId === movimiento.transferenciaId)
}
