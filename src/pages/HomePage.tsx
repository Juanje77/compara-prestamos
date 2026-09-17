import { Link } from 'react-router-dom'
import { buildWhatsAppLink } from '../components/WhatsAppContact'

const FEATURES_BASICO = [
  { icon: '📆', titulo: 'Ingresos y gastos diarios', texto: 'Cargá tus ventas con el medio de cobro (efectivo, transferencia, QR, débito, crédito) y tus gastos día a día.' },
  { icon: '🏦', titulo: 'Cuentas bancarias y deudas', texto: 'Cargá el saldo de cada cuenta y tus deudas pendientes, con un indicador de endeudamiento.' },
  { icon: '📊', titulo: 'Indicadores clave', texto: 'Margen operativo, runway de caja, punto de equilibrio y endeudamiento, con semáforo y explicación de cada uno.' },
  { icon: '💰', titulo: 'Flujo de caja proyectado', texto: 'Proyección de tu saldo mes a mes, con alerta si te vas a quedar sin caja.' },
  { icon: '📅', titulo: 'Cobranzas y pagos semanales', texto: 'Organizá qué cobrás y pagás cada una de las próximas 4 semanas, con progreso.' },
  { icon: '📄', titulo: 'Informe y Excel', texto: 'Importá tus cuentas a cobrar desde Excel y descargá un informe financiero con gráficos, listo para imprimir.' },
]

const FEATURES_MEDIO = [
  { icon: '📥', titulo: 'Comprobantes', texto: 'Importá tus facturas desde ARCA y mirá ventas, compras, margen y tus principales clientes y proveedores.' },
  { icon: '🎯', titulo: 'Presupuesto vs. Real', texto: 'Comparás lo presupuestado contra lo que realmente gastaste, con el desvío por categoría y comentarios automáticos.' },
  { icon: '📈', titulo: 'Proyección con escenarios', texto: 'Sumá una tasa de crecimiento mensual esperada, con escenarios optimista y pesimista, no solo lineal.' },
  { icon: '🔔', titulo: 'Alertas y recomendaciones', texto: 'Avisos si tu caja se agota, una deuda está por vencer, o tu margen se pone negativo, con qué hacer al respecto.' },
  { icon: '🧮', titulo: 'IVA e Ingresos Brutos', texto: 'Posición de IVA e Ingresos Brutos mes a mes, con alícuota y retenciones editables para que cuadre con lo declarado en ARCA.' },
  { icon: '🏛️', titulo: 'Patrimonio y bienes', texto: 'Sumá tus bienes realizables (inversiones, inmuebles, vehículos) y mirá tu runway extendido ante un quiebre de caja.' },
]

