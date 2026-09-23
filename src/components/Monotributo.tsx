import { useMemo } from 'react'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import type { Factura } from '../lib/cfo'
import {
  ACTIVIDAD_MONOTRIBUTO_LABEL,
  MONOTRIBUTO_VIGENTE_DESDE,
  PRECIO_UNITARIO_MAXIMO,
  TABLA_MONOTRIBUTO,
  comprasUltimos12Meses,
  cuotaMensual,
  encuadrar,
  ingresosUltimos12Meses,
  proximaRecategorizacion,
  relacionComprasVentas,
  type ActividadMonotributo,
  type DatosMonotributo,
} from '../lib/monotributo'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import { InputMoneda } from './InputMoneda'
import { InfoTooltip } from './InfoTooltip'
import { Card } from './Card'

// En qué categoría del monotributo estás y en cuál vas a quedar en la próxima recategorización.
//
// Los ingresos no se cargan: salen de los comprobantes emitidos de los últimos 12 meses, que es la
// misma ventana que mira ARCA. El resto de los parámetros (alquiler, luz, superficie) sí van a
// mano, porque no están en el sistema, y se guardan con el negocio.

interface Props {
  facturas: Factura[]
  datos: DatosMonotributo
  onCambiar: (datos: DatosMonotributo) => void
}

const ETIQUETA_PARAMETRO: Record<string, string> = {
  ingresosBrutos: 'la facturación',
  superficieM2: 'la superficie',
  energiaKw: 'el consumo de luz',
  alquileres: 'el alquiler',
}

