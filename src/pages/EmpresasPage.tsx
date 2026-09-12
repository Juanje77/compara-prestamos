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
import { Proveedores } from '../components/Proveedores'
import { Cheques } from '../components/Cheques'
import { PosicionIva } from '../components/PosicionIva'
import {
  CATEGORIAS_GASTO,
  calcularCoberturaDeuda,
  calcularCuotaDeudaTotal,
  calcularDeudaTotal,
  calcularDesvios,
  calcularEndeudamientoMeses,
  calcularGastosTotales,
  calcularMargenBrutoTotal,
  calcularMargenOperativo,
  calcularPosicionIvaPorMes,
  calcularPromedioComprasMensual,
  calcularPromedioVentasMensual,
  calcularPuntoEquilibrio,
  calcularRanking,
  calcularRealEfectivoPorMes,
  calcularResumenMensual,
  calcularRunwayMeses,
  calcularSaldoTotalBancos,
  calcularVentasComprasDelMes,
  generarAlertas,
  listarProveedores,
  proyectarFlujoCaja,
  type CategoriaGasto,
  type Cheque,
  type ClasificacionesProveedores,
  type CuentaBancaria,
  type Deuda as DeudaTipo,
  type EstadoCheque,
  type Factura,
} from '../lib/cfo'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import { descargarInformeFinanciero, descargarInformeSaludFinanciera } from '../lib/pdf'
import { cargarNegocioData, guardarNegocioData } from '../lib/negocioData'
import { cargarDatosUsuario, guardarDatosUsuario } from '../lib/userSync'
import { useAuth } from '../lib/AuthContext'

function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const CATEGORIAS_CONFIG = CATEGORIAS_GASTO

function mesActualISO(): string {
  return new Date().toISOString().slice(0, 7)
}

