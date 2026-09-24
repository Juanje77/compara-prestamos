import { useMemo, useState } from 'react'
import { Info, TrendingUp } from 'lucide-react'
import {
  MESES_COLCHON_SUGERIDO,
  TIPOS_INSTRUMENTO,
  calcularExcedenteDeCaja,
} from '../lib/excedente'
import { formatoMoneda } from '../lib/finance'
import { buildWhatsAppLink } from './WhatsAppContact'
import { Card } from './Card'

// Inversiones: qué parte de la caja está de más y qué se puede hacer con eso.
//
// La pantalla no recomienda ni muestra rendimientos a propósito. Hace dos cosas: calcular el
// excedente con los datos que el negocio ya cargó, y explicar en qué se diferencian los tipos de
// instrumento. El asesoramiento concreto sale de la conversación con el asesor, que es donde se
// puede mirar el caso puntual — por eso el botón de contacto lleva el número ya calculado.

interface Props {
  /** Lo que hay en cuentas y caja hoy. */
  caja: number
  /** Gastos fijos mensuales, para dimensionar el colchón. */
  gastosFijosMensuales: number
}

export function Inversiones({ caja, gastosFijosMensuales }: Props) {
  const [mesesColchon, setMesesColchon] = useState(MESES_COLCHON_SUGERIDO)
  const r = useMemo(
    () => calcularExcedenteDeCaja(caja, gastosFijosMensuales, mesesColchon),
    [caja, gastosFijosMensuales, mesesColchon],
  )

  const mensaje =
    r.excedente > 0
      ? `Hola Juan! Vi en FinCorp que tengo un excedente de caja de ${formatoMoneda(r.excedente)} y quisiera asesoramiento para invertirlo.`
      : 'Hola Juan! Quisiera asesoramiento para invertir los excedentes de mi negocio.'

  return (
    <div className="space-y-6">
      <Card as="section">
        <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Invertir los excedentes
        </h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          La plata parada en la cuenta pierde valor todos los meses. Acá ves cuánto de tu caja está
          de más —o sea, cuánto podrías poner a trabajar sin quedarte corto para operar— y qué tipo
          de instrumento se usa en cada caso.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Caja disponible hoy
            </p>
            <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatoMoneda(r.caja)}
            </p>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Colchón que querés dejar
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={mesesColchon}
                  onChange={(e) => setMesesColchon(Math.max(0, Number(e.target.value) || 0))}
                  className="tabular w-16 rounded-lg border px-2 py-1 text-sm"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface-1)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {mesesColchon === 1 ? 'mes' : 'meses'} de gastos fijos
                </span>
              </span>
            </label>
            <p className="tabular mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {formatoMoneda(r.colchon)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {r.excedente > 0 ? 'Excedente que podés invertir' : 'Te falta para el colchón'}
            </p>
            <p
              className="tabular text-2xl font-semibold"
              style={{ color: r.excedente > 0 ? 'var(--status-good-text)' : 'var(--text-secondary)' }}
            >
              {formatoMoneda(r.excedente > 0 ? r.excedente : r.faltante)}
            </p>
            {r.excedente > 0 && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Es el {Math.round(r.proporcionOciosa * 100)}% de tu caja
              </p>
            )}
          </div>
        </div>

        {r.excedente === 0 && (
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Con estos números tu caja todavía no cubre el colchón que elegiste. Primero conviene
            completarlo: invertir lo que después vas a necesitar para pagar sueldos o proveedores
            suele salir caro.
          </p>
        )}

        <div className="mt-5">
          <a
            href={buildWhatsAppLink(mensaje)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium"
            style={{ background: 'var(--series-blue)', color: 'white' }}
          >
            <TrendingUp size={16} aria-hidden="true" /> Hablar con mi asesor
          </a>
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Te contesta Juan Costantini, Contador Público. Las operaciones se hacen a través de
            Balanz Capital, agente registrado ante la Comisión Nacional de Valores.
          </p>
        </div>
      </Card>

      <Card as="section">
        <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Con qué se trabaja, según para cuándo necesitás la plata
        </h3>
        <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          El plazo en el que vas a necesitar el dinero es lo que define el instrumento, más que
          cualquier otra cosa. No hay uno mejor que otro: hay uno que corresponde a cada caso.
        </p>

        <ul className="space-y-3">
          {TIPOS_INSTRUMENTO.map((t) => (
            <li key={t.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t.nombre}
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  {t.plazo}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t.paraQue}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {t.aTenerEnCuenta}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card as="section" padding="sm">
        <p
          className="flex items-start gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Esta pantalla es informativa y no constituye una recomendación de inversión ni una
            oferta de instrumentos. Todos los instrumentos tienen riesgo y ninguno garantiza
            resultados: los rendimientos pasados no aseguran los futuros. Qué conviene en tu caso
            depende de tu situación, tu horizonte y tu tolerancia al riesgo, y eso se define en una
            conversación, no en un cálculo automático.
          </span>
        </p>
      </Card>
    </div>
  )
}
