import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatoMoneda } from '../lib/finance'
import type { PlanTier } from '../lib/plan'
import { ETIQUETA_PROMOCION, PRECIOS, porcentajeDescuento } from '../lib/precios'
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
  Users,
  Wallet,
  Workflow,
} from 'lucide-react'
import { buildWhatsAppLink } from '../components/WhatsAppContact'

// Paleta y tipografía editorial (referencia Officevibe/Workleap) — deliberadamente separada del
// sistema de tokens del resto de la app (--series-blue, --surface-*), con sus propios tokens
// --land-* en index.css que sí responden a modo claro/oscuro. `navy`/`paper` son roles de TEXTO
// (títulos, precio); para fondos siempre oscuros (la tarjeta del plan Full, el cierre) se usa
// `darkSurface` + los colores fijos `onDark`/`onDarkMuted`, porque esas superficies son oscuras
// en los dos temas y no deben invertirse con el resto de la página.
const C = {
  navy: 'var(--land-heading)',
  cobalt: 'var(--land-cobalt)',
  charcoal: 'var(--land-charcoal)',
  paper: 'var(--land-paper)',
  cream: 'var(--land-border)',
  stone: 'var(--land-body)',
  tintBg: 'var(--land-tint-bg)',
  tintText: 'var(--land-tint-text)',
  darkSurface: 'var(--land-dark-surface)',
  onDark: '#ffffff',
  onDarkMuted: '#c3c2b7',
}

const serif: CSSProperties = { fontFamily: "'Fraunces', ui-serif, Georgia, serif" }
const sans: CSSProperties = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }

interface Feature {
  icon: LucideIcon
  titulo: string
  texto: string
}

const FEATURES_BASICO: Feature[] = [
  { icon: Wallet, titulo: 'Ingresos y gastos diarios', texto: 'Cargá tus ventas con el medio de cobro (efectivo, transferencia, QR, débito, crédito) y tus gastos día a día, marcando qué facturaste y qué no.' },
  { icon: Calculator, titulo: 'Monotributo', texto: 'En qué categoría estás según tus últimos 12 meses, en cuál vas a quedar en la próxima recategorización y cuánto te sale la cuota.' },
  { icon: Calculator, titulo: 'Ingresos Brutos', texto: 'Tu posición mes a mes, con alícuota y retenciones editables para que cuadre con lo declarado.' },
  { icon: Users, titulo: 'Clientes y proveedores', texto: 'Se arman solos con lo que cargás: el total y la cantidad de operaciones de cada uno, y los proveedores clasificados por categoría de gasto.' },
  { icon: Landmark, titulo: 'Cuentas bancarias y deudas', texto: 'Cargá el saldo de cada cuenta y tus deudas pendientes, con un indicador de endeudamiento.' },
  { icon: BarChart3, titulo: 'Indicadores clave', texto: 'Margen operativo, runway de caja, punto de equilibrio y endeudamiento, con semáforo y explicación de cada uno.' },
  { icon: LineChart, titulo: 'Flujo de caja proyectado', texto: 'Proyección de tu saldo mes a mes, con alerta si te vas a quedar sin caja.' },
  { icon: CalendarCheck2, titulo: 'Cobranzas y pagos semanales', texto: 'Organizá qué cobrás y pagás cada una de las próximas 4 semanas, con progreso.' },
  { icon: FileSpreadsheet, titulo: 'Informe y Excel', texto: 'Importá tus cuentas a cobrar desde Excel y descargá un informe financiero con gráficos, listo para imprimir.' },
]

const FEATURES_MEDIO: Feature[] = [
  { icon: Inbox, titulo: 'Comprobantes', texto: 'Cargá cada factura emitida y recibida, o importalas desde ARCA, y mirá ventas, compras, margen e IVA discriminado. Con eso, Clientes, Proveedores y Monotributo dejan de depender de la carga diaria.' },
  { icon: Target, titulo: 'Presupuesto vs. Real', texto: 'Comparás lo presupuestado contra lo que realmente gastaste, con el desvío por categoría y comentarios automáticos.' },
  { icon: BarChart3, titulo: 'Proyección con escenarios', texto: 'Sumá una tasa de crecimiento mensual esperada, con escenarios optimista y pesimista, no solo lineal.' },
  { icon: Bell, titulo: 'Alertas y recomendaciones', texto: 'Avisos si tu caja se agota, una deuda está por vencer, o tu margen se pone negativo, con qué hacer al respecto.' },
  { icon: Calculator, titulo: 'Posición de IVA', texto: 'Débito y crédito fiscal mes a mes, con el saldo a pagar o a favor, y ajustes manuales para que cuadre con lo declarado en ARCA.' },
  { icon: Building2, titulo: 'Patrimonio y bienes', texto: 'Sumá tus bienes realizables (inversiones, inmuebles, vehículos) y mirá tu runway extendido ante un quiebre de caja.' },
]