function fechaLegible(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function Monotributo({ facturas, datos, onCambiar }: Props) {
  const ingresosDeComprobantes = useMemo(() => ingresosUltimos12Meses(facturas), [facturas])
  const ingresos = datos.ingresosManual ?? ingresosDeComprobantes

  const encuadre = useMemo(
    () =>
      encuadrar({
        ingresosBrutos: ingresos,
        superficieM2: datos.superficieM2,
        energiaKw: datos.energiaKw,
        alquileres: datos.alquileres,
      }),
    [ingresos, datos.superficieM2, datos.energiaKw, datos.alquileres],
  )

  // Las compras y las ventas de este control salen siempre de los comprobantes fiscales, sin el
  // pisado manual de ingresos: lo que se compara es lo que ve ARCA, no lo que se estima.
  const compras = useMemo(() => comprasUltimos12Meses(facturas), [facturas])
  const relacion = useMemo(
    () => relacionComprasVentas(ingresosDeComprobantes, compras, datos.actividad),
    [ingresosDeComprobantes, compras, datos.actividad],
  )

  const cambiar = (cambios: Partial<DatosMonotributo>) => onCambiar({ ...datos, ...cambios })
  const campo = { borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }
  const cuota = encuadre.categoria ? cuotaMensual(encuadre.categoria, datos.actividad) : null

  return (
    <div className="space-y-6">
      <Card as="section">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Monotributo
          </h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Tabla vigente desde {fechaLegible(MONOTRIBUTO_VIGENTE_DESDE)}
          </span>
        </div>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          En qué categoría estás según tus últimos 12 meses, y en cuál vas a quedar en la próxima
          recategorización. La facturación sale sola de tus comprobantes emitidos; el resto de los
          parámetros cargalos abajo, porque ARCA también los mira y muchas veces son los que mandan.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(ACTIVIDAD_MONOTRIBUTO_LABEL) as ActividadMonotributo[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => cambiar({ actividad: a })}
              className="rounded-full border px-4 py-1.5 text-xs font-medium"
              style={
                datos.actividad === a
                  ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                  : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
              }
            >
              {ACTIVIDAD_MONOTRIBUTO_LABEL[a]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="mb-1 flex items-center gap-1.5">
              Ingresos brutos (12 meses)
              <InfoTooltip texto="Sale de tus comprobantes emitidos del último año, sin contar los internos. Si querés usar otro número, escribilo y pisa al calculado." />
            </span>
            <InputMoneda
              value={ingresos}
              onChange={(v) => cambiar({ ingresosManual: v })}
              className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            />
            {datos.ingresosManual !== undefined && (
              <button
                type="button"
                onClick={() => cambiar({ ingresosManual: undefined })}
                className="mt-1 underline"
                style={{ color: 'var(--series-blue)' }}
              >
                Volver al calculado ({formatoMoneda(ingresosDeComprobantes)})
              </button>
            )}
          </label>

          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="mb-1 block">Alquileres devengados (12 meses)</span>
            <InputMoneda
              value={datos.alquileres ?? 0}
              onChange={(v) => cambiar({ alquileres: v > 0 ? v : undefined })}
              className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="mb-1 block">Luz consumida (kW en 12 meses)</span>
            <input
              type="number"
              min={0}
              value={datos.energiaKw ?? ''}
              onChange={(e) => cambiar({ energiaKw: e.target.value ? Number(e.target.value) : undefined })}
              className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            />
          </label>

          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="mb-1 block">Superficie afectada (m²)</span>
            <input
              type="number"
              min={0}
              value={datos.superficieM2 ?? ''}
              onChange={(e) => cambiar({ superficieM2: e.target.value ? Number(e.target.value) : undefined })}
              className="tabular w-full rounded-lg border px-3 py-1.5 text-sm"
              style={campo}
            />
          </label>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Lo que dejes vacío no se usa para categorizar. Es lo correcto si esa actividad no tiene local
          ni alquiler a su nombre.
        </p>
      </Card>

      {encuadre.excedido ? (
        <Card as="section">
          <p
            className="inline-flex items-start gap-2 text-sm font-semibold"
            style={{ color: 'var(--status-critical)' }}
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            Te pasaste del monotributo
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Con estos valores superás la categoría K, que es la última. Corresponde pasar al Régimen
            General (responsable inscripto). Hablalo con tu contador antes de hacer cualquier trámite.
          </p>
        </Card>
      ) : (
        encuadre.categoria && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card padding="sm">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Categoría que te corresponde
              </p>
              <p className="text-3xl font-semibold" style={{ color: 'var(--series-blue)' }}>
                {encuadre.categoria.id}
              </p>
              {encuadre.determinantes.length > 0 && (
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Te ubica {encuadre.determinantes.map((d) => ETIQUETA_PARAMETRO[d]).join(' y ')}
                </p>
              )}
            </Card>
            <Card padding="sm">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Cuota mensual
              </p>
              <p className="tabular text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatoMoneda(cuota ?? 0)}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Impuesto {formatoMoneda(encuadre.categoria.impuestoIntegrado[datos.actividad])} + jubilación{' '}
                {formatoMoneda(encuadre.categoria.aportesSipa)} + obra social{' '}
                {formatoMoneda(encuadre.categoria.aportesObraSocial)}
              </p>
            </Card>
            <Card padding="sm">
              <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <CalendarClock size={13} aria-hidden="true" /> Próxima recategorización
              </p>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {fechaLegible(proximaRecategorizacion())}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {encuadre.margenHastaElSiguiente === null
                  ? 'Estás en la última categoría.'
                  : `Te quedan ${formatoMoneda(encuadre.margenHastaElSiguiente)} de facturación antes de subir de categoría.`}
              </p>
            </Card>
          </section>
        )
      )}

      <Card as="section">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Compras sobre ventas (12 meses)
          </h3>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Mínimo esperado para {ACTIVIDAD_MONOTRIBUTO_LABEL[datos.actividad].toLowerCase()}:{' '}
            {formatoPorcentaje(relacion.minima * 100)}
          </span>
        </div>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Cuánto de lo que vendés está respaldado por compras que te facturaron. Cuentan los
          comprobantes fiscales de los últimos 12 meses —los cargados a mano y los importados del
          Excel de ARCA—, nunca los internos ni los gastos sin factura.
        </p>

        {relacion.proporcion === null ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Todavía no hay ventas facturadas en los últimos 12 meses, así que no hay contra qué
            medir las compras.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p
                className="tabular text-3xl font-semibold"
                style={{ color: relacion.cumple ? 'var(--series-blue)' : 'var(--status-warning)' }}
              >
                {formatoPorcentaje(relacion.proporcion * 100)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Compras {formatoMoneda(relacion.compras)} sobre ventas {formatoMoneda(relacion.ventas)}
              </p>
            </div>
            {!relacion.cumple && (
              <p
                className="mt-2 inline-flex items-start gap-2 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0"
                  style={{ color: 'var(--status-warning)' }}
                  aria-hidden="true"
                />
                <span>
                  Las compras quedan {formatoMoneda(relacion.faltante)} por debajo del mínimo. Puede
                  ser que falten cargar facturas de proveedores, o que haya ventas sin el respaldo de
                  compra correspondiente. Es el cruce que mira ARCA, así que conviene revisarlo.
                </span>
              </p>
            )}
          </>
        )}
      </Card>

      <Card as="section">
        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          La tabla completa
        </h3>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Resaltada, la categoría que te corresponde hoy. La cuota que se muestra es la de{' '}
          {ACTIVIDAD_MONOTRIBUTO_LABEL[datos.actividad].toLowerCase()}. El precio unitario máximo por
          artículo para venta de cosas muebles es {formatoMoneda(PRECIO_UNITARIO_MAXIMO)} en todas las
          categorías.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                <th className="pb-2 font-medium">Cat.</th>
                <th className="pb-2 text-right font-medium">Ingresos brutos</th>
                <th className="pb-2 text-right font-medium">Sup.</th>
                <th className="pb-2 text-right font-medium">Luz</th>
                <th className="pb-2 text-right font-medium">Alquileres</th>
                <th className="pb-2 text-right font-medium">Cuota</th>
              </tr>
            </thead>
            <tbody>
              {TABLA_MONOTRIBUTO.map((c) => {
                const esLaSuya = encuadre.categoria?.id === c.id
                return (
                  <tr
                    key={c.id}
                    className="border-t"
                    style={{
                      borderColor: 'var(--gridline)',
                      background: esLaSuya ? 'var(--surface-2)' : undefined,
                      color: esLaSuya ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: esLaSuya ? 600 : undefined,
                    }}
                  >
                    <td className="py-1.5">{c.id}</td>
                    <td className="tabular py-1.5 text-right">{formatoMoneda(c.ingresosBrutos)}</td>
                    <td className="tabular py-1.5 text-right">{c.superficieM2} m²</td>
                    <td className="tabular py-1.5 text-right">{c.energiaKw.toLocaleString('es-AR')} kW</td>
                    <td className="tabular py-1.5 text-right">{formatoMoneda(c.alquileres)}</td>
                    <td className="tabular py-1.5 text-right">{formatoMoneda(cuotaMensual(c, datos.actividad))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
