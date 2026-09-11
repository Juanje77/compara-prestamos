import { useEffect, useMemo, useRef, useState } from 'react'
import { FlujoDeCaja } from '../components/FlujoDeCaja'
import { GastosPorCategoria } from '../components/GastosPorCategoria'
import { KpiCard } from '../components/KpiCard'
import { CuentasBancarias } from '../components/CuentasBancarias'
import { Deudas } from '../components/Deudas'
import { CobranzasPagosSemanal } from '../components/CobranzasPagosSemanal'
import { AlertasPanel } from '../components/AlertasPanel'
import { PresupuestoVsReal } from '../components/PresupuestoVsReal'
import { Facturas } from '../components/Facturas'
import { PremiumLock } from '../components/PremiumLock'
import { PremiumUpgradeModal } from '../components/PremiumUpgradeModal'
import { buildWhatsAppLink } from '../components/WhatsAppContact'
import {
  actualizarVencimientos,
  calcularCuotaDeudaTotal,
  calcularDeudaTotal,
  calcularDesvios,
  calcularEndeudamientoMeses,
  calcularGastosTotales,
  calcularMargenOperativo,
  calcularPuntoEquilibrio,
  calcularRunwayMeses,
  calcularSaldoTotalBancos,
  generarAlertas,
  proyectarFlujoCaja,
  type CategoriaGasto,
  type CuentaBancaria,
  type Deuda as DeudaTipo,
  type EstadoFactura,
  type Factura,
} from '../lib/cfo'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import { descargarPdfDashboardEmpresa } from '../lib/pdf'
import { cargarNegocioData, guardarNegocioData } from '../lib/negocioData'
import { cargarDatosUsuario, guardarDatosUsuario } from '../lib/userSync'
import { useAuth } from '../lib/AuthContext'

function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface CategoriaConfig {
  key: string
  label: string
  tipo: CategoriaGasto['tipo']
  color: string
  default: number
}

const CATEGORIAS_CONFIG: CategoriaConfig[] = [
  { key: 'sueldos', label: 'Sueldos y cargas sociales', tipo: 'fijo', color: 'var(--series-blue)', default: 2500000 },
  { key: 'alquiler', label: 'Alquiler', tipo: 'fijo', color: 'var(--series-2)', default: 600000 },
  { key: 'servicios', label: 'Servicios (luz, gas, internet)', tipo: 'fijo', color: 'var(--series-3)', default: 300000 },
  { key: 'impuestos', label: 'Impuestos', tipo: 'fijo', color: 'var(--series-4)', default: 600000 },
  { key: 'seguros', label: 'Seguros y otros gastos fijos', tipo: 'fijo', color: 'var(--series-5)', default: 300000 },
  { key: 'insumos', label: 'Insumos / mercadería', tipo: 'variable', color: 'var(--series-6)', default: 1500000 },
  { key: 'otros', label: 'Otros gastos variables', tipo: 'variable', color: 'var(--series-7)', default: 500000 },
]

const SECCIONES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'cobranzas', label: 'Cobranzas y pagos' },
  { key: 'presupuesto', label: 'Presupuesto vs. Real' },
  { key: 'facturas', label: 'Facturas' },
] as const

type Seccion = (typeof SECCIONES)[number]['key']

interface Props {
  esPremium: boolean
}

