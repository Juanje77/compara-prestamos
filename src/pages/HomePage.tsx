import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck2,
  Check,
  CreditCard,
  FileSpreadsheet,
  HardHat,
  Inbox,
  Landmark,
  LineChart,
  Package,
  Receipt,
  Ruler,
  Target,
  Wallet,
  Workflow,
} from 'lucide-react'
import { buildWhatsAppLink } from '../components/WhatsAppContact'

// Paleta y tipografía editorial (referencia Officevibe/Workleap) — deliberadamente local a esta
// página. El resto de la app usa su propio sistema de tokens (--series-blue, --surface-*, con
// soporte claro/oscuro); esta portada es una pieza de marketing de tema claro fijo, así que no
// tiene sentido tocar los tokens globales por ella.
const C = {
  navy: '#0c1754',
  cobalt: '#2545ff',
  charcoal: '#171417',
  canvas: '#f9f8f6',
  paper: '#ffffff',
  cream: '#f0e9e1',
  graphite: '#222222',
  stone: '#6f6d68',
  lavender: '#eaebf8',
}

const serif: CSSProperties = { fontFamily: "'Fraunces', ui-serif, Georgia, serif" }
const sans: CSSProperties = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }

interface Feature {
  icon: LucideIcon
  titulo: string
  texto: string
}

const FEATURES_BASICO: Feature[] = [
  { icon: Wallet, titulo: 'Ingresos y gastos diarios', texto: 'Cargá tus ventas con el medio de cobro (efectivo, transferencia, QR, débito, crédito) y tus gastos día a día.' },
  { icon: Landmark, titulo: 'Cuentas bancarias y deudas', texto: 'Cargá el saldo de cada cuenta y tus deudas pendientes, con un indicador de endeudamiento.' },
  { icon: BarChart3, titulo: 'Indicadores clave', texto: 'Margen operativo, runway de caja, punto de equilibrio y endeudamiento, con semáforo y explicación de cada uno.' },
  { icon: LineChart, titulo: 'Flujo de caja proyectado', texto: 'Proyección de tu saldo mes a mes, con alerta si te vas a quedar sin caja.' },
  { icon: CalendarCheck2, titulo: 'Cobranzas y pagos semanales', texto: 'Organizá qué cobrás y pagás cada una de las próximas 4 semanas, con progreso.' },
  { icon: FileSpreadsheet, titulo: 'Informe y Excel', texto: 'Importá tus cuentas a cobrar desde Excel y descargá un informe financiero con gráficos, listo para imprimir.' },
]

const FEATURES_MEDIO: Feature[] = [
  { icon: Inbox, titulo: 'Comprobantes', texto: 'Importá tus facturas desde ARCA y mirá ventas, compras, margen y tus principales clientes y proveedores.' },
  { icon: Target, titulo: 'Presupuesto vs. Real', texto: 'Comparás lo presupuestado contra lo que realmente gastaste, con el desvío por categoría y comentarios automáticos.' },
  { icon: BarChart3, titulo: 'Proyección con escenarios', texto: 'Sumá una tasa de crecimiento mensual esperada, con escenarios optimista y pesimista, no solo lineal.' },
  { icon: Bell, titulo: 'Alertas y recomendaciones', texto: 'Avisos si tu caja se agota, una deuda está por vencer, o tu margen se pone negativo, con qué hacer al respecto.' },
  { icon: Calculator, titulo: 'IVA e Ingresos Brutos', texto: 'Posición de IVA e Ingresos Brutos mes a mes, con alícuota y retenciones editables para que cuadre con lo declarado en ARCA.' },
  { icon: Building2, titulo: 'Patrimonio y bienes', texto: 'Sumá tus bienes realizables (inversiones, inmuebles, vehículos) y mirá tu runway extendido ante un quiebre de caja.' },
]

const FEATURES_FULL: Feature[] = [
  { icon: Receipt, titulo: 'Facturación electrónica', texto: 'Emitís facturas A, B y C con CAE sin salir del sistema, y notas de crédito atadas a la factura que corrigen. Te guiamos paso a paso para habilitar tu CUIT ante ARCA.' },
  { icon: HardHat, titulo: 'Sueldos y cargas sociales', texto: 'Recibos numerados con todo lo que exige el art. 140 de la LCT, libro de sueldos, aguinaldo, y cada descuento con la base sobre la que se calcula.' },
  { icon: BookOpen, titulo: 'Cuentas corrientes', texto: 'Saldo por cliente y proveedor, con pagos parciales que se van imputando solos a la factura más antigua.' },
  { icon: Ruler, titulo: 'Márgenes por sector', texto: 'Cuánto deja realmente cada división de tu negocio, con el costo de la mano de obra repartido por porcentaje entre las tareas de cada empleado.' },
  { icon: Package, titulo: 'Stock', texto: 'Catálogo de productos con costo y precio, movimientos de entrada y salida, y aviso cuando algo baja del mínimo.' },
  { icon: CreditCard, titulo: 'Gestión de cheques', texto: 'Vinculados a tus facturas y cuentas corrientes, para armar tu balance contable sin cargar todo dos veces.' },
  { icon: Workflow, titulo: 'Todo integrado', texto: 'Un sistema de uso diario: cada cheque, sueldo o anticipo que cargás actualiza solo tus indicadores de CFO, sin pasos extra.' },
]

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold" style={{ ...sans, color: C.charcoal, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
      {children}
    </p>
  )
}