const FEATURES_FULL: Feature[] = [
  { icon: Receipt, titulo: 'Facturación electrónica', texto: 'Emitís facturas A, B y C con CAE sin salir del sistema, y notas de crédito atadas a la factura que corrigen. Te guiamos paso a paso para habilitar tu CUIT ante ARCA.' },
  { icon: HardHat, titulo: 'Sueldos y cargas sociales', texto: 'Cargá cada empleado con su sueldo bruto y las cargas sociales a cargo de la empresa, con aguinaldo automático y el costo repartido por sector.' },
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
  // 'oscuro' y el 'secundario' por defecto son para botones que van SOBRE una superficie
  // siempre oscura (la tarjeta del plan Full, el cierre) — sus colores quedan fijos a propósito,
  // no serían legibles si heredaran los tokens de tema claro/oscuro de la página.
  const estilo: CSSProperties =
    variante === 'primario'
      ? { background: C.cobalt, color: '#fff' }
      : variante === 'oscuro'
        ? { background: '#ffffff', color: '#0c1754' }
        : { background: 'transparent', color: '#ffffff', border: '1.5px solid #ffffff' }
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
            background: C.darkSurface,
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
  plan,
  texto,
  ctaLabel,
  acento,
  badge,
}: {
  eyebrow: string
  plan: PlanTier
  texto: string
  ctaLabel: string
  acento?: boolean
  badge?: string
}) {
  const p = PRECIOS[plan]
  const descuento = porcentajeDescuento(p)
  return (
    <div
      className="relative flex h-full flex-col rounded-2xl p-8 text-center sm:p-10"
      style={{
        background: acento ? C.darkSurface : C.paper,
        border: acento ? '1px solid var(--land-cobalt)' : `1px solid ${C.cream}`,
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
        <span style={{ color: acento ? C.onDarkMuted : C.charcoal }}>{eyebrow}</span>
      </Eyebrow>
      {descuento > 0 && (
        <p className="mt-3 text-sm" style={{ ...sans, color: acento ? C.onDarkMuted : C.stone }}>
          <span style={{ textDecoration: 'line-through' }}>{formatoMoneda(p.precioLista!)}</span>{' '}
          <span className="font-semibold" style={{ color: acento ? C.onDark : C.cobalt }}>
            {descuento}% OFF
          </span>
        </p>
      )}
      <p
        className={`text-4xl font-medium ${descuento > 0 ? 'mt-1' : 'mt-3'}`}
        style={{ ...serif, color: acento ? C.onDark : C.navy }}
      >
        {formatoMoneda(p.precio)}
        <span className="text-base" style={{ ...sans, color: acento ? C.onDarkMuted : C.stone }}> /mes</span>
      </p>
      {descuento > 0 && (
        <p className="mt-1 text-xs" style={{ ...sans, color: acento ? C.onDarkMuted : C.stone }}>
          {ETIQUETA_PROMOCION}
        </p>
      )}
      <p className="mx-auto mt-4 max-w-xs text-sm" style={{ ...sans, color: acento ? C.onDarkMuted : C.stone, lineHeight: 1.6 }}>
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
            Comparás préstamos de los principales bancos argentinos, gestionás las finanzas de tu empresa —
            cuentas, flujo de caja, cobranzas, sueldos, impuestos— emitís tus facturas con CAE, y ponés a
            trabajar la plata que te sobra. Todo en un solo lugar y con explicaciones simples de cada
            indicador.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PillButton to="/empresas" variante="primario">
              Empezar prueba gratis <ArrowRight size={15} aria-hidden="true" />
            </PillButton>
            <PillButton to="/prestamos" variante="secundario" style={{ background: 'transparent', border: `1.5px solid ${C.cream}`, color: C.charcoal }}>
              Comparar préstamos
            </PillButton>
          </div>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium" style={{ background: C.tintBg, color: C.tintText }}>
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
      {/* Asesoramiento financiero */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="mb-24 rounded-3xl px-6 py-12 sm:px-12 sm:py-16"
        style={{ background: C.paper, border: `1px solid ${C.cream}` }}
      >
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Asesoramiento financiero</Eyebrow>
            <h2 className="mt-4 text-3xl font-normal sm:text-4xl" style={{ ...serif, color: C.navy }}>
              La plata quieta <Accent>pierde valor</Accent> todos los meses
            </h2>
            <p className="mt-5 text-base" style={{ color: C.stone, lineHeight: 1.65 }}>
              El sistema ya sabe cuánta caja tenés y cuánto necesitás para operar tranquilo. Con eso te
              dice cuánto te sobra de verdad, y de ahí en más te acompaño yo: abrís tu cuenta de inversión
              y elegimos juntos dónde poner ese excedente según cuándo lo vas a necesitar.
            </p>
            <p className="mt-4 text-sm" style={{ color: C.stone, lineHeight: 1.6 }}>
              Las operaciones se hacen a través de Balanz Capital, agente registrado ante la Comisión
              Nacional de Valores. La cuenta queda a tu nombre y la plata la movés vos.
            </p>
            <div className="mt-7">
              <PillButton to="/empresas" variante="primario">
                Ver mi excedente <ArrowRight size={15} aria-hidden="true" />
              </PillButton>
            </div>
          </div>

          <ul className="space-y-4">
            {[
              {
                titulo: 'Primero, cuánto te sobra',
                texto:
                  'Tu caja menos el colchón de gastos fijos que quieras mantener. Si todavía no lo cubrís, te lo decimos: eso va antes que cualquier inversión.',
              },
              {
                titulo: 'Después, para cuándo lo necesitás',
                texto:
                  'No es lo mismo la plata de la semana que viene que la que podés dejar dos años. El plazo define el instrumento, más que cualquier otra cosa.',
              },
              {
                titulo: 'Y recién ahí, dónde ponerlo',
                texto:
                  'Lo definimos hablando, mirando tu caso. Ningún cálculo automático reemplaza esa conversación, y no hay instrumento que sirva para todos.',
              },
            ].map((paso) => (
              <li
                key={paso.titulo}
                className="rounded-2xl p-5"
                style={{ background: C.cream, border: `1px solid ${C.cream}` }}
              >
                <p className="text-sm font-semibold" style={{ color: C.navy }}>
                  {paso.titulo}
                </p>
                <p className="mt-1 text-sm" style={{ color: C.stone, lineHeight: 1.6 }}>
                  {paso.texto}
                </p>
              </li>
            ))}
          </ul>
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
          plan="basico"
          texto="Todo lo que necesitás para gestionar las finanzas de tu negocio día a día."
          ctaLabel="Empezar con el Básico"
        />
        <PricingTier
          eyebrow="Plan Medio"
          plan="premium"
          texto="Herramientas de CFO para anticiparte a los problemas financieros."
          ctaLabel="Empezar con el Medio"
        />
        <PricingTier
          eyebrow="Plan Full"
          plan="full"
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
        <DashboardCard src="/landing-sueldos.png" alt="Módulo de sueldos de FinCorp: nómina vigente, costo para la empresa, reparto por sector y pago de sueldos y cargas sociales" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm" style={{ color: C.stone, lineHeight: 1.6 }}>
          Cargá cada empleado con su sueldo bruto y las cargas sociales a cargo de la empresa, repartí el
          costo por sector si hace varias tareas, y lo que pagás sale de la cuenta que elijas — así
          Tesorería queda al día sola.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Cierre */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10 rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-20" style={{ background: C.darkSurface }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-normal sm:text-4xl" style={{ ...serif, color: C.onDark }}>
          ¿Listo para <Accent>ordenar</Accent> las finanzas de tu negocio?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base" style={{ color: C.onDarkMuted, lineHeight: 1.6 }}>
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
