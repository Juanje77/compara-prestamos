interface Termino {
  sigla: string
  nombre: string
  explicacion: string
}

const TERMINOS: Termino[] = [
  {
    sigla: 'TNA',
    nombre: 'Tasa Nominal Anual',
    explicacion:
      'Es la tasa de interés "de base" que cobra el banco, expresada por año, sin considerar el efecto de la capitalización mensual de intereses. Sirve para calcular la cuota, pero por sí sola no refleja el costo real del préstamo.',
  },
  {
    sigla: 'TEA',
    nombre: 'Tasa Efectiva Anual',
    explicacion:
      'Es la TNA ya ajustada por el efecto de que los intereses se cobran (y generan intereses) mes a mes. Siempre es mayor a la TNA, y se acerca más al costo real, aunque todavía no incluye seguros ni gastos administrativos.',
  },
  {
    sigla: 'CFT',
    nombre: 'Costo Financiero Total',
    explicacion:
      'Es el indicador más completo: incluye la TEA más los seguros obligatorios, gastos administrativos e IVA. Es el número que de verdad hay que mirar para comparar préstamos entre bancos, y el que usamos para armar el ranking de "más conveniente" en esta página.',
  },
  {
    sigla: 'Sistema francés',
    nombre: 'Sistema francés de amortización',
    explicacion:
      'Es el método más común en Argentina: la cuota es siempre la misma durante todo el préstamo, pero la composición cambia mes a mes — al principio se paga más interés y menos capital, y hacia el final es al revés. Podés ver el detalle completo en "Ver cuotas" de cada oferta.',
  },
  {
    sigla: 'UVA',
    nombre: 'Unidad de Valor Adquisitivo',
    explicacion:
      'Es una unidad de cuenta que se actualiza todos los días según la inflación (CER). Los créditos hipotecarios UVA fijan la tasa de interés, pero el capital adeudado se ajusta por UVA — por eso la cuota en pesos va cambiando mes a mes según la inflación, aunque la tasa se mantenga fija.',
  },
  {
    sigla: 'Situación crediticia',
    nombre: 'Situación crediticia (BCRA)',
    explicacion:
      'Es una clasificación del 1 al 6 que hace el Banco Central según tu historial de pagos en el sistema financiero: 1 es "normal" (sin atrasos), y a partir de 3 empieza a haber problemas para acceder a nuevo financiamiento. Podés consultar la tuya gratis más arriba en esta página.',
  },
  {
    sigla: 'Período de gracia',
    nombre: 'Período de gracia',
    explicacion:
      'Algunos préstamos (como el de monotributistas de Banco Nación) permiten no pagar capital durante los primeros meses, solo los intereses generados. Reduce la cuota inicial, pero el préstamo termina costando más en total.',
  },
]

export function Glosario() {
  return (
    <section
      id="glosario"
      className="mb-10 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
    >
      <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        Glosario: términos que vas a ver en esta página
      </h2>
      <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Para que no tengas que buscar en otro lado qué significa cada sigla.
      </p>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TERMINOS.map((t) => (
          <div key={t.sigla}>
            <dt className="font-semibold" style={{ color: 'var(--series-blue)' }}>
              {t.sigla} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>— {t.nombre}</span>
            </dt>
            <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t.explicacion}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