/** El acento itálico en serif adentro de un título sans/serif — la firma tipográfica de esta
 * referencia: una frase que "se dobla" en vez de todo el título gritando en mayúscula o negrita. */
function Accent({ children }: { children: ReactNode }) {
  return (
    <em className="not-italic" style={{ ...serif, fontStyle: 'italic', color: C.cobalt }}>
      {children}
    </em>
  )
}

function PillButton({
  href,
  to,
  variante = 'primario',
  children,
  className = '',
  style,
  target,
  rel,
}: {
  href?: string
  to?: string
  variante?: 'primario' | 'secundario' | 'oscuro'
  children: ReactNode
  className?: string
  style?: CSSProperties
  target?: string
  rel?: string
}) {
  const estilo: CSSProperties =
    variante === 'primario'
      ? { background: C.cobalt, color: '#fff' }
      : variante === 'oscuro'
        ? { background: C.paper, color: C.navy }
        : { background: 'transparent', color: C.paper, border: `1.5px solid ${C.paper}` }
  const clases = `inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-opacity hover:opacity-85 ${className}`
  if (to) {
    return (
      <Link to={to} className={clases} style={{ ...sans, ...estilo, ...style }}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target={target} rel={rel} className={clases} style={{ ...sans, ...estilo, ...style }}>
      {children}
    </a>
  )
}

function FeatureCard({ f, acento }: { f: Feature; acento?: boolean }) {
  const Icon = f.icon
  return (
    <div
      className="rounded-2xl p-6 sm:p-8"
      style={{
        background: C.paper,
        border: acento ? `1.5px solid ${C.cobalt}` : `1px solid ${C.cream}`,
      }}
    >
      <Icon size={22} strokeWidth={1.75} style={{ color: acento ? C.cobalt : C.charcoal }} aria-hidden="true" />
      <p className="mt-4 text-base font-semibold" style={{ ...sans, color: C.charcoal }}>
        {f.titulo}
      </p>
      <p className="mt-1.5 text-sm" style={{ ...sans, color: C.stone, lineHeight: 1.6 }}>
        {f.texto}
      </p>
    </div>
  )
}

function DashboardCard({ src, alt, rotar }: { src: string; alt: string; rotar?: 'left' | 'right' }) {
  return (
    <div className="relative">
      {rotar && (
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: C.navy,
            transform: rotar === 'left' ? 'rotate(-3deg) translate(-10px, 10px)' : 'rotate(3deg) translate(10px, 10px)',
          }}
          aria-hidden="true"
        />
      )}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ background: C.paper, boxShadow: '0 4px 24px rgba(12, 23, 84, 0.12)' }}
      >
        <img src={src} alt={alt} className="w-full" />
      </div>
    </div>
  )
}

