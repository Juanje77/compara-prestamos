// La foto mensual del negocio: los mismos indicadores del Dashboard, guardados mes a mes.
//
// Por qué hace falta. Margen operativo, runway, punto de equilibrio y endeudamiento se calculan
// con los saldos de HOY: son una foto, no una serie. Hasta ahora no quedaba registro de la foto
// anterior, así que no había contra qué comparar — y un indicador sin su mes pasado dice bastante
// menos de lo que parece: "runway 3 meses" se lee de una forma si veníamos de 2 y de otra si
// veníamos de 6.
//
// Qué se guarda: el VALOR YA CALCULADO de cada indicador, no los datos con los que salió. Es a
// propósito, y tiene una consecuencia que conviene conocer: si algún día cambia la fórmula de un
// indicador, las fotos viejas siguen teniendo el número de la fórmula vieja y la comparación
// contra ellas deja de ser estrictamente válida. La alternativa —recalcular todo el historial con
// la fórmula nueva— exigiría guardar el negocio entero de cada mes, que es muchísimo más peso
// para un beneficio que casi nunca se cobra.
//
// La foto del mes en curso se pisa cada vez que se abre la app: es "cómo venimos hoy". Las de los
// meses cerrados no se tocan nunca más. Y si alguien no abre la app durante un mes entero, ese
// mes queda sin foto: el historial tiene huecos a propósito, porque inventar un valor que nadie
// midió sería peor que no tenerlo.

/** Un mes del historial. Todos los campos son opcionales menos el mes: un negocio del plan Básico
 * no tiene cobranzas cargadas, y guardar ceros ahí haría ver una caída que nunca pasó. */
export interface FotoMensual {
  /** YYYY-MM */
  mes: string
  /** Cuándo se tomó, para saber si la del mes en curso es de hoy o de hace tres semanas. */
  tomadaEn: number
  margenOperativo?: number
  runwayMeses?: number
  /** Cuánto hay que facturar por mes para no perder plata. */
  puntoEquilibrio?: number
  /** Meses de ingresos que representa la deuda total. */
  endeudamientoMeses?: number
  /** Saldo en caja y bancos al momento de la foto. */
  caja?: number
  facturado?: number
  cobrado?: number
  pagado?: number
}

/** Cuántos meses se conservan. Tres años alcanzan para mirar estacionalidad —comparar este
 * noviembre con los dos anteriores— y mantiene el documento chico. */
export const MAX_MESES_HISTORIAL = 36

/**
 * Guarda la foto del mes, pisando la que hubiera de ese mismo mes.
 *
 * Pisar es lo correcto: la foto del mes en curso es "cómo venimos hoy" y tiene que reflejar lo
 * último. Las de meses anteriores no se vuelven a tocar porque nunca se vuelve a pedir una foto
 * de un mes que ya pasó.
 *
 * Devuelve siempre una lista nueva, ordenada por mes y recortada a MAX_MESES_HISTORIAL.
 */
export function registrarFoto(historial: FotoMensual[], foto: FotoMensual): FotoMensual[] {
  const sinEseMes = historial.filter((f) => f.mes !== foto.mes)
  return [...sinEseMes, foto].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-MAX_MESES_HISTORIAL)
}

export function fotoDe(historial: FotoMensual[], mes: string): FotoMensual | null {
  return historial.find((f) => f.mes === mes) ?? null
}

/**
 * La foto anterior a un mes dado: la más reciente de todas las que quedaron antes.
 *
 * No es necesariamente la del mes inmediato anterior. Si el usuario no abrió la app en marzo, la
 * anterior a abril es la de febrero, y comparar contra ésa es mucho mejor que no comparar contra
 * nada. Quien lo muestre debería decir de qué mes es — "vs. febrero" y no "vs. mes pasado", que
 * sería mentira.
 */
export function fotoAnteriorA(historial: FotoMensual[], mes: string): FotoMensual | null {
  const anteriores = historial.filter((f) => f.mes < mes)
  return anteriores.length > 0 ? anteriores[anteriores.length - 1] : null
}

/**
 * Si hace falta volver a tomar la foto del mes en curso.
 *
 * Una por día alcanza: estos indicadores se mueven con la carga del día, y reescribir el
 * documento en cada tecla sería multiplicar las escrituras de Firestore sin ninguna ganancia.
 */
export function hayQueTomarFoto(historial: FotoMensual[], mes: string, ahora = Date.now()): boolean {
  const actual = fotoDe(historial, mes)
  if (!actual) return true
  const unDia = 24 * 60 * 60 * 1000
  return ahora - actual.tomadaEn >= unDia
}

/** Las fotos de los últimos N meses, de la más vieja a la más nueva. */
export function ultimosMeses(historial: FotoMensual[], cantidad: number): FotoMensual[] {
  return historial.slice(-cantidad)
}