const FEATURES_FULL = [
  { icon: '🧾', titulo: 'Facturación electrónica', texto: 'Emitís facturas A, B y C con CAE sin salir del sistema, y notas de crédito atadas a la factura que corrigen. Te guiamos paso a paso para habilitar tu CUIT ante ARCA.' },
  { icon: '👷', titulo: 'Sueldos y cargas sociales', texto: 'Recibos numerados con todo lo que exige el art. 140 de la LCT, libro de sueldos, aguinaldo, y cada descuento con la base sobre la que se calcula.' },
  { icon: '📒', titulo: 'Cuentas corrientes', texto: 'Saldo por cliente y proveedor, con pagos parciales que se van imputando solos a la factura más antigua.' },
  { icon: '📋', titulo: 'Remitos y presupuestos', texto: 'Para trabajos largos: cargá el remito, cobrá un anticipo, y facturá todo junto al terminar.' },
  { icon: '📐', titulo: 'Márgenes por sector', texto: 'Cuánto deja realmente cada división de tu negocio, con el costo de la mano de obra repartido por porcentaje entre las tareas de cada empleado.' },
  { icon: '💵', titulo: 'Tesorería y conciliación', texto: 'Caja y bancos al día: cada cobro, pago y sueldo impacta en la cuenta, y conciliás contra el extracto que importás del banco.' },
  { icon: '📦', titulo: 'Stock', texto: 'Catálogo de productos con costo y precio, movimientos de entrada y salida, y aviso cuando algo baja del mínimo.' },
  { icon: '💳', titulo: 'Gestión de cheques', texto: 'Vinculados a tus facturas y cuentas corrientes, para armar tu balance contable sin cargar todo dos veces.' },
  { icon: '⚙️', titulo: 'Todo integrado', texto: 'Un sistema de uso diario: cada cheque, sueldo o anticipo que cargás actualiza solo tus indicadores de CFO, sin pasos extra.' },
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
          cuentas, flujo de caja, cobranzas, sueldos, IVA— y emitís tus facturas con CAE, todo en un solo
          lugar y con explicaciones simples de cada indicador.
        </p>
        <p
          className="mx-auto mt-4 inline-block max-w-xl rounded-full px-4 py-2 text-sm font-semibold"
          style={{ background: 'color-mix(in srgb, var(--status-good-text) 12%, transparent)', color: 'var(--status-good-text)' }}
        >
          🎁 Probá FinCorp para empresas 15 días gratis con acceso Full completo, sin tarjeta
        </p>
      </div>

      <section className="mb-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
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
            caja proyectado y un organizador semanal de cobranzas y pagos. En el plan Full, además, liquidás
            sueldos y emitís tus facturas con CAE sin salir de acá.
          </p>
          <p className="mt-2 text-xs font-medium" style={{ color: 'var(--series-blue)' }}>
            15 días gratis y después elegís tu plan — mirá qué incluye cada uno más abajo
          </p>
          <Link
            to="/empresas"
            className="mt-4 inline-block rounded-full border px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
          >
            Empezar prueba gratis →
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Plan Básico */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-6 text-center">
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          Plan Básico
        </p>
        <h2 className="mt-1 text-2xl font-semibold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          <span className="tabular">$20.000</span>
          <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
            {' '}
            /mes
          </span>
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Todo lo que necesitás para gestionar las finanzas de tu negocio día a día.
        </p>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_BASICO.map((f) => (
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

      <section className="mb-6">
        <p className="mb-2 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Así se ve el dashboard de tu negocio
        </p>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <img src="/landing-dashboard-empresas.png" alt="Dashboard financiero de FinCorp para empresas" className="w-full" />
        </div>
      </section>

      <section className="mb-16">
        <p className="mb-2 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Organizador semanal de cobranzas y pagos
        </p>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <img src="/landing-cobranzas-pagos.png" alt="Organizador semanal de cobranzas y pagos de FinCorp" className="w-full" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Plan Medio */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="mb-6 rounded-2xl p-6 text-center sm:p-8"
        style={{ background: 'color-mix(in srgb, var(--series-blue) 6%, var(--surface-1))' }}
      >
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          Plan Medio
        </p>
        <h2 className="mt-1 text-2xl font-semibold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          <span className="tabular">$50.000</span>
          <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
            {' '}
            /mes
          </span>
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Todo lo del plan Básico, más herramientas de CFO para anticiparte a los problemas financieros.
        </p>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_MEDIO.map((f) => (
          <div
            key={f.titulo}
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--series-blue)', background: 'color-mix(in srgb, var(--series-blue) 4%, var(--surface-1))' }}
          >
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

      <section className="mb-6">
        <p className="mb-2 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Comprobantes: ventas, compras, margen e IVA
        </p>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <img src="/landing-comprobantes.png" alt="Comprobantes en FinCorp Medio: indicadores de cobro y pago, ventas y compras netas por mes" className="w-full" />
        </div>
      </section>

      <section className="mb-16">
        <p className="mb-2 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Presupuesto vs. Real, con desvío por categoría
        </p>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <img src="/landing-presupuesto-real.png" alt="Presupuesto vs Real en FinCorp Medio" className="w-full" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Plan Full */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="mb-6 rounded-2xl p-6 text-center sm:p-8"
        style={{
          background: 'color-mix(in srgb, var(--series-blue) 10%, var(--surface-1))',
          border: '1px solid var(--series-blue)',
        }}
      >
        <p className="text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          ⭐ Plan Full
        </p>
        <h2 className="mt-1 text-2xl font-semibold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          <span className="tabular">$100.000</span>
          <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
            {' '}
            /mes
          </span>
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Todo lo del plan Medio, más el sistema de gestión que usás todos los días: facturás, liquidás
          sueldos, movés stock y llevás la caja. Cuanto más lo usás, mejor quedan tus indicadores de CFO —
          se arman solos con lo que vas cargando, sin cargar nada dos veces.
        </p>
      </section>

      <section className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_FULL.map((f) => (
          <div
            key={f.titulo}
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--series-blue)', background: 'color-mix(in srgb, var(--series-blue) 4%, var(--surface-1))' }}
          >
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

      <section className="mb-6">
        <p className="mb-2 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Facturación electrónica: te guiamos para habilitar tu CUIT ante ARCA
        </p>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <img
            src="/landing-facturacion-electronica.png"
            alt="Circuito de habilitación para facturar electrónicamente en FinCorp, con los comandos ya armados con el CUIT del contribuyente"
            className="w-full"
          />
        </div>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          El trámite ante ARCA se hace una sola vez y es el que más gente traba. Cada etapa viene con sus
          pasos, los comandos ya armados con tu CUIT, y el aviso de dónde se equivoca todo el mundo.
        </p>
      </section>

      <section className="mb-16">
        <p className="mb-2 text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Sueldos: de la nómina al recibo y al libro de sueldos
        </p>
        <div className="overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <img
            src="/landing-sueldos.png"
            alt="Módulo de sueldos de FinCorp: nómina vigente, costo para la empresa, pago de netos y cargas sociales, y libro de sueldos"
            className="w-full"
          />
        </div>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cada empleado se arma como su recibo, separando remunerativos de no remunerativos. Cuando cerrás
          el período, los recibos quedan numerados y el mes entra al libro. Y lo que pagás sale de la cuenta
          que elijas, así que Tesorería queda al día sola.
        </p>
      </section>

      <section
        className="mb-10 rounded-xl border p-6 text-center"
        style={{ borderColor: 'var(--series-blue)', background: 'color-mix(in srgb, var(--series-blue) 6%, var(--surface-1))' }}
      >
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          ¿Listo para ordenar las finanzas de tu negocio?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Empezá con 15 días gratis y acceso Full completo, sin tarjeta. Si preferís hablar antes,
          escribime por WhatsApp y te cuento cuál de los planes se ajusta mejor a tu negocio.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/empresas"
            className="inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--series-blue)' }}
          >
            Empezar prueba gratis de 15 días
          </Link>
          <a
            href={buildWhatsAppLink(mensajeWhatsApp)}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#25D366' }}
          >
            Consultar por WhatsApp
          </a>
        </div>
      </section>
    </>
  )
}