export function EmpresasPage({ esPremium }: Props) {
  const { user } = useAuth()
  const [seccion, setSeccion] = useState<Seccion>('dashboard')
  const [mostrarPlanes, setMostrarPlanes] = useState(false)
  const [ingresos, setIngresos] = useState(() => cargarNegocioData()?.ingresos ?? 7000000)
  const [meses, setMeses] = useState(() => cargarNegocioData()?.meses ?? 6)
  const [montos, setMontos] = useState<Record<string, number>>(() => {
    const defaults = Object.fromEntries(CATEGORIAS_CONFIG.map((c) => [c.key, c.default]))
    const guardados = cargarNegocioData()?.montos
    return guardados ? { ...defaults, ...guardados } : defaults
  })
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>(() => {
    const guardadas = cargarNegocioData()?.cuentas
    return guardadas && guardadas.length > 0
      ? guardadas
      : [{ id: generarId(), nombre: 'Cuenta corriente principal', saldo: 2000000 }]
  })
  const [deudas, setDeudas] = useState<DeudaTipo[]>(() => cargarNegocioData()?.deudas ?? [])
  const [real, setReal] = useState<Record<string, number>>(() => cargarNegocioData()?.real ?? {})
  const [facturas, setFacturas] = useState<Factura[]>(() =>
    actualizarVencimientos(cargarNegocioData()?.facturas ?? []),
  )
  const [tasaCrecimiento, setTasaCrecimiento] = useState(() => cargarNegocioData()?.tasaCrecimiento ?? 0)

  // Sincronización con Firestore: solo empieza a escribir en la nube después de intentar
  // leer lo que el usuario ya tenía guardado, para no pisarlo con los valores por defecto.
  const [nubeLista, setNubeLista] = useState(false)
  const cargaNubeHecha = useRef(false)

  useEffect(() => {
    if (!user) {
      setNubeLista(false)
      cargaNubeHecha.current = false
      return
    }
    if (cargaNubeHecha.current) return
    cargaNubeHecha.current = true
    cargarDatosUsuario(user.uid)
      .then((datos) => {
        if (datos?.negocioData) {
          const d = datos.negocioData
          setIngresos(d.ingresos)
          setMeses(d.meses)
          setMontos((prev) => ({ ...prev, ...d.montos }))
          setCuentas(d.cuentas)
          setDeudas(d.deudas)
          setReal(d.real ?? {})
          setFacturas(actualizarVencimientos(d.facturas ?? []))
          setTasaCrecimiento(d.tasaCrecimiento ?? 0)
        }
      })
      .catch(() => {
        // Firestore puede no estar disponible todavía (proyecto recién creado, sin conexión, etc.)
        // — seguimos con los datos locales sin romper nada.
      })
      .finally(() => setNubeLista(true))
  }, [user])

  useEffect(() => {
    guardarNegocioData({ ingresos, meses, montos, cuentas, deudas, real, facturas, tasaCrecimiento })
  }, [ingresos, meses, montos, cuentas, deudas, real, facturas, tasaCrecimiento])

  useEffect(() => {
    if (!user || !nubeLista) return
    const timeout = setTimeout(() => {
      guardarDatosUsuario(user.uid, {
        negocioData: { ingresos, meses, montos, cuentas, deudas, real, facturas, tasaCrecimiento },
      }).catch(() => {
        // Idem: si falla el guardado en la nube, los datos siguen a salvo en localStorage.
      })
    }, 800)
    return () => clearTimeout(timeout)
  }, [user, nubeLista, ingresos, meses, montos, cuentas, deudas, real, facturas, tasaCrecimiento])

  function cambiarMonto(key: string, monto: number) {
    setMontos((prev) => ({ ...prev, [key]: monto }))
  }

  function cambiarReal(key: string, monto: number) {
    setReal((prev) => ({ ...prev, [key]: monto }))
  }

  function handleAgregarCuenta(nombre: string, saldo: number) {
    setCuentas((prev) => [...prev, { id: generarId(), nombre, saldo }])
  }

  function handleCambiarSaldoCuenta(id: string, saldo: number) {
    setCuentas((prev) => prev.map((c) => (c.id === id ? { ...c, saldo } : c)))
  }

  function handleEliminarCuenta(id: string) {
    setCuentas((prev) => prev.filter((c) => c.id !== id))
  }

  function handleAgregarDeuda(concepto: string, montoAdeudado: number, cuotaMensual: number, proximoVencimiento?: string) {
    setDeudas((prev) => [...prev, { id: generarId(), concepto, montoAdeudado, cuotaMensual, proximoVencimiento }])
  }

  function handleEliminarDeuda(id: string) {
    setDeudas((prev) => prev.filter((d) => d.id !== id))
  }

  function handleAgregarFactura(factura: Omit<Factura, 'id' | 'estado'>) {
    setFacturas((prev) => actualizarVencimientos([...prev, { ...factura, id: generarId(), estado: 'pendiente' }]))
  }

  function handleCambiarEstadoFactura(id: string, estado: EstadoFactura) {
    setFacturas((prev) => prev.map((f) => (f.id === id ? { ...f, estado } : f)))
  }

  function handleEliminarFactura(id: string) {
    setFacturas((prev) => prev.filter((f) => f.id !== id))
  }

  const categorias: CategoriaGasto[] = CATEGORIAS_CONFIG.map((c) => ({
    key: c.key,
    label: c.label,
    tipo: c.tipo,
    color: c.color,
    monto: montos[c.key] ?? 0,
  }))

  const { fijos: gastosFijos, variables: gastosVariables, total: gastosTotales } = calcularGastosTotales(categorias)
  const saldoInicial = calcularSaldoTotalBancos(cuentas)
  const deudaTotal = calcularDeudaTotal(deudas)
  const cuotaDeudaTotal = calcularCuotaDeudaTotal(deudas)

  const margenOperativo = calcularMargenOperativo(ingresos, gastosTotales)
  const runwayMeses = calcularRunwayMeses(saldoInicial, gastosTotales)
  const endeudamientoMeses = calcularEndeudamientoMeses(deudaTotal, ingresos)
  const puntoEquilibrio = useMemo(
    () => calcularPuntoEquilibrio(ingresos, gastosFijos, gastosVariables),
    [ingresos, gastosFijos, gastosVariables],
  )
  const proyeccion = useMemo(
    () => proyectarFlujoCaja(saldoInicial, ingresos, gastosTotales, meses, esPremium ? tasaCrecimiento : 0),
    [saldoInicial, ingresos, gastosTotales, meses, esPremium, tasaCrecimiento],
  )
  const desvios = useMemo(() => calcularDesvios(categorias, real), [categorias, real])
  const alertas = useMemo(
    () => generarAlertas({ margenOperativo, runwayMeses, proyeccion, deudas, facturas }),
    [margenOperativo, runwayMeses, proyeccion, deudas, facturas],
  )

  const mensajeWhatsApp = `Hola Juan! Armé mi dashboard financiero en FinCorp (margen operativo: ${formatoPorcentaje(
    margenOperativo,
  )}, runway de caja: ${runwayMeses === Infinity ? 'sin límite' : `${runwayMeses.toFixed(1)} meses`}) y quiero asesoramiento para mi negocio.`

  function handleDescargarPdf() {
    descargarPdfDashboardEmpresa({
      cuentas,
      deudas,
      saldoInicial,
      ingresos,
      categorias,
      gastosFijos,
      gastosVariables,
      gastosTotales,
      margenOperativo,
      runwayMeses,
      puntoEquilibrio,
      deudaTotal,
      endeudamientoMeses,
      proyeccion,
    })
  }

  function abrirPlanes() {
    setMostrarPlanes(true)
  }

  return (
    <>
      <div className="mb-8">
        <p className="mt-1 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🧮 FinCorp para empresas
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          Gestioná las finanzas de tu negocio, sin ser financista
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cargá los números estimados de tu negocio una sola vez y armamos tu tablero: indicadores clave,
          composición de gastos y proyección de caja.
        </p>
        {user && (
          <p className="mt-2 text-xs" style={{ color: nubeLista ? 'var(--status-good-text)' : 'var(--text-muted)' }}>
            {nubeLista ? '☁️ Guardado en tu cuenta' : 'Sincronizando con tu cuenta…'}
          </p>
        )}
      </div>

      <nav className="mb-6 flex flex-wrap gap-2" role="tablist">
        {SECCIONES.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={seccion === s.key}
            onClick={() => setSeccion(s.key)}
            className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            style={
              seccion === s.key
                ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }
            }
          >
            {s.label}
            {!esPremium && (s.key === 'presupuesto' || s.key === 'facturas') && ' 🔒'}
          </button>
        ))}
      </nav>

      {seccion === 'cobranzas' && <CobranzasPagosSemanal />}

      {seccion === 'presupuesto' && (
        <PremiumLock
          activo={esPremium}
          titulo="Presupuesto vs. Real"
          descripcion="Cargá lo que realmente gastaste cada mes y compará automáticamente contra tu presupuesto, con el desvío en pesos y en porcentaje por categoría."
          onQuieroPremium={abrirPlanes}
        >
          <PresupuestoVsReal desvios={desvios} onCambiarReal={cambiarReal} />
        </PremiumLock>
      )}

      {seccion === 'facturas' && (
        <PremiumLock
          activo={esPremium}
          titulo="Gestión de facturas y comprobantes"
          descripcion="Cargá tus facturas emitidas y recibidas, seguí su estado (pendiente, cobrada, pagada o vencida) y mirá de un vistazo cuánto tenés por cobrar y por pagar."
          onQuieroPremium={abrirPlanes}
        >
          <Facturas
            facturas={facturas}
            onAgregar={handleAgregarFactura}
            onCambiarEstado={handleCambiarEstadoFactura}
            onEliminar={handleEliminarFactura}
          />
        </PremiumLock>
      )}

      {seccion === 'dashboard' && (
        <>
          {esPremium ? (
            <AlertasPanel alertas={alertas} />
          ) : (
            <button
              onClick={abrirPlanes}
              className="mb-6 flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--series-blue)' }}
            >
              🔒 Con Premium recibís alertas automáticas sobre tu caja, deudas y facturas vencidas
            </button>
          )}

          <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CuentasBancarias
              cuentas={cuentas}
              onAgregar={handleAgregarCuenta}
              onCambiarSaldo={handleCambiarSaldoCuenta}
              onEliminar={handleEliminarCuenta}
            />
            <Deudas deudas={deudas} onAgregar={handleAgregarDeuda} onEliminar={handleEliminarDeuda} />
          </section>

          <section
            className="mb-6 rounded-xl border p-5"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
          >
            <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ingresos y gastos mensuales
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Ingresos mensuales estimados
                </span>
                <input
                  type="number"
                  value={ingresos}
                  onChange={(e) => setIngresos(Number(e.target.value))}
                  className="tabular mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-semibold"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
              </label>

              <div className="hidden sm:block" />

              {CATEGORIAS_CONFIG.map((c) => (
                <label className="block" key={c.key}>
                  <span
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                    {c.label}
                    <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>
                      ({c.tipo})
                    </span>
                  </span>
                  <input
                    type="number"
                    value={montos[c.key] ?? 0}
                    onChange={(e) => cambiarMonto(c.key, Number(e.target.value))}
                    className="tabular mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-semibold"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                  />
                </label>
              ))}
            </div>
            {cuotaDeudaTotal > 0 && (
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                Nota: cargaste {formatoMoneda(cuotaDeudaTotal)}/mes en cuotas de deudas — verificá que estén
                incluidas en alguno de los gastos fijos de arriba.
              </p>
            )}
          </section>

          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Margen operativo"
              value={formatoPorcentaje(margenOperativo)}
              status={margenOperativo >= 15 ? 'good' : margenOperativo >= 0 ? 'warning' : 'critical'}
              statusLabel={
                margenOperativo >= 15
                  ? 'Margen saludable'
                  : margenOperativo >= 0
                    ? 'Margen ajustado'
                    : 'Estás perdiendo plata cada mes'
              }
            />
            <KpiCard
              label="Runway de caja"
              value={runwayMeses === Infinity ? '∞' : `${runwayMeses.toFixed(1)} meses`}
              status={runwayMeses >= 6 ? 'good' : runwayMeses >= 3 ? 'warning' : 'critical'}
              statusLabel="Si el ingreso cayera a cero, así de lejos llega tu caja"
            />
            <KpiCard
              label="Punto de equilibrio"
              value={puntoEquilibrio.alcanzable ? formatoMoneda(puntoEquilibrio.ingresosNecesarios) : 'No alcanzable'}
              status={
                !puntoEquilibrio.alcanzable
                  ? 'critical'
                  : ingresos >= puntoEquilibrio.ingresosNecesarios
                    ? 'good'
                    : 'warning'
              }
              statusLabel={
                !puntoEquilibrio.alcanzable
                  ? 'Los gastos variables superan tus ingresos'
                  : ingresos >= puntoEquilibrio.ingresosNecesarios
                    ? 'Ya superaste el punto de equilibrio'
                    : `Te faltan ${formatoMoneda(puntoEquilibrio.ingresosNecesarios - ingresos)} en ventas/mes`
              }
            />
            <KpiCard
              label="Endeudamiento"
              value={deudaTotal <= 0 ? 'Sin deudas' : endeudamientoMeses === Infinity ? '∞' : `${endeudamientoMeses.toFixed(1)} meses de ingreso`}
              status={deudaTotal <= 0 || endeudamientoMeses <= 3 ? 'good' : endeudamientoMeses <= 6 ? 'warning' : 'critical'}
              statusLabel={
                deudaTotal <= 0
                  ? 'No cargaste deudas pendientes'
                  : `Deuda total: ${formatoMoneda(deudaTotal)}`
              }
            />
          </section>

          <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GastosPorCategoria categorias={categorias} />
            <FlujoDeCaja
              saldoInicial={saldoInicial}
              ingresos={ingresos}
              gastosTotales={gastosTotales}
              meses={meses}
              onCambiarMeses={setMeses}
              tasaCrecimiento={tasaCrecimiento}
              onCambiarTasaCrecimiento={setTasaCrecimiento}
              esPremium={esPremium}
              onQuierePremium={abrirPlanes}
            />
          </section>

          <div className="mb-8 flex justify-end">
            <button
              onClick={handleDescargarPdf}
              className="rounded-full border px-5 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              📄 Descargar dashboard en PDF
            </button>
          </div>

          <section
            className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                ¿Querés armar esto con tus números reales?
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                A partir de este tablero armamos juntos un plan financiero concreto para tu negocio.
              </p>
            </div>
            <a
              href={buildWhatsAppLink(mensajeWhatsApp)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#25D366' }}
            >
              Pedir asesoría por WhatsApp
            </a>
          </section>

          <p className="border-t pt-6 pb-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Estimación simplificada con fines orientativos: asume ingresos y gastos constantes mes a mes, sin
            estacionalidad, y un punto de equilibrio donde los gastos variables escalan linealmente con las ventas.
            No reemplaza un análisis financiero profesional de tu negocio.
          </p>
        </>
      )}

      {mostrarPlanes && <PremiumUpgradeModal onCerrar={() => setMostrarPlanes(false)} />}
    </>
  )
}