const SECCIONES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'cobranzas', label: 'Cobranzas y pagos' },
  { key: 'presupuesto', label: 'Presupuesto vs. Real' },
  { key: 'facturas', label: 'Salud financiera' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'cheques', label: 'Cheques' },
  { key: 'iva', label: 'Posición de IVA' },
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
  const [realManualPorMes, setRealManualPorMes] = useState<Record<string, Record<string, number>>>(
    () => cargarNegocioData()?.realManualPorMes ?? {},
  )
  const [mesPresupuesto, setMesPresupuesto] = useState(() => mesActualISO())
  const [facturas, setFacturas] = useState<Factura[]>(() => cargarNegocioData()?.facturas ?? [])
  const [clasificaciones, setClasificaciones] = useState<ClasificacionesProveedores>(
    () => cargarNegocioData()?.clasificaciones ?? {},
  )
  const [cheques, setCheques] = useState<Cheque[]>(() => cargarNegocioData()?.cheques ?? [])
  const [tasaCrecimiento, setTasaCrecimiento] = useState(() => cargarNegocioData()?.tasaCrecimiento ?? 0)
  const [nombreNegocio, setNombreNegocio] = useState(() => cargarNegocioData()?.nombreNegocio ?? '')

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
          setRealManualPorMes(d.realManualPorMes ?? {})
          setFacturas(d.facturas ?? [])
          setClasificaciones(d.clasificaciones ?? {})
          setCheques(d.cheques ?? [])
          setTasaCrecimiento(d.tasaCrecimiento ?? 0)
          setNombreNegocio(d.nombreNegocio ?? '')
        }
      })
      .catch(() => {
        // Firestore puede no estar disponible todavía (proyecto recién creado, sin conexión, etc.)
        // — seguimos con los datos locales sin romper nada.
      })
      .finally(() => setNubeLista(true))
  }, [user])

  useEffect(() => {
    guardarNegocioData({
      ingresos,
      meses,
      montos,
      cuentas,
      deudas,
      realManualPorMes,
      facturas,
      clasificaciones,
      cheques,
      tasaCrecimiento,
      nombreNegocio,
    })
  }, [
    ingresos,
    meses,
    montos,
    cuentas,
    deudas,
    realManualPorMes,
    facturas,
    clasificaciones,
    cheques,
    tasaCrecimiento,
    nombreNegocio,
  ])

  useEffect(() => {
    if (!user || !nubeLista) return
    const timeout = setTimeout(() => {
      guardarDatosUsuario(user.uid, {
        negocioData: {
          ingresos,
          meses,
          montos,
          cuentas,
          deudas,
          realManualPorMes,
          facturas,
          clasificaciones,
          cheques,
          tasaCrecimiento,
          nombreNegocio,
        },
      }).catch(() => {
        // Idem: si falla el guardado en la nube, los datos siguen a salvo en localStorage.
      })
    }, 800)
    return () => clearTimeout(timeout)
  }, [
    user,
    nubeLista,
    ingresos,
    meses,
    montos,
    cuentas,
    deudas,
    realManualPorMes,
    facturas,
    clasificaciones,
    cheques,
    tasaCrecimiento,
    nombreNegocio,
  ])

  function cambiarMonto(key: string, monto: number) {
    setMontos((prev) => ({ ...prev, [key]: monto }))
  }

  function cambiarReal(key: string, monto: number) {
    setRealManualPorMes((prev) => ({
      ...prev,
      [mesPresupuesto]: { ...(prev[mesPresupuesto] ?? {}), [key]: monto },
    }))
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

  function handleAgregarFactura(factura: Omit<Factura, 'id'>) {
    setFacturas((prev) => [...prev, { ...factura, id: generarId() }])
  }

  function handleImportarFacturas(nuevas: Omit<Factura, 'id'>[]) {
    setFacturas((prev) => [...prev, ...nuevas.map((f) => ({ ...f, id: generarId() }))])
  }

  function handleCambiarFactura(
    id: string,
    cambios: Partial<Pick<Factura, 'fechaEstimadaCobroPago' | 'cumplido' | 'medioPago'>>,
  ) {
    setFacturas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)))
  }

  function handleEliminarFactura(id: string) {
    setFacturas((prev) => prev.filter((f) => f.id !== id))
  }

  function handleVaciarFacturas() {
    setFacturas([])
  }

  function handleClasificarProveedor(proveedor: string, categoria: string) {
    setClasificaciones((prev) => {
      if (!categoria) {
        const { [proveedor]: _eliminado, ...resto } = prev
        return resto
      }
      return { ...prev, [proveedor]: categoria }
    })
  }

  function handleAgregarProveedorManual(proveedor: string, categoria: string) {
    setClasificaciones((prev) => ({ ...prev, [proveedor]: categoria }))
  }

  function handleEliminarProveedorManual(proveedor: string) {
    setClasificaciones((prev) => {
      const { [proveedor]: _eliminado, ...resto } = prev
      return resto
    })
  }

  function handleAgregarCheque(cheque: Omit<Cheque, 'id'>) {
    setCheques((prev) => [...prev, { ...cheque, id: generarId() }])
  }

  function handleCambiarEstadoCheque(id: string, estado: EstadoCheque) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)))
  }

  function handleCambiarComisionCheque(id: string, comisionDescuento: number) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, comisionDescuento } : c)))
  }

  function handleEliminarCheque(id: string) {
    setCheques((prev) => prev.filter((c) => c.id !== id))
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

  // Híbrido (Premium): si hay comprobantes cargados este mes en Salud financiera, los indicadores
  // usan esos números reales en vez de la estimación manual de arriba. El desglose por categoría
  // (para Composición de gastos y Punto de equilibrio) sigue siendo siempre manual, porque un
  // comprobante importado no viene categorizado como fijo/variable.
  const mesActual = new Date().toISOString().slice(0, 7)
  const ventasComprasMes = useMemo(
    () => (esPremium ? calcularVentasComprasDelMes(facturas, mesActual) : null),
    [esPremium, facturas, mesActual],
  )
  const usaIngresosReales = ventasComprasMes?.hayVentas ?? false
  const usaGastosReales = ventasComprasMes?.hayCompras ?? false
  const ingresosEfectivos = usaIngresosReales ? ventasComprasMes!.ventasNetas : ingresos
  const gastosEfectivos = usaGastosReales ? ventasComprasMes!.comprasNetas : gastosTotales

  // La proyección de caja usa el promedio mensual de tus ventas y compras cargadas (varios meses),
  // en vez de depender de si hubo movimientos justo este mes — y si no cargaste nada, la
  // estimación manual.
  const promedioVentas = useMemo(
    () => (esPremium ? calcularPromedioVentasMensual(facturas) : null),
    [esPremium, facturas],
  )
  const promedioCompras = useMemo(
    () => (esPremium ? calcularPromedioComprasMensual(facturas) : null),
    [esPremium, facturas],
  )
  const usaPromedioVentasReal = promedioVentas?.hayDatos ?? false
  const usaPromedioComprasReal = promedioCompras?.hayDatos ?? false
  const ingresosProyeccion = usaPromedioVentasReal ? promedioVentas!.promedio : ingresos
  const gastosProyeccion = usaPromedioComprasReal ? promedioCompras!.promedio : gastosTotales

  const margenOperativo = calcularMargenOperativo(ingresosEfectivos, gastosEfectivos)
  const runwayMeses = calcularRunwayMeses(saldoInicial, gastosEfectivos)
  const endeudamientoMeses = calcularEndeudamientoMeses(deudaTotal, ingresosEfectivos)
  const puntoEquilibrio = useMemo(
    () => calcularPuntoEquilibrio(ingresosEfectivos, gastosFijos, gastosVariables),
    [ingresosEfectivos, gastosFijos, gastosVariables],
  )
  const proyeccion = useMemo(
    () => proyectarFlujoCaja(saldoInicial, ingresosProyeccion, gastosProyeccion, meses, esPremium ? tasaCrecimiento : 0),
    [saldoInicial, ingresosProyeccion, gastosProyeccion, meses, esPremium, tasaCrecimiento],
  )
  const realEfectivo = useMemo(
    () => calcularRealEfectivoPorMes(categorias, facturas, clasificaciones, realManualPorMes, mesPresupuesto),
    [categorias, facturas, clasificaciones, realManualPorMes, mesPresupuesto],
  )
  const desvios = useMemo(() => calcularDesvios(categorias, realEfectivo), [categorias, realEfectivo])
  const proveedores = useMemo(() => listarProveedores(facturas, clasificaciones), [facturas, clasificaciones])
  const coberturaDeuda = calcularCoberturaDeuda(ingresosEfectivos, cuotaDeudaTotal)
  const resumenMensual = useMemo(() => calcularResumenMensual(facturas), [facturas])
  const rankingClientes = useMemo(() => calcularRanking(facturas, 'emitida'), [facturas])
  const rankingProveedores = useMemo(() => calcularRanking(facturas, 'recibida'), [facturas])
  const margenTotal = useMemo(() => calcularMargenBrutoTotal(facturas), [facturas])
  const posicionIva = useMemo(() => calcularPosicionIvaPorMes(facturas), [facturas])
  const alertas = useMemo(
    () => generarAlertas({ margenOperativo, runwayMeses, proyeccion, deudas, facturas }),
    [margenOperativo, runwayMeses, proyeccion, deudas, facturas],
  )

  const mensajeWhatsApp = `Hola Juan! Armé mi dashboard financiero en FinCorp (margen operativo: ${formatoPorcentaje(
    margenOperativo,
  )}, runway de caja: ${runwayMeses === Infinity ? 'sin límite' : `${runwayMeses.toFixed(1)} meses`}) y quiero asesoramiento para mi negocio.`

  function handleDescargarPdf() {
    descargarInformeFinanciero({
      nombreNegocio,
      cuentas,
      deudas,
      saldoInicial,
      ingresos: ingresosEfectivos,
      categorias,
      gastosFijos,
      gastosVariables,
      gastosTotales: gastosEfectivos,
      margenOperativo,
      runwayMeses,
      puntoEquilibrio,
      deudaTotal,
      cuotaDeudaTotal,
      endeudamientoMeses,
      coberturaDeuda,
      proyeccion,
    })
  }

  function handleDescargarInformeSalud() {
    descargarInformeSaludFinanciera({ nombreNegocio, resumenMensual, rankingClientes, rankingProveedores, margenTotal })
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
            {!esPremium &&
              (s.key === 'presupuesto' ||
                s.key === 'facturas' ||
                s.key === 'proveedores' ||
                s.key === 'cheques' ||
                s.key === 'iva') &&
              ' 🔒'}
          </button>
        ))}
      </nav>

      {seccion === 'cobranzas' && (
        <CobranzasPagosSemanal
          facturas={esPremium ? facturas : undefined}
          onCambiarFactura={esPremium ? handleCambiarFactura : undefined}
        />
      )}

      {seccion === 'presupuesto' && (
        <PremiumLock
          activo={esPremium}
          titulo="Presupuesto vs. Real"
          descripcion="Cargá lo que realmente gastaste cada mes y compará automáticamente contra tu presupuesto, con el desvío en pesos y en porcentaje por categoría."
          onQuieroPremium={abrirPlanes}
        >
          <PresupuestoVsReal
            desvios={desvios}
            mes={mesPresupuesto}
            onCambiarMes={setMesPresupuesto}
            onCambiarReal={cambiarReal}
          />
        </PremiumLock>
      )}

      {seccion === 'facturas' && (
        <PremiumLock
          activo={esPremium}
          titulo="Salud financiera con tus comprobantes"
          descripcion="Importá tus facturas, notas de crédito y débito (desde ARCA o a mano) y mirá ventas y compras netas, margen bruto por mes, tus principales clientes/proveedores y qué tan sana es tu facturación."
          onQuieroPremium={abrirPlanes}
        >
          <Facturas
            facturas={facturas}
            onAgregar={handleAgregarFactura}
            onImportarVarias={handleImportarFacturas}
            onCambiar={handleCambiarFactura}
            onEliminar={handleEliminarFactura}
            onVaciar={handleVaciarFacturas}
            onDescargarInforme={handleDescargarInformeSalud}
          />
        </PremiumLock>
      )}

      {seccion === 'proveedores' && (
        <PremiumLock
          activo={esPremium}
          titulo="Proveedores"
          descripcion="Clasificá cada proveedor en una categoría de gasto para que Presupuesto vs. Real se complete solo con tus facturas recibidas."
          onQuieroPremium={abrirPlanes}
        >
          <Proveedores
            proveedores={proveedores}
            onClasificar={handleClasificarProveedor}
            onAgregarManual={handleAgregarProveedorManual}
            onEliminarManual={handleEliminarProveedorManual}
          />
        </PremiumLock>
      )}

      {seccion === 'cheques' && (
        <PremiumLock
          activo={esPremium}
          titulo="Cheques"
          descripcion="Gestioná los cheques de terceros que recibís y los propios que emitís, para ir armando junto con tus cuentas bancarias un balance contable a fin de año."
          onQuieroPremium={abrirPlanes}
        >
          <Cheques
            cheques={cheques}
            onAgregar={handleAgregarCheque}
            onCambiarEstado={handleCambiarEstadoCheque}
            onCambiarComision={handleCambiarComisionCheque}
            onEliminar={handleEliminarCheque}
          />
        </PremiumLock>
      )}

      {seccion === 'iva' && (
        <PremiumLock
          activo={esPremium}
          titulo="Posición de IVA"
          descripcion="Débito y crédito fiscal por mes, con el saldo técnico a favor arrastrado del mes anterior, a partir del IVA que cargues en cada comprobante de Salud financiera."
          onQuieroPremium={abrirPlanes}
        >
          <PosicionIva posicion={posicionIva} />
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
            {(usaIngresosReales || usaGastosReales) && (
              <p className="-mt-2 mb-4 text-xs" style={{ color: 'var(--series-blue)' }}>
                📊 Este mes ya cargaste comprobantes en Salud financiera: los indicadores de abajo usan{' '}
                {usaIngresosReales && usaGastosReales
                  ? 'esas ventas y compras reales'
                  : usaIngresosReales
                    ? 'esas ventas reales'
                    : 'esas compras reales'}{' '}
                en vez de esta estimación (que sigue sirviendo para la composición de gastos y el punto de
                equilibrio).
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Ingresos mensuales estimados
                  {usaIngresosReales && (
                    <span style={{ color: 'var(--series-blue)' }}> (no usado este mes)</span>
                  )}
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
              ingresos={ingresosProyeccion}
              usaIngresosReales={usaPromedioVentasReal}
              gastosTotales={gastosProyeccion}
              usaGastosReales={usaPromedioComprasReal}
              meses={meses}
              onCambiarMeses={setMeses}
              tasaCrecimiento={tasaCrecimiento}
              onCambiarTasaCrecimiento={setTasaCrecimiento}
              esPremium={esPremium}
              onQuierePremium={abrirPlanes}
            />
          </section>

          <div className="mb-8 flex flex-wrap items-center justify-end gap-3">
            <input
              type="text"
              placeholder="Nombre del negocio (para el informe)"
              value={nombreNegocio}
              onChange={(e) => setNombreNegocio(e.target.value)}
              className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm sm:flex-none"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleDescargarPdf}
              className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--series-blue)' }}
            >
              📊 Descargar informe financiero
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
