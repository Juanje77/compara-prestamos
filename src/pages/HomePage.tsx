import { Link } from 'react-router-dom'
import { buildWhatsAppLink } from '../components/WhatsAppContact'

const FEATURES_EMPRESAS = [
  { icon: '🏦', titulo: 'Cuentas bancarias', texto: 'Cargá el saldo de cada cuenta — si estás en descubierto, se ve al toque.' },
  { icon: '📉', titulo: 'Deudas', texto: 'Registrá préstamos y tarjetas pendientes, con un indicador de endeudamiento.' },
  { icon: '📊', titulo: 'Indicadores clave', texto: 'Margen operativo, runway de caja, punto de equilibrio y endeudamiento, con semáforo.' },
  { icon: '💰', titulo: 'Flujo de caja', texto: 'Proyección de tu saldo mes a mes, con alerta si te vas a quedar sin caja.' },
  { icon: '📅', titulo: 'Cobranzas y pagos', texto: 'Organizá qué cobrás y pagás cada una de las próximas 4 semanas, con progreso.' },
  { icon: '📄', titulo: 'Excel y PDF', texto: 'Importá tus cuentas a cobrar desde Excel y descargá todo en PDF para imprimir.' },
]

export function HomePage() {
  const mensajeWhatsApp = 'Hola Juan! Vi FinCorp y quiero saber más sobre el plan para empresas.'

  return (
    <>
      <div className="mb-10 text-center sm:mb-14">
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🇦🇷 FinCorp
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-5xl" style={{ color: 'var(--text-primary)' }}>
          Tu CFO virtual, para vos y para tu negocio
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base" style={{ color: 'var(--text-secondary)' }}>
          Comparás préstamos de los principales bancos argentinos y gestionás las finanzas de tu empresa —
          cuentas, deudas, flujo de caja y cobranzas — todo en un solo lugar, con asesoramiento de un
          Contador Público.
        </p>
      </div>

      <section className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <p className="text-2xl">🏛️</p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Comparador de préstamos
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Personales, prendarios, hipotecarios UVA y para jubilados/ANSES. Comparamos tasas y Costo
            Financiero Total (CFT) de los principales bancos para encontrar la opción más conveniente según
            tu monto, plazo y condición laboral.
          </p>
          <p className="mt-2 text-xs font-medium" style={{ color: 'var(--status-good-text)' }}>
            Gratis, sin necesidad de crear cuenta
          </p>
          <Link
            to="/prestamos"
            className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--series-blue)' }}
          >
            Comparar préstamos →
          </Link>
        </div>

        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <p className="text-2xl">🧮</p>
          <h2 className="mt-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            FinCorp para empresas
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Un dashboard financiero para tu negocio: cuentas bancarias, deudas, indicadores clave, flujo de
            caja proyectado y un organizador semanal de cobranzas y pagos. Todo lo que necesitás para
            entender la salud financiera de tu empresa, sin ser financista.
          </p>
          <p className="mt-2 text-xs font-medium" style={{ color: 'var(--series-blue)' }}>
            Plan pago — mirá cómo funciona más abajo
          </p>
          <Link
            to="/empresas"
            className="mt-4 inline-block rounded-full border px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            Ver Para empresas →
          </Link>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-2 text-center text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Así se ve el dashboard de tu negocio
        </h2>
        <p className="mx-auto mb-6 max-w-2xl text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cargás los números de tu negocio una sola vez y FinCorp arma todo el tablero automáticamente.
        </p>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <img src="/landing-dashboard-empresas.png" alt="Dashboard financiero de FinCorp para empresas" className="w-full" />
        </div>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_EMPRESAS.map((f) => (
          <div key={f.titulo} className="rounded-lg border p-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xl">{f.icon}</p>
            <p className="mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
              {f.titulo}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {f.texto}
            </p>
          </div>
        ))}
      </section>

      <section
        className="mb-12 overflow-hidden rounded-xl border shadow-sm"
        style={{ borderColor: 'var(--border)' }}
      >
        <img
          src="/landing-cobranzas-pagos.png"
          alt="Organizador semanal de cobranzas y pagos de FinCorp"
          className="w-full"
        />
      </section>

      <section
        className="mb-10 rounded-xl border p-6 text-center"
        style={{ borderColor: 'var(--series-blue)', background: 'color-mix(in srgb, var(--series-blue) 6%, var(--surface-1))' }}
      >
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          ¿Listo para ordenar las finanzas de tu negocio?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Escribime por WhatsApp y te cuento cuál de los planes de FinCorp para empresas se ajusta mejor a tu
          negocio.
        </p>
        <a
          href={buildWhatsAppLink(mensajeWhatsApp)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#25D366' }}
        >
          Consultar por WhatsApp
        </a>
      </section>
    </>
  )
}
