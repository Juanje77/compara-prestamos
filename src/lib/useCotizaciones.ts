import { useCallback, useEffect, useState } from 'react'
import {
  guardarCache,
  leerCache,
  traerCotizaciones,
  type CasaDolar,
  type Cotizacion,
  type Cotizaciones,
} from './cotizaciones'

// De dónde sale la cotización que usa toda la app.
//
// Se pide una vez por día y se guarda. Si la fuente no contesta, se sigue con lo último que se
// trajo, diciendo de cuándo es: un número viejo declarado como viejo sirve para trabajar; uno
// viejo disfrazado de hoy, no.
//
// El tipo de cambio fijado a mano gana siempre. Un contador tiene motivos para usar otro número
// —el de cierre, el de la fecha de la operación, el que le pasó el cliente—, y el sistema no está
// para discutirle: está para que no tenga que calcularlo con la calculadora.

export interface EstadoCotizaciones {
  cotizaciones: Cotizaciones
  /** La del tipo elegido, con el valor fijado a mano si lo hay. null si todavía no hay ninguna. */
  actual: Cotizacion | null
  casa: CasaDolar
  /** De qué día es lo que se está mostrando (ISO), para poder decirlo en pantalla. */
  dia: string | null
  manual: boolean
  cargando: boolean
  error: string | null
  refrescar: () => void
}

interface Opciones {
  casa: CasaDolar
  /** Tipo de cambio fijado a mano. Si está, no se usa el de la fuente. */
  manual?: { compra: number; venta: number } | null
}

const hoy = () => new Date().toISOString().slice(0, 10)

export function useCotizaciones({ casa, manual }: Opciones): EstadoCotizaciones {
  const guardado = leerCache()
  const [cotizaciones, setCotizaciones] = useState<Cotizaciones>(guardado?.cotizaciones ?? {})
  const [dia, setDia] = useState<string | null>(guardado?.dia ?? null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pedido, setPedido] = useState(0)

  const refrescar = useCallback(() => setPedido((n) => n + 1), [])

  useEffect(() => {
    const cache = leerCache()
    // Ya se trajeron hoy y nadie pidió refrescar: no hace falta molestar a la fuente de nuevo.
    if (pedido === 0 && cache && cache.dia === hoy() && Object.keys(cache.cotizaciones).length > 0) return

    const controlador = new AbortController()
    setCargando(true)
    setError(null)
    traerCotizaciones(controlador.signal)
      .then((nuevas) => {
        if (controlador.signal.aborted) return
        if (Object.keys(nuevas).length === 0) throw new Error('La fuente no devolvió ninguna cotización conocida.')
        setCotizaciones(nuevas)
        setDia(hoy())
        guardarCache(nuevas)
      })
      .catch((e: unknown) => {
        if (controlador.signal.aborted) return
        // Queda lo último que se había traído, con su fecha: por eso no se limpia el estado.
        setError(e instanceof Error ? e.message : 'No se pudieron traer las cotizaciones.')
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false)
      })
    return () => controlador.abort()
  }, [pedido])

  const deLaFuente = cotizaciones[casa] ?? null
  const actual: Cotizacion | null = manual
    ? { casa, compra: manual.compra, venta: manual.venta, actualizado: new Date().toISOString() }
    : deLaFuente

  return {
    cotizaciones,
    actual,
    casa,
    dia: manual ? null : dia,
    manual: Boolean(manual),
    cargando,
    error,
    refrescar,
  }
}
