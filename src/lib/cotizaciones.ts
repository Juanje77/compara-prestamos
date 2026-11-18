// Cotizaciones del dólar, para poder tener plata en dólares sin que los totales mientan.
//
// La regla del sistema: un saldo en dólares se GUARDA en dólares y se convierte recién al
// mostrarlo o sumarlo. Guardar el equivalente en pesos sería congelar el tipo de cambio del día
// que se cargó, y a los dos meses ese número no significa nada.
//
// La fuente es dolarapi.com, que es pública, gratis y no pide clave. La consulta la hace el
// navegador de cada usuario, no nuestro servidor: así no gastamos una de las doce funciones que
// permite el plan de Vercel, y si la API se cae no se cae la app.
//
// Nada de esto es la verdad revelada: el usuario puede fijar a mano el tipo de cambio que quiere
// usar, y ese gana siempre. Un contador tiene motivos para usar un número distinto al del día
// —el de cierre de balance, el de la fecha de la operación—, y el sistema no está para discutirle.

export const CASAS = ['oficial', 'bolsa', 'contadoconliqui', 'blue'] as const
export type CasaDolar = (typeof CASAS)[number]

export const NOMBRE_CASA: Record<CasaDolar, string> = {
  oficial: 'Oficial',
  bolsa: 'MEP (bolsa)',
  contadoconliqui: 'CCL',
  blue: 'Blue',
}

/** Para qué sirve cada uno, dicho en una línea — se muestra al elegir cuál usar. */
export const DETALLE_CASA: Record<CasaDolar, string> = {
  oficial: 'El del Banco Nación. Es el que usa ARCA para balance y declaraciones.',
  bolsa: 'Dólar MEP. Al que una empresa puede comprar o vender dólares de manera legal.',
  contadoconliqui: 'Contado con liquidación. El que se usa para girar divisas al exterior.',
  blue: 'El informal. No sirve para respaldar una registración, pero marca el mercado.',
}

export interface Cotizacion {
  casa: CasaDolar
  compra: number
  venta: number
  /** Cuándo la actualizó la fuente, tal como la informó (ISO). */
  actualizado: string
}

export type Cotizaciones = Partial<Record<CasaDolar, Cotizacion>>

/**
 * Qué punta usar. Un activo en dólares (una caja, un cheque a cobrar) se valúa a la COMPRA, que
 * es lo que te darían si lo vendieras hoy. Un pasivo (una factura de proveedor en dólares) a la
 * VENTA, que es lo que te costaría comprar esos dólares para pagarla. Es el criterio prudente y
 * el de cualquier balance: no inflar lo que tenés ni achicar lo que debés.
 */
export type LadoValuacion = 'activo' | 'pasivo'

export function tipoDeCambio(c: Cotizacion, lado: LadoValuacion): number {
  return lado === 'activo' ? c.compra : c.venta
}

export type Moneda = 'ARS' | 'USD'

/**
 * Pasa un importe a pesos. `moneda` sin valor significa pesos: es lo que había antes de que
 * existieran los dólares en el sistema, y todo lo ya cargado tiene que seguir valiendo lo mismo.
 *
 * Sin cotización disponible devuelve el importe tal cual y avisa con `convertido: false`, para
 * que la pantalla pueda decir "esto no está convertido" en vez de mostrar un número inventado.
 */
export function aPesos(
  monto: number,
  moneda: Moneda | undefined,
  cotizacion: Cotizacion | null,
  lado: LadoValuacion = 'activo',
): { monto: number; convertido: boolean } {
  if (moneda !== 'USD') return { monto, convertido: true }
  if (!cotizacion) return { monto, convertido: false }
  return { monto: monto * tipoDeCambio(cotizacion, lado), convertido: true }
}

// --- Lectura de la fuente ------------------------------------------------------------------

const URL_API = 'https://dolarapi.com/v1/dolares'

/** Lo que devuelve la API, mirado con desconfianza: es de un tercero y puede cambiar sin avisar. */
export function parsearCotizaciones(datos: unknown): Cotizaciones {
  if (!Array.isArray(datos)) return {}
  const resultado: Cotizaciones = {}
  for (const fila of datos) {
    if (!fila || typeof fila !== 'object') continue
    const f = fila as Record<string, unknown>
    const casa = f.casa
    if (typeof casa !== 'string' || !(CASAS as readonly string[]).includes(casa)) continue
    const compra = Number(f.compra)
    const venta = Number(f.venta)
    // Un cero o un negativo no es una cotización: convertir con eso daría saldos en cero o dados
    // vuelta, que es peor que no tener el dato.
    if (!Number.isFinite(compra) || !Number.isFinite(venta) || compra <= 0 || venta <= 0) continue
    resultado[casa as CasaDolar] = {
      casa: casa as CasaDolar,
      compra,
      venta,
      actualizado: typeof f.fechaActualizacion === 'string' ? f.fechaActualizacion : new Date().toISOString(),
    }
  }
  return resultado
}

export async function traerCotizaciones(señal?: AbortSignal): Promise<Cotizaciones> {
  const respuesta = await fetch(URL_API, { signal: señal })
  if (!respuesta.ok) throw new Error(`La fuente de cotizaciones respondió ${respuesta.status}`)
  return parsearCotizaciones(await respuesta.json())
}

// --- Caché ---------------------------------------------------------------------------------

const CLAVE_CACHE = 'compara-prestamos.cotizaciones'

export interface CacheCotizaciones {
  dia: string
  cotizaciones: Cotizaciones
}

/**
 * Lo último que se trajo, con el día en que se trajo. Se guarda para dos cosas distintas: no
 * pedirle a la API lo mismo veinte veces por día, y tener algo que mostrar cuando la API no
 * contesta. Por eso se devuelve aunque sea de ayer — con la fecha a la vista, un número viejo
 * declarado como viejo sirve; uno viejo disfrazado de hoy, no.
 */
export function leerCache(): CacheCotizaciones | null {
  try {
    const crudo = localStorage.getItem(CLAVE_CACHE)
    if (!crudo) return null
    const dato = JSON.parse(crudo) as Partial<CacheCotizaciones>
    if (typeof dato?.dia !== 'string' || !dato.cotizaciones) return null
    return { dia: dato.dia, cotizaciones: dato.cotizaciones }
  } catch {
    return null
  }
}

export function guardarCache(cotizaciones: Cotizaciones, dia = new Date().toISOString().slice(0, 10)): void {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify({ dia, cotizaciones } satisfies CacheCotizaciones))
  } catch {
    // Modo privado o almacenamiento lleno: se pide de nuevo la próxima vez y listo.
  }
}