function PricingTier({
  eyebrow,
  precio,
  texto,
  ctaLabel,
  acento,
  badge,
}: {
  eyebrow: string
  precio: string
  texto: string
  ctaLabel: string
  acento?: boolean
  badge?: string
}) {
  return (
    <div
      className="relative flex h-full flex-col rounded-2xl p-8 text-center sm:p-10"
      style={{
        background: acento ? C.navy : C.paper,
        border: acento ? 'none' : `1px solid ${C.cream}`,
      }}
    >
      {badge && (
        <span
          className="mx-auto mb-4 inline-flex rounded-full px-3 py-1 text-[11px] font-bold"
          style={{ ...sans, background: C.cobalt, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          {badge}
        </span>
      )}
      <Eyebrow>
        <span style={{ color: acento ? C.lavender : C.charcoal }}>{eyebrow}</span>
      </Eyebrow>
      <p className="mt-3 text-4xl font-medium" style={{ ...serif, color: acento ? C.paper : C.navy }}>
        {precio}
        <span className="text-base" style={{ ...sans, color: acento ? C.lavender : C.stone }}> /mes</span>
      </p>
      <p className="mx-auto mt-4 max-w-xs text-sm" style={{ ...sans, color: acento ? C.lavender : C.stone, lineHeight: 1.6 }}>
        {texto}
      </p>
      <div className="mt-6 flex-1" />
      <PillButton to="/empresas" variante={acento ? 'oscuro' : 'primario'} className="mx-auto">
        {ctaLabel} <ArrowRight size={15} aria-hidden="true" />
      </PillButton>
    </div>
  )
}

export function HomePage() {
  const mensajeWhatsApp = 'Hola Juan! Vi FinCorp y quiero saber más sobre el plan para empresas.'

  return (
    <div style={{ ...sans }}>
      {/* ------------------------------------------------------------------ */}
      {/* Hero */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-20 grid grid-cols-1 items-center gap-12 pt-6 sm:mb-28 sm:pt-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>Para pymes y profesionales de Argentina</Eyebrow>
          <h1 className="mt-4 text-[2.5rem] leading-[1.05] font-normal sm:text-[3.75rem]" style={{ ...serif, color: C.navy, letterSpacing: '-0.02em' }}>
            Tu <Accent>CFO virtual</Accent>, para vos y para tu negocio
          </h1>
          <p className="mt-6 max-w-lg text-base sm:text-lg" style={{ color: C.stone, lineHeight: 1.65 }}>
            Comparás préstamos de los principales bancos argentinos y gestionás las finanzas de tu empresa —
            cuentas, flujo de caja, cobranzas, sueldos, IVA— y emitís tus facturas con CAE, todo en un solo
            lugar y con explicaciones simples de cada indicador.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PillButton to="/empresas" variante="primario">
              Empezar prueba gratis <ArrowRight size={15} aria-hidden="true" />
            </PillButton>
            <PillButton to="/prestamos" variante="secundario" style={{ background: 'transparent', border: `1.5px solid ${C.cream}`, color: C.charcoal }}>
              Comparar préstamos
            </PillButton>
          </div>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium" style={{ background: C.lavender, color: C.navy }}>
            Probá el plan Full 15 días gratis, sin tarjeta
          </p>
        </div>
        <DashboardCard src="/landing-dashboard-empresas.png" alt="Dashboard financiero de FinCorp para empresas" rotar="left" />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Selector de producto */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-24 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
        <div className="rounded-2xl p-8 sm:p-10" style={{ background: C.paper, border: `1px solid ${C.cream}` }}>
          <Landmark size={26} strokeWidth={1.75} style={{ color: C.charcoal }} aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-medium" style={{ ...serif, color: C.navy }}>
            Comparador de préstamos
          </h2>
          <p className="mt-3 text-sm" style={{ color: C.stone, lineHeight: 1.6 }}>
            Personales, prendarios, hipotecarios UVA y para jubilados/ANSES. Comparamos tasas y Costo
            Financiero Total (CFT) de los principales bancos para encontrar la opción más conveniente según
            tu monto, plazo y condición laboral.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.navy }}>
            <Check size={14} aria-hidden="true" /> Gratis, sin necesidad de crear cuenta
          </p>
          <div className="mt-6">
            <PillButton to="/prestamos" variante="primario">
              Comparar préstamos <ArrowRight size={15} aria-hidden="true" />
            </PillButton>
          </div>
        </div>

        <div className="rounded-2xl p-8 sm:p-10" style={{ background: C.paper, border: `1.5px solid ${C.cobalt}` }}>
          <Calculator size={26} strokeWidth={1.75} style={{ color: C.cobalt }} aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-medium" style={{ ...serif, color: C.navy }}>
            FinCorp para empresas
          </h2>
          <p className="mt-3 text-sm" style={{ color: C.stone, lineHeight: 1.6 }}>
            Un dashboard financiero para tu negocio: cuentas bancarias, deudas, indicadores clave, flujo de
            caja proyectado y un organizador semanal de cobranzas y pagos. En el plan Full, además, liquidás
            sueldos y emitís tus facturas con CAE sin salir de acá.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.cobalt }}>
            <Check size={14} aria-hidden="true" /> 15 días gratis y después elegís tu plan
          </p>
          <div className="mt-6">
            <PillButton to="/empresas" variante="primario">
              Empezar prueba gratis <ArrowRight size={15} aria-hidden="true" />
            </PillButton>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Planes */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-20 text-center">
        <Eyebrow>Planes</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-normal sm:text-4xl" style={{ ...serif, color: C.navy }}>
          Elegí <Accent>cuánto sistema</Accent> necesita tu negocio
        </h2>
      </section>

      <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PricingTier
          eyebrow="Plan Básico"
          precio="$20.000"
          texto="Todo lo que necesitás para gestionar las finanzas de tu negocio día a día."
          ctaLabel="Empezar con el Básico"
        />
        <PricingTier
          eyebrow="Plan Medio"
          precio="$50.000"
          texto="Herramientas de CFO para anticiparte a los problemas financieros."
          ctaLabel="Empezar con el Medio"
        />
        <PricingTier
          eyebrow="Plan Full"
          precio="$100.000"
          texto="El sistema de gestión completo: facturación, sueldos, stock y caja."
          ctaLabel="Empezar con el Full"
          acento
          badge="Más completo"
        />
      </section>

      <p className="mx-auto mb-24 max-w-2xl text-center text-sm" style={{ color: C.stone }}>
        Cada plan incluye todo lo del anterior. Mirá el detalle de qué trae cada uno más abajo.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Plan Básico — detalle */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10">
        <Eyebrow>Plan Básico incluye</Eyebrow>
        <h3 className="mt-2 text-2xl font-normal sm:text-3xl" style={{ ...serif, color: C.navy }}>
          Ordená el día a día de tu negocio
        </h3>
      </section>

      <section className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_BASICO.map((f) => (
          <FeatureCard key={f.titulo} f={f} />
        ))}
      </section>

      <div className="mb-24 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <DashboardCard src="/landing-dashboard-empresas.png" alt="Dashboard financiero de FinCorp para empresas" />
        <DashboardCard src="/landing-cobranzas-pagos.png" alt="Organizador semanal de cobranzas y pagos de FinCorp" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Plan Medio — detalle */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10">
        <Eyebrow>Plan Medio incluye</Eyebrow>
        <h3 className="mt-2 text-2xl font-normal sm:text-3xl" style={{ ...serif, color: C.navy }}>
          Anticipate a los problemas, no los sufras
        </h3>
      </section>

      <section className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_MEDIO.map((f) => (
          <FeatureCard key={f.titulo} f={f} />
        ))}
      </section>

      <div className="mb-24 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <DashboardCard src="/landing-comprobantes.png" alt="Comprobantes en FinCorp Medio: indicadores de cobro y pago, ventas y compras netas por mes" />
        <DashboardCard src="/landing-presupuesto-real.png" alt="Presupuesto vs Real en FinCorp Medio" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Plan Full — detalle */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10">
        <Eyebrow>Plan Full incluye</Eyebrow>
        <h3 className="mt-2 text-2xl font-normal sm:text-3xl" style={{ ...serif, color: C.navy }}>
          El sistema que <Accent>usás todos los días</Accent>
        </h3>
      </section>

      <section className="mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES_FULL.map((f) => (
          <FeatureCard key={f.titulo} f={f} acento={f.titulo === 'Facturación electrónica'} />
        ))}
      </section>

      <div className="mb-10">
        <DashboardCard src="/landing-facturacion-electronica.png" alt="Circuito de habilitación para facturar electrónicamente en FinCorp, con los comandos ya armados con el CUIT del contribuyente" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm" style={{ color: C.stone, lineHeight: 1.6 }}>
          El trámite ante ARCA se hace una sola vez y es el que más gente traba. Cada etapa viene con sus
          pasos, los comandos ya armados con tu CUIT, y el aviso de dónde se equivoca todo el mundo.
        </p>
      </div>

      <div className="mb-24">
        <DashboardCard src="/landing-sueldos.png" alt="Módulo de sueldos de FinCorp: nómina vigente, costo para la empresa, pago de netos y cargas sociales, y libro de sueldos" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm" style={{ color: C.stone, lineHeight: 1.6 }}>
          Cada empleado se arma como su recibo, separando remunerativos de no remunerativos. Cuando cerrás
          el período, los recibos quedan numerados y el mes entra al libro. Y lo que pagás sale de la cuenta
          que elijas, así que Tesorería queda al día sola.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Cierre */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10 rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-20" style={{ background: C.navy }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-normal sm:text-4xl" style={{ ...serif, color: C.paper }}>
          ¿Listo para <Accent>ordenar</Accent> las finanzas de tu negocio?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base" style={{ color: C.lavender, lineHeight: 1.6 }}>
          Empezá con 15 días gratis y acceso Full completo, sin tarjeta. Si preferís hablar antes,
          escribime por WhatsApp y te cuento cuál de los planes se ajusta mejor a tu negocio.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <PillButton to="/empresas" variante="oscuro">
            Empezar prueba gratis de 15 días <ArrowRight size={15} aria-hidden="true" />
          </PillButton>
          <PillButton href={buildWhatsAppLink(mensajeWhatsApp)} target="_blank" rel="noreferrer" variante="secundario">
            Consultar por WhatsApp
          </PillButton>
        </div>
      </section>
    </div>
  )
}
