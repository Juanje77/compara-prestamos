// Excedente de caja: cuánta plata tiene el negocio por encima del colchón que necesita para
// operar tranquilo.
//
// Es un cálculo de administración de caja, no una recomendación de inversión: dice cuánto sobra,
// no qué hacer con eso. Lo usa la pantalla de Inversiones para arrancar la conversación con el
// asesor con un número concreto en vez de una idea vaga.

/** Meses de gastos fijos que conviene tener siempre disponibles. Tres es el piso que se repite en
 * la literatura de capital de trabajo para una PyME, y es el mismo umbral con el que el resto de
 * FinCorp considera que el runway está en rojo. Se puede mover desde la pantalla. */
export const MESES_COLCHON_SUGERIDO = 3

export interface ExcedenteDeCaja {
  /** Lo que hay hoy en cuentas y caja. */
  caja: number
  /** Lo que conviene no tocar: los meses elegidos de gastos fijos. */
  colchon: number
  /** Lo que sobra por encima del colchón. Nunca negativo: si falta, se mira `faltante`. */
  excedente: number
  /** Cuánto falta para completar el colchón. Cero si ya está cubierto. */
  faltante: number
  /** Qué parte de la caja está de más, entre 0 y 1. Cero si no hay caja o no sobra nada. */
  proporcionOciosa: number
}

/**
 * Cuánto de la caja está de más. Con gastos fijos en cero no hay colchón que calcular, así que
 * todo lo que haya cuenta como excedente — es lo que corresponde cuando el negocio todavía no
 * cargó sus gastos, aunque el número sirva de poco hasta que los cargue.
 */
export function calcularExcedenteDeCaja(
  caja: number,
  gastosFijosMensuales: number,
  mesesColchon: number = MESES_COLCHON_SUGERIDO,
): ExcedenteDeCaja {
  const colchon = Math.max(0, gastosFijosMensuales) * Math.max(0, mesesColchon)
  const disponible = caja - colchon
  const excedente = Math.max(0, disponible)
  return {
    caja,
    colchon,
    excedente,
    faltante: Math.max(0, -disponible),
    proporcionOciosa: caja > 0 ? excedente / caja : 0,
  }
}

/** Los instrumentos de los que se habla en la pantalla de Inversiones. Van sin rendimientos a
 * propósito: acá se explica para qué sirve cada uno y en qué plazo se piensa, y los números los
 * pone el asesor en la conversación, que es donde puede mirar el caso concreto. */
export interface TipoInstrumento {
  id: string
  nombre: string
  plazo: string
  paraQue: string
  aTenerEnCuenta: string
}

export const TIPOS_INSTRUMENTO: TipoInstrumento[] = [
  {
    id: 'money-market',
    nombre: 'Fondos de liquidez inmediata (money market)',
    plazo: 'Disponible en el día',
    paraQue:
      'La plata que vas a necesitar en cualquier momento: el excedente que hoy duerme en la cuenta corriente entre que cobrás y pagás.',
    aTenerEnCuenta:
      'Se rescata el mismo día y no tiene plazo de permanencia, pero el rendimiento acompaña a las tasas del momento y cambia todo el tiempo.',
  },
  {
    id: 'plazo-fijo',
    nombre: 'Plazo fijo',
    plazo: 'Desde 30 días',
    paraQue: 'Plata que sabés que no vas a tocar por un tiempo definido, como la que juntás para una compra planificada.',
    aTenerEnCuenta: 'La tasa queda fija desde el inicio, pero no podés disponer del dinero hasta el vencimiento.',
  },
  {
    id: 'renta-fija',
    nombre: 'Letras y bonos',
    plazo: 'Meses a años',
    paraQue: 'Excedentes con un horizonte más largo, o para acompañar la inflación o el dólar según el instrumento.',
    aTenerEnCuenta:
      'Se pueden vender antes del vencimiento, pero al precio del día: ahí sí podés cobrar menos de lo que pusiste.',
  },
  {
    id: 'renta-variable',
    nombre: 'Acciones y CEDEARs',
    plazo: 'Largo plazo',
    paraQue: 'La parte del excedente que no necesitás para operar y podés dejar quieta varios años.',
    aTenerEnCuenta:
      'Es lo más volátil de la lista: el valor sube y baja fuerte, y no es para la caja del negocio.',
  },
]
