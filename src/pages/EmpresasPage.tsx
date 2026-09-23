import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Calculator, ChevronDown, Cloud, FileDown, Lock } from 'lucide-react'
import { FlujoDeCaja } from '../components/FlujoDeCaja'
import { GastosPorCategoria } from '../components/GastosPorCategoria'
import { KpiCard } from '../components/KpiCard'
import { CuentasBancarias } from '../components/CuentasBancarias'
import { Deudas } from '../components/Deudas'
import { CobranzasPagosSemanal } from '../components/CobranzasPagosSemanal'
import { AlertasPanel } from '../components/AlertasPanel'
import { Recomendaciones } from '../components/Recomendaciones'
import { PresupuestoVsReal } from '../components/PresupuestoVsReal'
import { Facturas } from '../components/Facturas'
import { PremiumLock } from '../components/PremiumLock'
import { PremiumUpgradeModal } from '../components/PremiumUpgradeModal'
import { buildWhatsAppLink } from '../components/WhatsAppContact'
import { Proveedores } from '../components/Proveedores'
import { Clientes } from '../components/Clientes'
import { Cheques } from '../components/Cheques'
import { PosicionIva } from '../components/PosicionIva'
import { PosicionIngresosBrutos } from '../components/PosicionIngresosBrutos'
import { Monotributo } from '../components/Monotributo'
import { IngresosGastos } from '../components/IngresosGastos'
import { InputMoneda } from '../components/InputMoneda'
import { Patrimonio } from '../components/Patrimonio'
import { Backup } from '../components/Backup'
import { Ayuda } from '../components/Ayuda'
import { CuentasCorrientes } from '../components/CuentasCorrientes'
import { RemitosPresupuestos } from '../components/RemitosPresupuestos'
import { MargenesPorSector, type PeriodoMargenes } from '../components/MargenesPorSector'
import { Sueldos } from '../components/Sueldos'
import { FacturacionElectronica } from '../components/FacturacionElectronica'
import { Stock } from '../components/Stock'
import { Tesoreria } from '../components/Tesoreria'
import { PuntoDeVenta, type VentaMostrador } from '../components/PuntoDeVenta'
import {
  CATEGORIAS_GASTO,
  agruparCuentaCorriente,
  aplicarMovimientoStock,
  aplicarMovimientoTesoreria,
  buscarCoincidenciasAutomaticas,
  calcularValorInventario,
  calcularCoberturaDeuda,
  calcularCuotaDeudaTotal,
  calcularDeudaTotal,
  calcularDesvios,
  calcularDesvioVentas,
  calcularEndeudamientoMeses,
  calcularGastosTotales,
  calcularMargenBrutoTotal,
  calcularMargenOperativo,
  calcularMargenPorSector,
  DATOS_EMISOR_FISCAL_VACIOS,
  calcularAguinaldo,
  calcularNominaTotal,
  calcularPagosSueldos,
  gastosAguinaldoProyectados,
  idOrigenPagoSueldos,
  CONCEPTO_PAGO_SUELDOS_LABEL,
  calcularMontoPagado,
  calcularAgingCuentas,
  calcularDSOyDPO,
  calcularPosicionIngresosBrutosPorMes,
  calcularPosicionIvaPorMes,
  calcularPromediosMensualesReales,
  calcularPuntoEquilibrio,
  calcularRanking,
  calcularRealAutomaticoPorMes,
  calcularRealEfectivoPorMes,
  calcularRunwayExtendido,
  calcularRunwayMeses,
  calcularSaldoFactura,
  calcularSaldoTotalBancos,
  cuentaPorFactura,
  calcularTendenciaMensual,
  calcularValorTotalBienes,
  generarAlertas,
  generarRecomendaciones,
  facturaDesdeMovimientoDiario,
  listarMovimientosDiarios,
  generarMovimientosDeFactura,
  generarMovimientosDeRemito,
  imputarPagoAFIFO,
  listarClientes,
  listarProveedores,
  listarRemitosPendientes,
  proyectarFlujoCaja,
  proyectarFlujoCajaEscenarios,
  revertirMovimientoStock,
  revertirMovimientoTesoreria,
  vincularRemitoAFactura,
  type Anticipo,
  type Bien,
  type CategoriaGasto,
  type Cheque,
  type ClasificacionesProveedores,
  type CuentaBancaria,
  type ConceptoPagoSueldos,
  type DatosEmisorFiscal,
  type DatosReceptor,
  type ResultadoEmision,
  type Deuda as DeudaTipo,
  type Empleado,
  type EstadoCheque,
  type IngresosBrutosManualMes,
  type IvaManualMes,
  type Factura,
  type MedioPago,
  type MovimientoBancario,
  type MovimientoDiario,
  type MovimientoStock,
  type MovimientoTesoreria,
  type Pago,
  type Producto,
  type RemitoPresupuesto,
  type Sector,
  type TipoFactura,
  type TipoMovimientoStock,
} from '../lib/cfo'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import { exportarParaContador } from '../lib/contadorExport'
import { abrirInformeFinanciero, abrirInformeSaludFinanciera } from '../lib/htmlReport'
import { cargarNegocioData, guardarNegocioData, negocioDataTieneCarga, type NegocioData } from '../lib/negocioData'
import { DATOS_MONOTRIBUTO_VACIOS, type DatosMonotributo } from '../lib/monotributo'
import {
  guardarDatosUsuario,
  suscribirseADatosUsuario,
  guardarBackupAutomaticoSiHaceFalta,
  cargarBackupAutomatico,
  type BackupAutomaticoEntry,
} from '../lib/userSync'
import { numeroComprobanteFormateado } from '../lib/facturacionElectronica'
import { useAuth } from '../lib/AuthContext'

function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const CATEGORIAS_CONFIG = CATEGORIAS_GASTO

function mesActualISO(): string {
  return new Date().toISOString().slice(0, 7)
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const SECCIONES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'facturas', label: 'Comprobantes' },
  { key: 'puntoDeVenta', label: 'Punto de venta' },
  { key: 'facturacionElectronica', label: 'Facturación electrónica' },
  { key: 'ingresosGastos', label: 'Ingresos y gastos' },
  { key: 'cobranzas', label: 'Cobranzas y pagos' },
  { key: 'cuentasCorrientes', label: 'Cuentas corrientes' },
  { key: 'remitos', label: 'Remitos y presupuestos' },
  { key: 'margenes', label: 'Márgenes por sector' },
  { key: 'sueldos', label: 'Sueldos' },
  { key: 'stock', label: 'Stock' },
  { key: 'tesoreria', label: 'Tesorería' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'presupuesto', label: 'Presupuesto vs. Real' },
  { key: 'cheques', label: 'Cheques' },
  { key: 'iva', label: 'Posición de IVA' },
  { key: 'iibb', label: 'Ingresos Brutos' },
  { key: 'monotributo', label: 'Monotributo' },
  { key: 'patrimonio', label: 'Patrimonio' },
  { key: 'backup', label: 'Backup' },
  { key: 'ayuda', label: 'Ayuda' },
] as const

/** Secciones exclusivas del plan Full (el sistema de gestión de uso diario) — el resto que
 * requiere pago sigue disponible desde el plan Medio. */
const SECCIONES_FULL = new Set(['facturacionElectronica', 'puntoDeVenta', 'cuentasCorrientes', 'remitos', 'margenes', 'sueldos', 'cheques', 'stock', 'tesoreria'])

type Seccion = (typeof SECCIONES)[number]['key']

/** Las que se usan a diario quedan sueltas, siempre a un clic — incluye "Ingresos y gastos"
 * porque es la pantalla principal del plan Básico, que todavía no tiene Comprobantes. El resto
 * se agrupa por tema detrás de un desplegable, para no tener 19 solapas todas al mismo nivel —
 * ver el <nav> más abajo. */
const SECCIONES_SUELTAS: Seccion[] = ['dashboard', 'facturas', 'ingresosGastos']

const GRUPOS: { key: string; label: string; secciones: Seccion[] }[] = [
  {
    key: 'ventas',
    label: 'Ventas y compras',
    secciones: ['puntoDeVenta', 'facturacionElectronica', 'cobranzas', 'cuentasCorrientes', 'remitos', 'margenes', 'clientes', 'proveedores', 'presupuesto'],
  },
  { key: 'tesoreria', label: 'Tesorería y stock', secciones: ['tesoreria', 'cheques', 'stock'] },
  { key: 'rrhh', label: 'RRHH', secciones: ['sueldos'] },
  { key: 'impuestos', label: 'Impuestos', secciones: ['iva', 'iibb', 'monotributo'] },
  { key: 'negocio', label: 'Negocio', secciones: ['patrimonio', 'backup', 'ayuda'] },
]

interface Props {
  esPremium: boolean
  /** Plan Full (arriba de Medio) — desbloquea Cuentas corrientes, Remitos/presupuestos y
   * Cheques, el sistema de gestión de uso diario. */
  esFull?: boolean
}

export function EmpresasPage({ esPremium, esFull = false }: Props) {
  const { user } = useAuth()
  const [seccion, setSeccionRaw] = useState<Seccion>('dashboard')
  // Qué grupo del menú está desplegado — null si ninguno. Cambiar de sección por cualquier vía
  // (clic en el menú, o un atajo como "Ir a Tesorería" desde el Dashboard) abre el grupo que la
  // contiene, para que el usuario no pierda de vista en qué grupo quedó parado.
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null)
  function setSeccion(s: Seccion) {
    setSeccionRaw(s)
    setGrupoAbierto(GRUPOS.find((g) => (g.secciones as Seccion[]).includes(s))?.key ?? null)
  }
  function seccionBloqueada(key: Seccion): boolean {
    return SECCIONES_FULL.has(key)
      ? !esFull
      : !esPremium &&
        (['presupuesto', 'facturas', 'proveedores', 'clientes', 'iva', 'iibb', 'monotributo', 'patrimonio'] as Seccion[]).includes(key)
  }
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
  const [bienes, setBienes] = useState<Bien[]>(() => cargarNegocioData()?.bienes ?? [])
  const [realManualPorMes, setRealManualPorMes] = useState<Record<string, Record<string, number>>>(
    () => cargarNegocioData()?.realManualPorMes ?? {},
  )
  const [ventasManualPorMes, setVentasManualPorMes] = useState<Record<string, number>>(
    () => cargarNegocioData()?.ventasManualPorMes ?? {},
  )
  const [mesPresupuesto, setMesPresupuesto] = useState(() => mesActualISO())
  const [mesMargenes, setMesMargenes] = useState(() => mesActualISO())
  const [periodoMargenes, setPeriodoMargenes] = useState<PeriodoMargenes>('mes')
  const [facturas, setFacturas] = useState<Factura[]>(() => cargarNegocioData()?.facturas ?? [])
  const [clasificaciones, setClasificaciones] = useState<ClasificacionesProveedores>(
    () => cargarNegocioData()?.clasificaciones ?? {},
  )
  const [clientesManual, setClientesManual] = useState<string[]>(() => cargarNegocioData()?.clientesManual ?? [])
  const [cheques, setCheques] = useState<Cheque[]>(() => cargarNegocioData()?.cheques ?? [])
  const [pagos, setPagos] = useState<Pago[]>(() => cargarNegocioData()?.pagos ?? [])
  const [remitos, setRemitos] = useState<RemitoPresupuesto[]>(() => cargarNegocioData()?.remitos ?? [])
  const [sectores, setSectores] = useState<Sector[]>(() => cargarNegocioData()?.sectores ?? [])
  const [empleados, setEmpleados] = useState<Empleado[]>(() => cargarNegocioData()?.empleados ?? [])
  const [datosEmisorFiscal, setDatosEmisorFiscal] = useState<DatosEmisorFiscal>(
    () => cargarNegocioData()?.datosEmisorFiscal ?? DATOS_EMISOR_FISCAL_VACIOS,
  )
  const [anticipos, setAnticipos] = useState<Anticipo[]>(() => cargarNegocioData()?.anticipos ?? [])
  const [productos, setProductos] = useState<Producto[]>(() => cargarNegocioData()?.productos ?? [])
  const [movimientosStock, setMovimientosStock] = useState<MovimientoStock[]>(
    () => cargarNegocioData()?.movimientosStock ?? [],
  )
  const [movimientosTesoreria, setMovimientosTesoreria] = useState<MovimientoTesoreria[]>(
    () => cargarNegocioData()?.movimientosTesoreria ?? [],
  )
  const [movimientosBancarios, setMovimientosBancarios] = useState<MovimientoBancario[]>(
    () => cargarNegocioData()?.movimientosBancarios ?? [],
  )
  const [ivaManualPorMes, setIvaManualPorMes] = useState<Record<string, IvaManualMes>>(
    () => cargarNegocioData()?.ivaManualPorMes ?? {},
  )
  const [ingresosBrutosManualPorMes, setIngresosBrutosManualPorMes] = useState<Record<string, IngresosBrutosManualMes>>(
    () => cargarNegocioData()?.ingresosBrutosManualPorMes ?? {},
  )
  const [movimientosDiarios, setMovimientosDiarios] = useState<MovimientoDiario[]>(
    () => cargarNegocioData()?.movimientosDiarios ?? [],
  )
  const [monotributo, setMonotributo] = useState<DatosMonotributo>(
    () => cargarNegocioData()?.monotributo ?? DATOS_MONOTRIBUTO_VACIOS,
  )
  const [tasaCrecimiento, setTasaCrecimiento] = useState(() => cargarNegocioData()?.tasaCrecimiento ?? 0)
  const [nombreNegocio, setNombreNegocio] = useState(() => cargarNegocioData()?.nombreNegocio ?? '')

  // Instante de la última EDICIÓN — el mismo valor va tanto al guardado local (inmediato) como al
  // de Firestore (debounceado 800ms). Sirve para que la carga desde la nube no pise con datos
  // viejos una edición local que todavía no llegó a viajar (ver el efecto de carga más abajo).
  //
  // Arranca con el instante que quedó guardado en localStorage, NO con Date.now(): si se
  // recalculara al abrir la app, este dispositivo se declararía más nuevo que la nube siempre, y
  // descartaría lo que se hubiera cargado desde otra computadora. Un dispositivo que nunca cargó
  // nada arranca en 0, así que la nube siempre le gana.
  const [actualizadoEn, setActualizadoEn] = useState(() => cargarNegocioData()?.actualizadoEn ?? 0)
  // Los valores tal como estaban la última vez que pasó por acá. Se compara contra ellos en vez de
  // contar renders: en desarrollo StrictMode monta el componente dos veces, y un contador tomaría
  // ese segundo montaje por una edición, moviendo el instante sin que el usuario haya tocado nada.
  const valoresPrevios = useRef<unknown[] | null>(null)
  useEffect(() => {
    const actuales = [
      ingresos, meses, montos, cuentas, deudas, bienes, realManualPorMes, ventasManualPorMes,
      facturas, clasificaciones, clientesManual, cheques, pagos, remitos, sectores, empleados,
      datosEmisorFiscal, anticipos, productos, movimientosStock,
      movimientosTesoreria, movimientosBancarios, ivaManualPorMes, ingresosBrutosManualPorMes,
      movimientosDiarios, monotributo, tasaCrecimiento, nombreNegocio,
    ]
    const previos = valoresPrevios.current
    valoresPrevios.current = actuales
    // Montaje: el instante que venía guardado sigue valiendo, no hubo edición.
    if (previos === null) return
    if (previos.every((v, i) => Object.is(v, actuales[i]))) return
    setActualizadoEn(Date.now())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ingresos, meses, montos, cuentas, deudas, bienes, realManualPorMes, ventasManualPorMes,
    facturas, clasificaciones, clientesManual, cheques, pagos, remitos, sectores, empleados,
    datosEmisorFiscal, anticipos, productos, movimientosStock,
    movimientosTesoreria, movimientosBancarios, ivaManualPorMes, ingresosBrutosManualPorMes,
    movimientosDiarios, monotributo, tasaCrecimiento, nombreNegocio,
  ])

  // Lo que muestra Ingresos y gastos sale de los comprobantes que se cargaron desde ahí — es la
  // misma información, vista como el registro diario simple que espera esa pantalla.
  const movimientosDiariosVista = useMemo(() => listarMovimientosDiarios(facturas), [facturas])

  // Con qué cuenta quedó registrado el cobro/pago de cada factura, para que el selector de
  // Comprobantes muestre la elegida en vez de volver siempre a "Cuenta…".
  const cuentasDeFacturas = useMemo(() => cuentaPorFactura(movimientosTesoreria), [movimientosTesoreria])

  // El snapshot completo del negocio — se arma una sola vez acá y de acá salen tanto el guardado
  // local como el de Firestore como la descarga de Backup, en vez de repetir la misma lista de 27
  // campos tres veces.
  const negocioDataActual: NegocioData = useMemo(
    () => ({
      ingresos, meses, montos, cuentas, deudas, bienes, realManualPorMes, ventasManualPorMes,
      facturas, clasificaciones, clientesManual, cheques, pagos, remitos, sectores, empleados,
      datosEmisorFiscal, anticipos, productos, movimientosStock,
      movimientosTesoreria, movimientosBancarios, ivaManualPorMes, ingresosBrutosManualPorMes,
      movimientosDiarios, monotributo, tasaCrecimiento, nombreNegocio, actualizadoEn,
    }),
    [
      ingresos, meses, montos, cuentas, deudas, bienes, realManualPorMes, ventasManualPorMes,
      facturas, clasificaciones, clientesManual, cheques, pagos, remitos, sectores, empleados,
      datosEmisorFiscal, anticipos, productos, movimientosStock,
      movimientosTesoreria, movimientosBancarios, ivaManualPorMes, ingresosBrutosManualPorMes,
      movimientosDiarios, monotributo, tasaCrecimiento, nombreNegocio, actualizadoEn,
    ],
  )

  // Sincronización con Firestore: solo empieza a escribir en la nube después de intentar
  // leer lo que el usuario ya tenía guardado, para no pisarlo con los valores por defecto.
  const [nubeLista, setNubeLista] = useState(false)
  const cargaNubeHecha = useRef(false)

  // Historial de backups automáticos diarios — ver guardarBackupAutomaticoSiHaceFalta en
  // userSync.ts. Llega junto con el resto de los datos del usuario, así que se actualiza solo con
  // el mismo listener de más abajo.
  const [backupsAutomaticos, setBackupsAutomaticos] = useState<BackupAutomaticoEntry[]>([])

  // Siempre el actualizadoEn más reciente que ya está en pantalla — se lee dentro del listener de
  // abajo, que se suscribe una sola vez por login y no puede depender de "actualizadoEn" directo
  // sin resuscribirse en cada cambio.
  const actualizadoEnRef = useRef(actualizadoEn)
  useEffect(() => {
    actualizadoEnRef.current = actualizadoEn
  }, [actualizadoEn])

  // Idem para saber si esta pantalla tiene algo cargado: el listener lo mira para no dejar que un
  // dispositivo vacío descarte datos reales de la nube.
  const hayCargaLocalRef = useRef(false)
  useEffect(() => {
    hayCargaLocalRef.current = negocioDataTieneCarga(negocioDataActual)
  }, [negocioDataActual])

  useEffect(() => {
    if (!user) {
      setNubeLista(false)
      cargaNubeHecha.current = false
      return
    }
    if (cargaNubeHecha.current) return
    cargaNubeHecha.current = true
    let primerDato = true
    // Escucha en vivo (no una lectura única): si la misma empresa edita desde otra pestaña o
    // dispositivo al mismo tiempo, ese cambio llega acá al instante, sin esperar a que se
    // recargue esta página — así dos ediciones simultáneas no pueden pisarse entre sí sin que
    // ninguna de las dos pantallas se entere.
    const dejarDeEscuchar = suscribirseADatosUsuario(user.uid, (datos) => {
      if (datos?.negocioData) {
        const d = datos.negocioData
        // Puede ser el eco de lo que este mismo dispositivo acaba de escribir, o una versión
        // vieja porque el guardado en Firestore está debounceado — en cualquier caso, si ya
        // tenemos algo igual de nuevo o más nuevo en pantalla, no lo pisamos.
        //
        // Y solo puede ganar una pantalla que tenga algo cargado: si acá no hay nada (un
        // dispositivo nuevo, o uno al que le limpiaron el navegador), lo de la nube entra sí o sí,
        // porque descartarlo sería perder los datos reales del usuario.
        const localMasReciente =
          hayCargaLocalRef.current &&
          actualizadoEnRef.current != null &&
          d.actualizadoEn != null &&
          actualizadoEnRef.current > d.actualizadoEn
        if (!localMasReciente) {
          setIngresos(d.ingresos)
          setMeses(d.meses)
          setMontos((prev) => ({ ...prev, ...d.montos }))
          setCuentas(d.cuentas)
          setDeudas(d.deudas)
          setBienes(d.bienes ?? [])
          setRealManualPorMes(d.realManualPorMes ?? {})
          setVentasManualPorMes(d.ventasManualPorMes ?? {})
          setFacturas(d.facturas ?? [])
          setClasificaciones(d.clasificaciones ?? {})
          setClientesManual(d.clientesManual ?? [])
          setCheques(d.cheques ?? [])
          setPagos(d.pagos ?? [])
          setRemitos(d.remitos ?? [])
          setSectores(d.sectores ?? [])
          setEmpleados(d.empleados ?? [])
          setDatosEmisorFiscal(d.datosEmisorFiscal ?? DATOS_EMISOR_FISCAL_VACIOS)
          setAnticipos(d.anticipos ?? [])
          setProductos(d.productos ?? [])
          setMovimientosStock(d.movimientosStock ?? [])
          setMovimientosTesoreria(d.movimientosTesoreria ?? [])
          setMovimientosBancarios(d.movimientosBancarios ?? [])
          setIvaManualPorMes(d.ivaManualPorMes ?? {})
          setIngresosBrutosManualPorMes(d.ingresosBrutosManualPorMes ?? {})
          setMovimientosDiarios(d.movimientosDiarios ?? [])
          setMonotributo(d.monotributo ?? DATOS_MONOTRIBUTO_VACIOS)
          setTasaCrecimiento(d.tasaCrecimiento ?? 0)
          setNombreNegocio(d.nombreNegocio ?? '')
        }
        setBackupsAutomaticos(datos.backupsIndex ?? [])
        // Se dispara con el dato recién leído de la nube (coherente entre sí, no hace falta
        // esperar a que el estado local termine de asentarse) y es best-effort: si falla, no
        // afecta nada más de la carga.
        guardarBackupAutomaticoSiHaceFalta(user.uid, d, datos.backupsIndex ?? [])
      }
      if (primerDato) {
        primerDato = false
        setNubeLista(true)
      }
    })
    return () => dejarDeEscuchar()
  }, [user])

  useEffect(() => {
    guardarNegocioData(negocioDataActual)
  }, [negocioDataActual])

  useEffect(() => {
    if (!user || !nubeLista) return
    const negocioData = negocioDataActual

    // Se manda una sola vez por snapshot: si el usuario cierra la pestaña o recarga antes de que
    // pasen los 800ms, el listener de "se está por ir" dispara el mismo envío ya, en vez de dejar
    // que se pierda con el setTimeout cancelado — es la ventana que causaba que un comprobante
    // recién cargado desapareciera al recargar rápido.
    let enviado = false
    function enviarAhora() {
      if (enviado) return
      enviado = true
      guardarDatosUsuario(user!.uid, { negocioData }).catch(() => {
        // Idem: si falla el guardado en la nube, los datos siguen a salvo en localStorage.
      })
    }

    const timeout = setTimeout(enviarAhora, 800)
    function alEsconderse() {
      if (document.visibilityState === 'hidden') enviarAhora()
    }
    document.addEventListener('visibilitychange', alEsconderse)
    window.addEventListener('pagehide', enviarAhora)

    return () => {
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', alEsconderse)
      window.removeEventListener('pagehide', enviarAhora)
    }
  }, [user, nubeLista, negocioDataActual])

  // Migración única: Ingresos y gastos guardaba sus movimientos en una lista aparte, y ahora los
  // guarda como comprobantes internos (ver facturaDesdeMovimientoDiario). Los que ya estaban
  // cargados se convierten acá, conservando su id y todos sus campos, para que no desaparezcan de
  // la pantalla al cambiar de dónde sale la lista. Espera a que la nube haya cargado —si no, se
  // correría sobre los datos locales antes de conocer los reales— y saltea los que ya estén
  // convertidos, así no puede duplicar nada si llega a correr dos veces.
  useEffect(() => {
    if (!nubeLista && user) return
    if (movimientosDiarios.length === 0) return
    setFacturas((prev) => {
      const yaConvertidos = new Set(prev.map((f) => f.id))
      const nuevas = movimientosDiarios
        .filter((m) => !yaConvertidos.has(m.id))
        .map((m) => facturaDesdeMovimientoDiario(m, m.id))
      return nuevas.length > 0 ? [...prev, ...nuevas] : prev
    })
    setMovimientosDiarios([])
  }, [nubeLista, user, movimientosDiarios])

  /** Pisa todo el negocio con lo que venga en un backup restaurado desde Backup — mismos defaults
   * que la carga inicial y la del listener de Firestore, por si el archivo es de una versión
   * vieja de FinCorp y le falta algún campo agregado después. */
  function handleRestaurarBackup(d: Partial<NegocioData>) {
    setIngresos(d.ingresos ?? 7000000)
    setMeses(d.meses ?? 6)
    setMontos({ ...Object.fromEntries(CATEGORIAS_CONFIG.map((c) => [c.key, c.default])), ...(d.montos ?? {}) })
    setCuentas(d.cuentas ?? [])
    setDeudas(d.deudas ?? [])
    setBienes(d.bienes ?? [])
    setRealManualPorMes(d.realManualPorMes ?? {})
    setVentasManualPorMes(d.ventasManualPorMes ?? {})
    setFacturas(d.facturas ?? [])
    setClasificaciones(d.clasificaciones ?? {})
    setClientesManual(d.clientesManual ?? [])
    setCheques(d.cheques ?? [])
    setPagos(d.pagos ?? [])
    setRemitos(d.remitos ?? [])
    setSectores(d.sectores ?? [])
    setEmpleados(d.empleados ?? [])
    setDatosEmisorFiscal(d.datosEmisorFiscal ?? DATOS_EMISOR_FISCAL_VACIOS)
    setAnticipos(d.anticipos ?? [])
    setProductos(d.productos ?? [])
    setMovimientosStock(d.movimientosStock ?? [])
    setMovimientosTesoreria(d.movimientosTesoreria ?? [])
    setMovimientosBancarios(d.movimientosBancarios ?? [])
    setIvaManualPorMes(d.ivaManualPorMes ?? {})
    setIngresosBrutosManualPorMes(d.ingresosBrutosManualPorMes ?? {})
    setMovimientosDiarios(d.movimientosDiarios ?? [])
    setMonotributo(d.monotributo ?? DATOS_MONOTRIBUTO_VACIOS)
    setTasaCrecimiento(d.tasaCrecimiento ?? 0)
    setNombreNegocio(d.nombreNegocio ?? '')
  }

  function handleObtenerBackupAutomatico(id: string) {
    return user ? cargarBackupAutomatico(user.uid, id) : Promise.resolve(null)
  }

  function cambiarMonto(key: string, monto: number) {
    setMontos((prev) => ({ ...prev, [key]: monto }))
  }

  function cambiarReal(key: string, monto: number) {
    setRealManualPorMes((prev) => ({
      ...prev,
      [mesPresupuesto]: { ...(prev[mesPresupuesto] ?? {}), [key]: monto },
    }))
  }

  function cambiarVentasReales(monto: number) {
    setVentasManualPorMes((prev) => ({ ...prev, [mesPresupuesto]: monto }))
  }

  function handleAgregarCuenta(nombre: string, saldo: number) {
    setCuentas((prev) => [...prev, { id: generarId(), nombre, saldo }])
  }

  function handleCambiarSaldoCuenta(id: string, saldo: number) {
    setCuentas((prev) => prev.map((c) => (c.id === id ? { ...c, saldo } : c)))
  }

  function handleEliminarCuenta(id: string) {
    const movimientosDeLaCuenta = movimientosTesoreria.filter((m) => m.cuentaId === id)
    if (movimientosDeLaCuenta.length > 0) {
      setMovimientosTesoreria((prev) => prev.filter((m) => m.cuentaId !== id))
    }
    setCuentas((prev) => prev.filter((c) => c.id !== id))
  }

  /** Ajuste manual del saldo de una cuenta en Tesorería (Full) — a diferencia de
   * handleCambiarSaldoCuenta (que pisa el número directo, usado sin Tesorería), esto registra un
   * movimiento con el monto ya con signo, para dejar rastro de por qué cambió el saldo. */
  function handleAjustarSaldoCuenta(cuentaId: string, monto: number, fecha: string, concepto: string | undefined) {
    if (!esFull || monto === 0) return
    const movimiento: MovimientoTesoreria = {
      id: generarId(),
      cuentaId,
      tipo: 'ajuste',
      monto,
      fecha,
      concepto,
      origen: 'manual',
    }
    setCuentas((prev) => aplicarMovimientoTesoreria(prev, movimiento))
    setMovimientosTesoreria((prev) => [...prev, movimiento])
  }

  /** Solo se puede borrar un movimiento "manual" — los que vienen de una factura, un anticipo o un
   * cheque se manejan (y revierten) desde su propia solapa. */
  function handleEliminarMovimientoTesoreria(id: string) {
    const movimiento = movimientosTesoreria.find((m) => m.id === id && m.origen === 'manual')
    if (!movimiento) return
    setCuentas((prev) => revertirMovimientoTesoreria(prev, movimiento))
    setMovimientosTesoreria((prev) => prev.filter((m) => m.id !== id))
  }

  /** Carga las filas de un extracto bancario como pendientes de conciliar, y de una vuelve intenta
   * emparejar automáticamente contra lo que ya está cargado en Tesorería (mismo monto, fecha
   * cercana). No agrega nada a la cuenta todavía — eso solo pasa si el usuario crea un ajuste desde
   * una fila que no matcheó con nada. */
  function handleImportarExtracto(cuentaId: string, filas: Omit<MovimientoBancario, 'id' | 'cuentaId' | 'conciliado'>[]) {
    const nuevasFilas: MovimientoBancario[] = filas.map((f) => ({ ...f, id: generarId(), cuentaId, conciliado: false }))
    const bancariosActualizados = [...movimientosBancarios, ...nuevasFilas]
    const coincidencias = buscarCoincidenciasAutomaticas(bancariosActualizados, movimientosTesoreria, cuentaId)
    const porBancarioId = new Map(coincidencias.map((c) => [c.bancarioId, c.movimientoId]))
    setMovimientosBancarios(
      bancariosActualizados.map((b) =>
        porBancarioId.has(b.id) ? { ...b, conciliado: true, movimientoTesoreriaId: porBancarioId.get(b.id) } : b,
      ),
    )
  }

  function handleConciliarManual(bancarioId: string, movimientoId: string) {
    setMovimientosBancarios((prev) =>
      prev.map((b) => (b.id === bancarioId ? { ...b, conciliado: true, movimientoTesoreriaId: movimientoId } : b)),
    )
  }

  function handleDesconciliar(bancarioId: string) {
    setMovimientosBancarios((prev) =>
      prev.map((b) => (b.id === bancarioId ? { ...b, conciliado: false, movimientoTesoreriaId: undefined } : b)),
    )
  }

  /** Una fila del banco que no tiene nada cargado del lado del sistema (un gasto, un interés) pasa
   * directo a ser un ajuste real de Tesorería, y la fila queda conciliada contra ese ajuste. Sin
   * concepto (el usuario eligió "Otro"), se usa la descripción tal cual vino del extracto. */
  function handleCrearAjusteDesdeBancario(bancarioId: string, concepto?: string) {
    if (!esFull) return
    const bancario = movimientosBancarios.find((b) => b.id === bancarioId)
    if (!bancario) return
    const movimiento: MovimientoTesoreria = {
      id: generarId(),
      cuentaId: bancario.cuentaId,
      tipo: 'ajuste',
      monto: bancario.monto,
      fecha: bancario.fecha,
      concepto: concepto ?? bancario.descripcion,
      origen: 'manual',
    }
    setCuentas((prev) => aplicarMovimientoTesoreria(prev, movimiento))
    setMovimientosTesoreria((prev) => [...prev, movimiento])
    setMovimientosBancarios((prev) =>
      prev.map((b) => (b.id === bancarioId ? { ...b, conciliado: true, movimientoTesoreriaId: movimiento.id } : b)),
    )
  }

  function handleEliminarMovimientoBancario(id: string) {
    setMovimientosBancarios((prev) => prev.filter((b) => b.id !== id))
  }

  function handleAgregarDeuda(concepto: string, montoAdeudado: number, cuotaMensual: number, proximoVencimiento?: string) {
    setDeudas((prev) => [...prev, { id: generarId(), concepto, montoAdeudado, cuotaMensual, proximoVencimiento }])
  }

  function handleEliminarDeuda(id: string) {
    setDeudas((prev) => prev.filter((d) => d.id !== id))
  }

  function handleAgregarBien(bien: Omit<Bien, 'id'>) {
    setBienes((prev) => [...prev, { ...bien, id: generarId() }])
  }

  function handleEliminarBien(id: string) {
    setBienes((prev) => prev.filter((b) => b.id !== id))
  }

  function handleAgregarFactura(factura: Omit<Factura, 'id'>) {
    const nuevaFactura: Factura = { ...factura, id: generarId() }
    setFacturas((prev) => [...prev, nuevaFactura])
    const nuevosMovimientos = generarMovimientosDeFactura(nuevaFactura, productos, generarId)
    if (nuevosMovimientos.length > 0) {
      setMovimientosStock((prev) => [...prev, ...nuevosMovimientos])
      setProductos((prev) => nuevosMovimientos.reduce((acc, mov) => aplicarMovimientoStock(acc, mov), prev))
    }
  }

  function handleImportarFacturas(nuevas: Omit<Factura, 'id'>[]) {
    setFacturas((prev) => [...prev, ...nuevas.map((f) => ({ ...f, id: generarId() }))])
  }

  /** Revierte y quita el movimiento de tesorería que se haya generado directo desde el tilde de
   * "cobrada/pagada" de una factura (no toca los que vienen de un Pago real de cuenta corriente,
   * esos se manejan desde handleEliminarPago). */
  function revertirMovimientoDirectoDeFactura(facturaId: string) {
    const movimiento = movimientosTesoreria.find((m) => m.origen === 'factura' && m.origenId === facturaId)
    if (!movimiento) return
    setCuentas((prev) => revertirMovimientoTesoreria(prev, movimiento))
    setMovimientosTesoreria((prev) => prev.filter((m) => m.id !== movimiento.id))
  }

  function handleCambiarFactura(
    id: string,
    cambios: Partial<Pick<Factura, 'fechaEstimadaCobroPago' | 'cumplido' | 'medioPago' | 'sectorId'>> & { cuentaId?: string },
  ) {
    const { cuentaId, ...cambiosFactura } = cambios
    setFacturas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambiosFactura } : f)))
    const factura = facturas.find((f) => f.id === id)
    if (cambiosFactura.medioPago === 'cheque') {
      const quedaCumplida = cambiosFactura.cumplido ?? factura?.cumplido
      if (factura && quedaCumplida) crearChequeAutomatico({ ...factura, ...cambiosFactura })
    }
    if (cambiosFactura.cumplido === false) {
      revertirMovimientoDirectoDeFactura(id)
    }
    // Solo si esta factura todavía no tiene un Pago real detrás (cuenta corriente o cheque) —
    // evita duplicar el movimiento de caja si la plata ya se registró por otro lado.
    if (cuentaId && esFull && factura && calcularMontoPagado(id, pagos) === 0) {
      const facturaActualizada = { ...factura, ...cambiosFactura }
      if (facturaActualizada.cumplido && facturaActualizada.medioPago !== 'cheque') {
        const previo = movimientosTesoreria.find((m) => m.origen === 'factura' && m.origenId === id)
        let cuentasBase = cuentas
        let movimientosBase = movimientosTesoreria
        if (previo) {
          cuentasBase = revertirMovimientoTesoreria(cuentasBase, previo)
          movimientosBase = movimientosBase.filter((m) => m.id !== previo.id)
        }
        const nuevo: MovimientoTesoreria = {
          id: generarId(),
          cuentaId,
          tipo: facturaActualizada.tipo === 'emitida' ? 'ingreso' : 'egreso',
          monto: calcularSaldoFactura(facturaActualizada, pagos),
          fecha: facturaActualizada.fechaEstimadaCobroPago ?? facturaActualizada.fecha,
          concepto: `${facturaActualizada.tipo === 'emitida' ? 'Cobro' : 'Pago'} factura — ${facturaActualizada.contraparte}`,
          origen: 'factura',
          origenId: id,
        }
        setCuentas(aplicarMovimientoTesoreria(cuentasBase, nuevo))
        setMovimientosTesoreria([...movimientosBase, nuevo])
      }
    }
  }

  function handleEliminarFactura(id: string) {
    revertirMovimientoDirectoDeFactura(id)
    const movimientosDeLaFactura = movimientosStock.filter((m) => m.facturaId === id)
    if (movimientosDeLaFactura.length > 0) {
      setProductos((prev) => movimientosDeLaFactura.reduce((acc, mov) => revertirMovimientoStock(acc, mov), prev))
      setMovimientosStock((prev) => prev.filter((m) => m.facturaId !== id))
    }
    setFacturas((prev) => prev.filter((f) => f.id !== id))
  }

  function handleVaciarFacturas() {
    setFacturas([])
  }

  /**
   * Cobro del mostrador (ver PuntoDeVenta): deja registrado un comprobante emitido y ya cobrado,
   * con el stock descontado y —si eligieron cuenta— la plata entrando a Tesorería. Va todo junto
   * acá en vez de encadenar handleAgregarFactura + handleCambiarFactura porque ese segundo paso
   * busca la factura en el estado, y la recién creada todavía no llegó ahí.
   */
  function handleCobrarEnMostrador(venta: VentaMostrador) {
    const factura: Factura = {
      id: generarId(),
      tipo: 'emitida',
      tipoComprobante: 'factura',
      contraparte: venta.contraparte,
      monto: venta.monto,
      fecha: hoyISO(),
      cumplido: true,
      medioPago: venta.medioPago,
      lineas: venta.lineas,
      esInterna: venta.esInterna || undefined,
    }
    setFacturas((prev) => [...prev, factura])

    const movimientos = generarMovimientosDeFactura(factura, productos, generarId)
    if (movimientos.length > 0) {
      setMovimientosStock((prev) => [...prev, ...movimientos])
      setProductos((prev) => movimientos.reduce((acc, mov) => aplicarMovimientoStock(acc, mov), prev))
    }

    if (venta.cuentaId && esFull) {
      const movimiento: MovimientoTesoreria = {
        id: generarId(),
        cuentaId: venta.cuentaId,
        tipo: 'ingreso',
        monto: venta.monto,
        fecha: factura.fecha,
        concepto: `Venta de mostrador — ${venta.contraparte}`,
        origen: 'factura',
        origenId: factura.id,
      }
      setCuentas((prev) => aplicarMovimientoTesoreria(prev, movimiento))
      setMovimientosTesoreria((prev) => [...prev, movimiento])
    }
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

  function handleAgregarClienteManual(cliente: string) {
    setClientesManual((prev) => (prev.includes(cliente) ? prev : [...prev, cliente]))
  }

  function handleEliminarClienteManual(cliente: string) {
    setClientesManual((prev) => prev.filter((c) => c !== cliente))
  }

  /** Si una factura se marca cobrada/pagada con cheque desde cualquier lado (el tilde de
   * Comprobantes/Cobranzas, o un pago a cuenta en Cuentas corrientes) y todavía no tiene un
   * cheque cargado que la cubra, le crea uno automáticamente en la solapa Cheques — banco y
   * número quedan vacíos para completar a mano. */
  function crearChequeAutomatico(factura: Factura) {
    if (!esFull) return
    const yaTieneCheque = cheques.some((c) => c.facturasIds?.includes(factura.id))
    if (yaTieneCheque) return
    setCheques((prev) => [
      ...prev,
      {
        id: generarId(),
        tipo: factura.tipo === 'emitida' ? 'recibido' : 'emitido',
        banco: '',
        contraparte: factura.contraparte,
        monto: factura.monto,
        fechaEmision: factura.fecha,
        fechaCobro: factura.fechaEstimadaCobroPago ?? factura.fecha,
        estado: 'cartera',
        facturasIds: [factura.id],
      },
    ])
  }

  function handleAgregarCheque(cheque: Omit<Cheque, 'id'>) {
    const id = generarId()
    setCheques((prev) => [...prev, { ...cheque, id }])
    if (cheque.facturasIds && cheque.facturasIds.length > 0) {
      const idsFactura = new Set(cheque.facturasIds)
      const nuevosPagos: Pago[] = facturas
        .filter((f) => idsFactura.has(f.id))
        .map((f) => ({
          id: generarId(),
          facturaId: f.id,
          monto: calcularSaldoFactura(f, pagos),
          fecha: cheque.fechaCobro,
          medioPago: 'cheque',
          chequeId: id,
        }))
      setPagos((prev) => [...prev, ...nuevosPagos])
      setFacturas((prev) =>
        prev.map((f) => (idsFactura.has(f.id) ? { ...f, cumplido: true, medioPago: 'cheque' } : f)),
      )
    }
    sincronizarTesoreriaCheque({ ...cheque, id })
  }

  /** La plata de un cheque recién entra/sale de una cuenta real cuando se cobra o se vende (no
   * cuando solo está "en cartera") — este helper recalcula el movimiento de tesorería del cheque
   * cada vez que cambia su estado, su cuenta o su comisión, revirtiendo el anterior si había uno. */
  function sincronizarTesoreriaCheque(cheque: Cheque) {
    if (!esFull) return
    const anterior = movimientosTesoreria.find((m) => m.origen === 'cheque' && m.origenId === cheque.id)
    let cuentasBase = cuentas
    let movimientosBase = movimientosTesoreria
    if (anterior) {
      cuentasBase = revertirMovimientoTesoreria(cuentasBase, anterior)
      movimientosBase = movimientosBase.filter((m) => m.id !== anterior.id)
    }
    const corresponde = (cheque.estado === 'cobrado' || cheque.estado === 'vendido') && cheque.cuentaId
    if (corresponde) {
      const monto = cheque.monto - (cheque.estado === 'vendido' ? (cheque.comisionDescuento ?? 0) : 0)
      if (monto > 0) {
        const nuevo: MovimientoTesoreria = {
          id: generarId(),
          cuentaId: cheque.cuentaId!,
          tipo: cheque.tipo === 'recibido' ? 'ingreso' : 'egreso',
          monto,
          fecha: hoyISO(),
          concepto: `Cheque ${cheque.tipo === 'recibido' ? 'cobrado de' : 'pagado a'} ${cheque.contraparte}`,
          origen: 'cheque',
          origenId: cheque.id,
        }
        cuentasBase = aplicarMovimientoTesoreria(cuentasBase, nuevo)
        movimientosBase = [...movimientosBase, nuevo]
      }
    }
    setCuentas(cuentasBase)
    setMovimientosTesoreria(movimientosBase)
  }

  function handleCambiarEstadoCheque(id: string, estado: EstadoCheque) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)))
    const cheque = cheques.find((c) => c.id === id)
    if (estado === 'rechazado') {
      // Un cheque rebotado no saldó nada: revertimos las facturas que había cubierto.
      if (cheque?.facturasIds && cheque.facturasIds.length > 0) {
        const idsFactura = new Set(cheque.facturasIds)
        setPagos((prev) => prev.filter((p) => p.chequeId !== id))
        setFacturas((prev) =>
          prev.map((f) => (idsFactura.has(f.id) ? { ...f, cumplido: false, medioPago: undefined } : f)),
        )
      }
    }
    if (cheque) sincronizarTesoreriaCheque({ ...cheque, estado })
  }

  function handleCambiarCuentaCheque(id: string, cuentaId: string | undefined) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, cuentaId } : c)))
    const cheque = cheques.find((c) => c.id === id)
    if (cheque) sincronizarTesoreriaCheque({ ...cheque, cuentaId })
  }

  function handleCambiarComisionCheque(id: string, comisionDescuento: number) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, comisionDescuento } : c)))
    const cheque = cheques.find((c) => c.id === id)
    if (cheque) sincronizarTesoreriaCheque({ ...cheque, comisionDescuento })
  }

  function handleEliminarCheque(id: string) {
    const cheque = cheques.find((c) => c.id === id)
    if (cheque?.facturasIds && cheque.facturasIds.length > 0) {
      const idsFactura = new Set(cheque.facturasIds)
      setPagos((prev) => prev.filter((p) => p.chequeId !== id))
      setFacturas((prev) =>
        prev.map((f) => (idsFactura.has(f.id) ? { ...f, cumplido: false, medioPago: undefined } : f)),
      )
    }
    const movimiento = movimientosTesoreria.find((m) => m.origen === 'cheque' && m.origenId === id)
    if (movimiento) {
      setCuentas((prev) => revertirMovimientoTesoreria(prev, movimiento))
      setMovimientosTesoreria((prev) => prev.filter((m) => m.id !== movimiento.id))
    }
    setCheques((prev) => prev.filter((c) => c.id !== id))
  }

  function handleAplicarPagoCuenta(
    contraparte: string,
    tipo: TipoFactura,
    monto: number,
    fecha: string,
    medioPago: MedioPago | undefined,
    cuentaId?: string,
  ) {
    const grupo = (tipo === 'emitida' ? cuentaCorrienteCobrar : cuentaCorrientePagar).find(
      (g) => g.contraparte === contraparte,
    )
    if (!grupo || monto <= 0) return
    const { pagos: nuevosPagos, facturaIdsCubiertas } = imputarPagoAFIFO(
      grupo.facturas,
      monto,
      fecha,
      medioPago,
      generarId,
      cuentaId,
    )
    if (nuevosPagos.length === 0) return
    setPagos((prev) => [...prev, ...nuevosPagos])
    if (facturaIdsCubiertas.length > 0) {
      const cubiertas = new Set(facturaIdsCubiertas)
      setFacturas((prev) =>
        prev.map((f) => (cubiertas.has(f.id) ? { ...f, cumplido: true, medioPago: medioPago ?? f.medioPago } : f)),
      )
      if (medioPago === 'cheque') {
        for (const facturaId of facturaIdsCubiertas) {
          const factura = grupo.facturas.find((f) => f.id === facturaId)
          if (factura) crearChequeAutomatico(factura)
        }
      }
    }
    // El cheque genera su propio movimiento de tesorería recién cuando se cobra/vende — acá solo
    // se registra la plata que efectivamente entró/salió por caja o transferencia.
    if (cuentaId && esFull && medioPago !== 'cheque') {
      const nuevosMovimientos: MovimientoTesoreria[] = nuevosPagos.map((p) => ({
        id: generarId(),
        cuentaId,
        tipo: tipo === 'emitida' ? 'ingreso' : 'egreso',
        monto: p.monto,
        fecha: p.fecha,
        concepto: `${tipo === 'emitida' ? 'Cobro' : 'Pago'} a cuenta — ${contraparte}`,
        origen: 'factura',
        origenId: p.id,
      }))
      setCuentas((prev) => nuevosMovimientos.reduce((acc, mov) => aplicarMovimientoTesoreria(acc, mov), prev))
      setMovimientosTesoreria((prev) => [...prev, ...nuevosMovimientos])
    }
  }

  function handleEliminarPago(id: string) {
    const pago = pagos.find((p) => p.id === id)
    if (!pago) return
    setPagos((prev) => prev.filter((p) => p.id !== id))
    // Si la factura se había marcado cumplida gracias a este pago, la reabrimos.
    setFacturas((prev) =>
      prev.map((f) => {
        if (f.id !== pago.facturaId || !f.cumplido) return f
        const totalRestante = pagos
          .filter((p) => p.id !== id && p.facturaId === f.id)
          .reduce((s, p) => s + p.monto, 0)
        return totalRestante < f.monto ? { ...f, cumplido: false } : f
      }),
    )
    const movimiento = movimientosTesoreria.find((m) => m.origen === 'factura' && m.origenId === id)
    if (movimiento) {
      setCuentas((prev) => revertirMovimientoTesoreria(prev, movimiento))
      setMovimientosTesoreria((prev) => prev.filter((m) => m.id !== movimiento.id))
    }
  }

  function handleAgregarRemito(remito: Omit<RemitoPresupuesto, 'id' | 'estado'>) {
    const nuevoRemito: RemitoPresupuesto = { ...remito, id: generarId(), estado: 'pendiente' }
    setRemitos((prev) => [...prev, nuevoRemito])
    const nuevosMovimientos = generarMovimientosDeRemito(nuevoRemito, productos, generarId)
    if (nuevosMovimientos.length > 0) {
      setMovimientosStock((prev) => [...prev, ...nuevosMovimientos])
      setProductos((prev) => nuevosMovimientos.reduce((acc, mov) => aplicarMovimientoStock(acc, mov), prev))
    }
  }

  function handleEliminarRemito(id: string) {
    const movimientosDelRemito = movimientosStock.filter((m) => m.remitoId === id)
    if (movimientosDelRemito.length > 0) {
      setProductos((prev) => movimientosDelRemito.reduce((acc, mov) => revertirMovimientoStock(acc, mov), prev))
      setMovimientosStock((prev) => prev.filter((m) => m.remitoId !== id))
    }
    const anticiposDelRemito = anticipos.filter((a) => a.remitoId === id)
    if (anticiposDelRemito.length > 0) {
      const idsAnticipos = new Set(anticiposDelRemito.map((a) => a.id))
      const movimientosDeAnticipos = movimientosTesoreria.filter(
        (m) => m.origen === 'anticipo' && m.origenId && idsAnticipos.has(m.origenId),
      )
      if (movimientosDeAnticipos.length > 0) {
        setCuentas((prev) => movimientosDeAnticipos.reduce((acc, mov) => revertirMovimientoTesoreria(acc, mov), prev))
        setMovimientosTesoreria((prev) => prev.filter((m) => !(m.origen === 'anticipo' && m.origenId && idsAnticipos.has(m.origenId))))
      }
    }
    setRemitos((prev) => prev.filter((r) => r.id !== id))
    setAnticipos((prev) => prev.filter((a) => a.remitoId !== id))
  }

  function handleAgregarSector(nombre: string) {
    setSectores((prev) => [...prev, { id: generarId(), nombre }])
  }

  /** No borra los remitos que ya tenían este sector asignado — simplemente dejan de contar en
   * Márgenes por sector, mismo criterio de borrado sin cascada que el resto de la app. */
  function handleEliminarSector(id: string) {
    setSectores((prev) => prev.filter((s) => s.id !== id))
  }

  function handleAgregarEmpleado(empleado: Omit<Empleado, 'id'>) {
    setEmpleados((prev) => [...prev, { ...empleado, id: generarId() }])
  }

  function handleActualizarEmpleado(id: string, cambios: Partial<Omit<Empleado, 'id'>>) {
    setEmpleados((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
  }

  function handleEliminarEmpleado(id: string) {
    setEmpleados((prev) => prev.filter((e) => e.id !== id))
  }

  /** Deja registrada la emisión en la factura: los datos fiscales con los que se emitió y el CAE
   * que devolvió ARCA. A partir de acá el comprobante no se vuelve a emitir. */
  function handleFacturaEmitida(id: string, receptor: DatosReceptor, emision: ResultadoEmision) {
    // Autorizado el comprobante, el número lo pone ARCA: pisa cualquiera que se hubiera cargado a
    // mano, para que no queden dos numeraciones distintas sobre la misma factura.
    const numero = numeroComprobanteFormateado(emision, datosEmisorFiscal.puntoVenta)
    setFacturas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, receptor, emision, ...(numero ? { numero } : {}) } : f)),
    )
  }

  function handlePagarSueldos(concepto: ConceptoPagoSueldos, mes: string, monto: number, cuentaId: string, fecha: string) {
    const movimiento: MovimientoTesoreria = {
      id: generarId(),
      cuentaId,
      tipo: 'egreso',
      monto,
      fecha,
      concepto: `${CONCEPTO_PAGO_SUELDOS_LABEL[concepto]} — ${mes}`,
      origen: 'sueldo',
      origenId: idOrigenPagoSueldos(mes, concepto),
    }
    setMovimientosTesoreria((prev) => [...prev, movimiento])
    setCuentas((prev) => aplicarMovimientoTesoreria(prev, movimiento))
  }

  function handleDeshacerPagoSueldos(movimientoId: string) {
    const movimiento = movimientosTesoreria.find((m) => m.id === movimientoId)
    if (!movimiento) return
    setCuentas((prev) => revertirMovimientoTesoreria(prev, movimiento))
    setMovimientosTesoreria((prev) => prev.filter((m) => m.id !== movimientoId))
  }

  function handleRegistrarAnticipo(
    remitoId: string,
    monto: number,
    fecha: string,
    medioPago: MedioPago | undefined,
    cuentaId?: string,
  ) {
    if (monto <= 0) return
    const anticipoId = generarId()
    setAnticipos((prev) => [...prev, { id: anticipoId, remitoId, monto, fecha, medioPago, cuentaId }])
    if (cuentaId && esFull) {
      const remito = remitos.find((r) => r.id === remitoId)
      if (remito) {
        const movimiento: MovimientoTesoreria = {
          id: generarId(),
          cuentaId,
          tipo: remito.tipo === 'emitida' ? 'ingreso' : 'egreso',
          monto,
          fecha,
          concepto: `Anticipo — ${remito.contraparte}`,
          origen: 'anticipo',
          origenId: anticipoId,
        }
        setCuentas((prev) => aplicarMovimientoTesoreria(prev, movimiento))
        setMovimientosTesoreria((prev) => [...prev, movimiento])
      }
    }
  }

  function handleVincularRemitoAFactura(remitoId: string, facturaId: string) {
    const remito = remitos.find((r) => r.id === remitoId)
    const factura = facturas.find((f) => f.id === facturaId)
    if (!remito || !factura) return
    const anticiposDelRemito = anticipos.filter((a) => a.remitoId === remitoId)
    const { pagos: nuevosPagos, facturaCubierta } = vincularRemitoAFactura(anticiposDelRemito, factura, pagos, generarId)
    setPagos((prev) => [...prev, ...nuevosPagos])
    setRemitos((prev) => prev.map((r) => (r.id === remitoId ? { ...r, estado: 'facturado', facturaId } : r)))
    if (facturaCubierta) {
      setFacturas((prev) => prev.map((f) => (f.id === facturaId ? { ...f, cumplido: true } : f)))
    }
  }

  function handleAgregarProducto(producto: Omit<Producto, 'id'>) {
    setProductos((prev) => [...prev, { ...producto, id: generarId() }])
  }

  function handleImportarProductos(nuevos: Omit<Producto, 'id'>[]) {
    setProductos((prev) => [...prev, ...nuevos.map((p) => ({ ...p, id: generarId() }))])
  }

  function handleEliminarProducto(id: string) {
    setProductos((prev) => prev.filter((p) => p.id !== id))
    setMovimientosStock((prev) => prev.filter((m) => m.productoId !== id))
  }

  function handleEliminarProductos(ids: string[]) {
    const idsAEliminar = new Set(ids)
    setProductos((prev) => prev.filter((p) => !idsAEliminar.has(p.id)))
    setMovimientosStock((prev) => prev.filter((m) => !idsAEliminar.has(m.productoId)))
  }

  function handleRegistrarMovimientoStock(
    productoId: string,
    tipo: TipoMovimientoStock,
    cantidad: number,
    fecha: string,
    motivo: string | undefined,
    costoUnitario: number | undefined,
  ) {
    const movimiento: MovimientoStock = { id: generarId(), productoId, tipo, cantidad, fecha, motivo, costoUnitario }
    setMovimientosStock((prev) => [...prev, movimiento])
    setProductos((prev) => aplicarMovimientoStock(prev, movimiento))
  }

  function handleEliminarMovimientoStock(id: string) {
    const movimiento = movimientosStock.find((m) => m.id === id)
    if (!movimiento) return
    setMovimientosStock((prev) => prev.filter((m) => m.id !== id))
    setProductos((prev) => revertirMovimientoStock(prev, movimiento))
  }

  /** Lo que se carga en Ingresos y gastos no se guarda aparte: se guarda como un comprobante
   * interno (una venta si es ingreso, una compra si es gasto), para que alimente el Dashboard, el
   * margen y la caja como cualquier otro comprobante en vez de quedar en un registro suelto. Al
   * ser interno no toca IVA ni Ingresos Brutos — ver facturaDesdeMovimientoDiario. */
  function handleAgregarMovimientoDiario(movimiento: Omit<MovimientoDiario, 'id'>) {
    const id = generarId()
    setFacturas((prev) => [...prev, facturaDesdeMovimientoDiario({ ...movimiento, id }, id)])
  }

  function handleEliminarMovimientoDiario(id: string) {
    setFacturas((prev) => prev.filter((f) => f.id !== id))
  }

  function handleCambiarIvaManual(mes: string, campo: keyof IvaManualMes, valor: number | undefined) {
    setIvaManualPorMes((prev) => ({
      ...prev,
      [mes]: { ...(prev[mes] ?? {}), [campo]: valor },
    }))
  }

  function handleCambiarIngresosBrutosManual(mes: string, campo: keyof IngresosBrutosManualMes, valor: number | undefined) {
    setIngresosBrutosManualPorMes((prev) => ({
      ...prev,
      [mes]: { ...(prev[mes] ?? {}), [campo]: valor },
    }))
  }

  function handleEliminarMesIva(mes: string) {
    setIvaManualPorMes((prev) => {
      const { [mes]: _eliminado, ...resto } = prev
      return resto
    })
  }

  function handleEliminarMesIngresosBrutos(mes: string) {
    setIngresosBrutosManualPorMes((prev) => {
      const { [mes]: _eliminado, ...resto } = prev
      return resto
    })
  }

  const categorias: CategoriaGasto[] = CATEGORIAS_CONFIG.map((c) => ({
    key: c.key,
    label: c.label,
    tipo: c.tipo,
    color: c.color,
    monto: montos[c.key] ?? 0,
  }))

  const nominaTotal = useMemo(() => calcularNominaTotal(empleados), [empleados])
  const aguinaldo = useMemo(() => calcularAguinaldo(empleados), [empleados])
  // Los indicadores (margen, runway, punto de equilibrio, proyección) se calculan sobre el costo
  // REAL de la nómina cuando hay empleados cargados, no sobre el estimado a mano — si no, el
  // Dashboard mostraría el costo real en la composición de gastos y uno distinto en los KPIs de
  // arriba. Las demás categorías siguen siendo el estimado: una factura clasificada no alcanza
  // para saber si ese gasto se repite todos los meses, la nómina sí.
  const categoriasEfectivas = useMemo(
    () =>
      nominaTotal.cantidadActivos === 0
        ? categorias
        : categorias.map((c) => (c.key === 'sueldos' ? { ...c, monto: nominaTotal.totalCostoEmpresa } : c)),
    [categorias, nominaTotal],
  )
  const { fijos: gastosFijos, variables: gastosVariables, total: gastosTotales } = calcularGastosTotales(categoriasEfectivas)
  // Para el gráfico de anillo del Dashboard: mostrar lo realmente gastado este mes en cada
  // categoría (automático desde facturas clasificadas, o pisado a mano) cuando hay dato, y el
  // estimado del presupuesto en las que todavía no tienen nada cargado. La categoría "sueldos" usa
  // el costo real de la nómina vigente (ver Sueldos) en vez de facturas clasificadas, si hay al
  // menos un empleado activo cargado.
  const categoriasDona = useMemo(() => {
    const mesActual = mesActualISO()
    const automaticoMesActual: Record<string, number> = {
      ...calcularRealAutomaticoPorMes(facturas, clasificaciones, mesActual),
      ...(nominaTotal.cantidadActivos > 0 ? { sueldos: nominaTotal.totalCostoEmpresa } : {}),
    }
    const manualMesActual = realManualPorMes[mesActual] ?? {}
    const hayDatoReal = categorias.some(
      (c) => manualMesActual[c.key] !== undefined || automaticoMesActual[c.key] !== undefined,
    )
    return {
      categorias: categorias.map((c) => {
        if (manualMesActual[c.key] !== undefined) return { ...c, monto: manualMesActual[c.key] }
        if (automaticoMesActual[c.key] !== undefined) return { ...c, monto: automaticoMesActual[c.key] }
        return c
      }),
      esReal: hayDatoReal,
    }
  }, [categorias, facturas, clasificaciones, realManualPorMes, nominaTotal])
  const saldoInicial = calcularSaldoTotalBancos(cuentas)
  const deudaTotal = calcularDeudaTotal(deudas)
  const cuotaDeudaTotal = calcularCuotaDeudaTotal(deudas)

  // Híbrido (Premium): si hay comprobantes cargados en Comprobantes, los indicadores usan el
  // promedio real de tus ventas/compras mensuales (todos los meses cargados, no solo el mes en
  // curso) en vez de la estimación manual de arriba. Ventas y compras se promedian con el mismo
  // denominador (ver calcularPromediosMensualesReales) para que el margen resultante coincida
  // con el margen bruto real del período, en vez de inflarse cuando una de las dos está
  // concentrada en menos meses que la otra. El desglose por categoría (para Composición de
  // gastos y Punto de equilibrio) sigue siendo siempre manual, porque un comprobante importado
  // no viene categorizado como fijo/variable.
  const promediosReales = useMemo(
    () => (esPremium ? calcularPromediosMensualesReales(facturas) : null),
    [esPremium, facturas],
  )
  const usaIngresosReales = promediosReales?.hayVentas ?? false
  const usaGastosReales = promediosReales?.hayCompras ?? false
  const ingresosEfectivos = usaIngresosReales ? promediosReales!.ventasPromedio : ingresos
  // El promedio de compras sale de las facturas recibidas, y los sueldos nunca vienen por factura:
  // sin sumarlos acá, un negocio con empleados y comprobantes cargados mostraría un margen
  // operativo inflado, porque estaría descontando solo lo que le compra a proveedores.
  const gastosEfectivos = usaGastosReales
    ? promediosReales!.comprasPromedio + nominaTotal.totalCostoEmpresa
    : gastosTotales
  const ingresosProyeccion = ingresosEfectivos
  const gastosProyeccion = gastosEfectivos

  const margenOperativo = calcularMargenOperativo(ingresosEfectivos, gastosEfectivos)
  // Runway: cuántos meses cubre la caja pagando SOLO los gastos fijos si el ingreso cayera a
  // cero — no los gastos totales, porque los variables (insumos, mercadería) dejarían de
  // comprarse junto con la caída del ingreso que los genera.
  const runwayMeses = calcularRunwayMeses(saldoInicial, gastosFijos)
  const valorInventario = useMemo(() => calcularValorInventario(productos), [productos])
  const valorBienes = useMemo(() => calcularValorTotalBienes(bienes) + valorInventario, [bienes, valorInventario])
  const runwayExtendido = calcularRunwayExtendido(saldoInicial, valorBienes, gastosFijos)
  const endeudamientoMeses = calcularEndeudamientoMeses(deudaTotal, ingresosEfectivos)
  const puntoEquilibrio = useMemo(
    () => calcularPuntoEquilibrio(ingresosEfectivos, gastosFijos, gastosVariables),
    [ingresosEfectivos, gastosFijos, gastosVariables],
  )
  // El aguinaldo no se reparte en doce cuotas: pega entero en junio y en diciembre, y es
  // justamente el mes donde más de un negocio se queda corto de caja sin verlo venir.
  const gastosAguinaldo = useMemo(
    () => gastosAguinaldoProyectados(aguinaldo.totalCostoEmpresa, meses),
    [aguinaldo, meses],
  )
  const proyeccion = useMemo(
    () =>
      proyectarFlujoCaja(saldoInicial, ingresosProyeccion, gastosProyeccion, meses, esPremium ? tasaCrecimiento : 0, gastosAguinaldo),
    [saldoInicial, ingresosProyeccion, gastosProyeccion, meses, esPremium, tasaCrecimiento, gastosAguinaldo],
  )
  const realEfectivo = useMemo(() => {
    const base = calcularRealEfectivoPorMes(categorias, facturas, clasificaciones, realManualPorMes, mesPresupuesto)
    const sueldosEsManual = realManualPorMes[mesPresupuesto]?.sueldos !== undefined
    if (sueldosEsManual || nominaTotal.cantidadActivos === 0) return base
    return { ...base, sueldos: { monto: nominaTotal.totalCostoEmpresa, automatico: true } }
  }, [categorias, facturas, clasificaciones, realManualPorMes, mesPresupuesto, nominaTotal])
  const desvios = useMemo(() => calcularDesvios(categorias, realEfectivo), [categorias, realEfectivo])
  const desvioVentas = useMemo(
    () => calcularDesvioVentas(ingresos, facturas, ventasManualPorMes, mesPresupuesto),
    [ingresos, facturas, ventasManualPorMes, mesPresupuesto],
  )
  const proveedores = useMemo(() => listarProveedores(facturas, clasificaciones), [facturas, clasificaciones])
  const clientes = useMemo(() => listarClientes(facturas, clientesManual), [facturas, clientesManual])
  const coberturaDeuda = calcularCoberturaDeuda(ingresosEfectivos, cuotaDeudaTotal)
  const resumenMensual = useMemo(() => calcularTendenciaMensual(facturas), [facturas])
  const rankingClientes = useMemo(() => calcularRanking(facturas, 'emitida'), [facturas])
  const rankingProveedores = useMemo(() => calcularRanking(facturas, 'recibida'), [facturas])
  const margenTotal = useMemo(() => calcularMargenBrutoTotal(facturas), [facturas])
  const aging = useMemo(() => calcularAgingCuentas(facturas, pagos), [facturas, pagos])
  const cuentaCorrienteCobrar = useMemo(
    () => agruparCuentaCorriente(facturas, pagos, remitos, anticipos, 'emitida'),
    [facturas, pagos, remitos, anticipos],
  )
  const cuentaCorrientePagar = useMemo(
    () => agruparCuentaCorriente(facturas, pagos, remitos, anticipos, 'recibida'),
    [facturas, pagos, remitos, anticipos],
  )
  const remitosCobrar = useMemo(() => listarRemitosPendientes(remitos, anticipos, 'emitida'), [remitos, anticipos])
  const remitosPagar = useMemo(() => listarRemitosPendientes(remitos, anticipos, 'recibida'), [remitos, anticipos])
  // El costo de la nómina que se suma a cada sector es mensual, así que el período elegido define
  // cuántos meses de sueldo entran: uno cuando se mira un mes, y en el acumulado tantos como meses
  // con movimientos haya, para no comparar los remitos de todo el año contra un solo sueldo.
  const remitosDeSectores = useMemo(
    () => (periodoMargenes === 'mes' ? remitos.filter((r) => r.fecha.slice(0, 7) === mesMargenes) : remitos),
    [remitos, periodoMargenes, mesMargenes],
  )
  const facturasDeSectores = useMemo(
    () => (periodoMargenes === 'mes' ? facturas.filter((f) => f.fecha.slice(0, 7) === mesMargenes) : facturas),
    [facturas, periodoMargenes, mesMargenes],
  )
  const mesesAcumulados = useMemo(() => {
    if (periodoMargenes === 'mes') return 1
    const meses = new Set<string>()
    for (const r of remitosDeSectores) if (r.sectorId) meses.add(r.fecha.slice(0, 7))
    for (const f of facturasDeSectores) if (f.sectorId) meses.add(f.fecha.slice(0, 7))
    return Math.max(1, meses.size)
  }, [periodoMargenes, remitosDeSectores, facturasDeSectores])
  const margenesPorSector = useMemo(
    () =>
      calcularMargenPorSector(sectores, remitosDeSectores, productos, empleados, facturasDeSectores, mesesAcumulados),
    [sectores, remitosDeSectores, productos, empleados, facturasDeSectores, mesesAcumulados],
  )
  // Para el calendario semanal: los pagos que genera la nómina del mes en curso.
  const pagosSueldosMesActual = useMemo(
    () => calcularPagosSueldos(nominaTotal, mesActualISO(), movimientosTesoreria, aguinaldo),
    [nominaTotal, movimientosTesoreria, aguinaldo],
  )
  const contrapartesClientes = useMemo(() => clientes.map((c) => c.cliente).sort(), [clientes])
  const contrapartesProveedores = useMemo(() => proveedores.map((p) => p.proveedor).sort(), [proveedores])
  const posicionIva = useMemo(
    () => calcularPosicionIvaPorMes(facturas, ivaManualPorMes),
    [facturas, ivaManualPorMes],
  )
  const posicionIngresosBrutos = useMemo(
    () => calcularPosicionIngresosBrutosPorMes(facturas, ingresosBrutosManualPorMes),
    [facturas, ingresosBrutosManualPorMes],
  )
  const alertas = useMemo(
    () => generarAlertas({ margenOperativo, runwayMeses, proyeccion, deudas, facturas, cheques, productos }),
    [margenOperativo, runwayMeses, proyeccion, deudas, facturas, cheques, productos],
  )
  const indicadoresCobroPago = useMemo(() => calcularDSOyDPO(facturas, pagos), [facturas, pagos])
  const recomendaciones = useMemo(
    () =>
      esPremium
        ? generarRecomendaciones({
            margenOperativo,
            runwayMeses,
            proyeccion,
            deudas,
            dso: indicadoresCobroPago.dso,
            dpo: indicadoresCobroPago.dpo,
            hayDatosCobroPago: indicadoresCobroPago.hayDatos,
          })
        : [],
    [esPremium, margenOperativo, runwayMeses, proyeccion, deudas, indicadoresCobroPago],
  )
  const escenarios = useMemo(
    () =>
      proyectarFlujoCajaEscenarios(
        saldoInicial,
        ingresosProyeccion,
        gastosProyeccion,
        meses,
        esPremium ? tasaCrecimiento : 0,
        gastosAguinaldo,
      ),
    [saldoInicial, ingresosProyeccion, gastosProyeccion, meses, esPremium, tasaCrecimiento, gastosAguinaldo],
  )

  const mensajeWhatsApp = `Hola Juan! Armé mi dashboard financiero en FinCorp (margen operativo: ${formatoPorcentaje(
    margenOperativo,
  )}, runway de caja: ${runwayMeses === Infinity ? 'sin límite' : `${runwayMeses.toFixed(1)} meses`}) y quiero asesoramiento para mi negocio.`

  function handleDescargarPdf() {
    abrirInformeFinanciero({
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
      escenarios,
      recomendaciones,
    })
  }

  function handleDescargarInformeSalud() {
    abrirInformeSaludFinanciera({
      nombreNegocio,
      resumenMensual,
      rankingClientes,
      rankingProveedores,
      margenTotal,
      indicadoresCobroPago,
      aging,
    })
  }

  async function handleExportarContador() {
    await exportarParaContador({
      nombreNegocio,
      facturas,
      esFull,
      cuentaCorrienteCobrar,
      cuentaCorrientePagar,
      cheques,
      cuentas,
      movimientosTesoreria,
    })
  }

  function abrirPlanes() {
    setMostrarPlanes(true)
  }

  return (
    <>
      <div className="mb-8">
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          <Calculator size={14} aria-hidden="true" /> FinCorp para empresas
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          Gestioná las finanzas de tu negocio, sin ser financista
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cargá los números estimados de tu negocio una sola vez y armamos tu tablero: indicadores clave,
          composición de gastos y proyección de caja.
        </p>
        {user && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: nubeLista ? 'var(--status-good-text)' : 'var(--text-muted)' }}>
            {nubeLista ? (<><Cloud size={12} aria-hidden="true" /> Guardado en tu cuenta</>) : 'Sincronizando con tu cuenta…'}
          </p>
        )}
      </div>

      <div className="mb-6 space-y-2">
        <nav className="flex flex-wrap gap-2" role="tablist">
          {SECCIONES_SUELTAS.map((key) => {
            const s = SECCIONES.find((x) => x.key === key)!
            return (
              <button
                key={key}
                role="tab"
                aria-selected={seccion === key}
                onClick={() => setSeccion(key)}
                className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={
                  seccion === key
                    ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                    : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }
                }
              >
                {s.label}
                {seccionBloqueada(key) && <Lock size={12} aria-hidden="true" />}
              </button>
            )
          })}
          {GRUPOS.map((g) => {
            const activo = (g.secciones as Seccion[]).includes(seccion)
            const abierto = grupoAbierto === g.key
            return (
              <button
                key={g.key}
                aria-expanded={abierto}
                onClick={() => setGrupoAbierto(abierto ? null : g.key)}
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={
                  activo
                    ? { background: 'color-mix(in srgb, var(--series-blue) 16%, transparent)', borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }
                    : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }
                }
              >
                {g.label}
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  style={{ transform: abierto ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
                />
              </button>
            )
          })}
        </nav>

        {grupoAbierto && (
          <nav
            className="flex flex-wrap gap-2 rounded-xl border p-2"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            role="tablist"
          >
            {GRUPOS.find((g) => g.key === grupoAbierto)!.secciones.map((key) => {
              const s = SECCIONES.find((x) => x.key === key)!
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={seccion === key}
                  onClick={() => setSeccion(key)}
                  className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  style={
                    seccion === key
                      ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }
                  }
                >
                  {s.label}
                  {seccionBloqueada(key) && <Lock size={12} aria-hidden="true" />}
                </button>
              )
            })}
          </nav>
        )}
      </div>

      {seccion === 'ingresosGastos' && (
        <IngresosGastos
          movimientos={movimientosDiariosVista}
          onAgregar={handleAgregarMovimientoDiario}
          onEliminar={handleEliminarMovimientoDiario}
        />
      )}

      {seccion === 'cobranzas' && (
        <CobranzasPagosSemanal
          facturas={esPremium ? facturas : undefined}
          onCambiarFactura={esPremium ? handleCambiarFactura : undefined}
          cheques={esFull ? cheques : undefined}
          onCambiarEstadoCheque={esFull ? handleCambiarEstadoCheque : undefined}
          cuentas={esFull ? cuentas : undefined}
          pagosSueldos={esFull ? pagosSueldosMesActual : undefined}
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
            ventas={desvioVentas}
            mes={mesPresupuesto}
            onCambiarMes={setMesPresupuesto}
            onCambiarReal={cambiarReal}
            onCambiarVentas={cambiarVentasReales}
          />
        </PremiumLock>
      )}

      {seccion === 'facturas' && (
        <PremiumLock
          activo={esPremium}
          titulo="Comprobantes"
          descripcion="Importá tus facturas, notas de crédito y débito (desde ARCA o a mano) y mirá ventas y compras netas, margen bruto por mes, tus principales clientes/proveedores y qué tan sana es tu facturación."
          onQuieroPremium={abrirPlanes}
        >
          <Facturas
            facturas={facturas}
            pagos={pagos}
            cuentas={esFull ? cuentas : undefined}
            cuentaPorFactura={cuentasDeFacturas}
            sectores={sectores}
            productos={productos}
            onAgregar={handleAgregarFactura}
            onImportarVarias={handleImportarFacturas}
            onCambiar={handleCambiarFactura}
            onEliminar={handleEliminarFactura}
            emisorFiscal={esFull && datosEmisorFiscal.cuit.trim() ? datosEmisorFiscal : undefined}
            onEmitida={handleFacturaEmitida}
            onVaciar={handleVaciarFacturas}
            onExportarContador={handleExportarContador}
            onDescargarInforme={handleDescargarInformeSalud}
          />
        </PremiumLock>
      )}

      {seccion === 'cuentasCorrientes' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Cuentas corrientes"
          descripcion="Mirá el saldo pendiente de cada cliente y proveedor, e imputá pagos parciales a cuenta sin tener que marcar cada factura entera como cobrada o pagada."
          onQuieroPremium={abrirPlanes}
        >
          <CuentasCorrientes
            cuentasCobrar={cuentaCorrienteCobrar}
            cuentasPagar={cuentaCorrientePagar}
            pagos={pagos}
            cuentasBancarias={cuentas}
            onAplicarPago={handleAplicarPagoCuenta}
            onEliminarPago={handleEliminarPago}
          />
        </PremiumLock>
      )}

      {seccion === 'remitos' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Remitos y presupuestos"
          descripcion="Para trabajos largos: cargá el remito o presupuesto, cobrá un anticipo, y vinculalo a la factura real cuando termines el trabajo."
          onQuieroPremium={abrirPlanes}
        >
          <RemitosPresupuestos
            remitosCobrar={remitosCobrar}
            remitosPagar={remitosPagar}
            facturas={facturas}
            productos={productos}
            sectores={sectores}
            contrapartesClientes={contrapartesClientes}
            contrapartesProveedores={contrapartesProveedores}
            cuentasBancarias={cuentas}
            onAgregar={handleAgregarRemito}
            onRegistrarAnticipo={handleRegistrarAnticipo}
            onVincularFactura={handleVincularRemitoAFactura}
            onEliminar={handleEliminarRemito}
          />
        </PremiumLock>
      )}

      {seccion === 'margenes' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Márgenes por sector"
          descripcion="Creá sectores (divisiones o centros de costo del negocio) y asignalos a tus remitos para ver cuánto factura, cuánto cuesta y cuánto deja de ganancia cada uno."
          onQuieroPremium={abrirPlanes}
        >
          <MargenesPorSector
            sectores={sectores}
            margenes={margenesPorSector}
            mes={mesMargenes}
            onCambiarMes={setMesMargenes}
            periodo={periodoMargenes}
            onCambiarPeriodo={setPeriodoMargenes}
            mesesAcumulados={mesesAcumulados}
            onAgregarSector={handleAgregarSector}
            onEliminarSector={handleEliminarSector}
          />
        </PremiumLock>
      )}

      {seccion === 'facturacionElectronica' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Facturación electrónica"
          descripcion="Habilitá tu CUIT ante ARCA paso a paso para poder emitir comprobantes con CAE desde el sistema."
          onQuieroPremium={abrirPlanes}
        >
          <FacturacionElectronica datos={datosEmisorFiscal} onCambiar={setDatosEmisorFiscal} />
        </PremiumLock>
      )}

      {seccion === 'sueldos' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Sueldos"
          descripcion="Cargá tu nómina de empleados y mirá cuánto le cuesta cada uno a la empresa, con aportes y contribuciones ya calculados."
          onQuieroPremium={abrirPlanes}
        >
          <Sueldos
            empleados={empleados}
            nomina={nominaTotal}
            aguinaldo={aguinaldo}
            sectores={sectores}
            cuentas={cuentas}
            movimientosTesoreria={movimientosTesoreria}
            onAgregar={handleAgregarEmpleado}
            onActualizar={handleActualizarEmpleado}
            onEliminar={handleEliminarEmpleado}
            onPagar={handlePagarSueldos}
            onDeshacerPago={handleDeshacerPagoSueldos}
          />
        </PremiumLock>
      )}

      {seccion === 'puntoDeVenta' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Punto de venta"
          descripcion="Vendé en el mostrador con lector de código de barras: pasás los productos, la lista se arma sola y al cobrar queda el comprobante hecho, con el stock descontado y la plata en Tesorería."
          onQuieroPremium={abrirPlanes}
        >
          <PuntoDeVenta productos={productos} cuentas={cuentas} onCobrar={handleCobrarEnMostrador} />
        </PremiumLock>
      )}

      {seccion === 'stock' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Stock"
          descripcion="Cargá tu catálogo de productos y llevá el control de entradas y salidas. Se conecta solo con los remitos que tengan líneas de producto."
          onQuieroPremium={abrirPlanes}
        >
          <Stock
            productos={productos}
            movimientos={movimientosStock}
            onAgregarProducto={handleAgregarProducto}
            onImportarProductos={handleImportarProductos}
            onRegistrarMovimiento={handleRegistrarMovimientoStock}
            onEliminarMovimiento={handleEliminarMovimientoStock}
            onEliminarProducto={handleEliminarProducto}
            onEliminarProductos={handleEliminarProductos}
          />
        </PremiumLock>
      )}

      {seccion === 'tesoreria' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Tesorería"
          descripcion="El saldo de cada caja o cuenta bancaria se actualiza solo con lo que cobrás/pagás desde Comprobantes, Cuentas corrientes, Cheques y Remitos."
          onQuieroPremium={abrirPlanes}
        >
          <Tesoreria
            cuentas={cuentas}
            movimientos={movimientosTesoreria}
            movimientosBancarios={movimientosBancarios}
            onAgregarCuenta={handleAgregarCuenta}
            onAjustarSaldo={handleAjustarSaldoCuenta}
            onEliminarMovimiento={handleEliminarMovimientoTesoreria}
            onEliminarCuenta={handleEliminarCuenta}
            onImportarExtracto={handleImportarExtracto}
            onConciliarManual={handleConciliarManual}
            onDesconciliar={handleDesconciliar}
            onCrearAjusteDesdeBancario={handleCrearAjusteDesdeBancario}
            onEliminarMovimientoBancario={handleEliminarMovimientoBancario}
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

      {seccion === 'clientes' && (
        <PremiumLock
          activo={esPremium}
          titulo="Clientes"
          descripcion="Todos tus clientes, con la cantidad de comprobantes y el total facturado de cada uno."
          onQuieroPremium={abrirPlanes}
        >
          <Clientes
            clientes={clientes}
            onAgregarManual={handleAgregarClienteManual}
            onEliminarManual={handleEliminarClienteManual}
          />
        </PremiumLock>
      )}

      {seccion === 'cheques' && (
        <PremiumLock
          activo={esFull}
          nivelRequerido="full"
          titulo="Cheques"
          descripcion="Gestioná los cheques de terceros que recibís y los propios que emitís, para ir armando junto con tus cuentas bancarias un balance contable a fin de año."
          onQuieroPremium={abrirPlanes}
        >
          <Cheques
            cheques={cheques}
            facturas={facturas}
            cuentas={cuentas}
            onAgregar={handleAgregarCheque}
            onCambiarEstado={handleCambiarEstadoCheque}
            onCambiarCuenta={handleCambiarCuentaCheque}
            onCambiarComision={handleCambiarComisionCheque}
            onEliminar={handleEliminarCheque}
          />
        </PremiumLock>
      )}

      {seccion === 'iva' && (
        <PremiumLock
          activo={esPremium}
          titulo="Posición de IVA"
          descripcion="Débito y crédito fiscal por mes, con el saldo técnico a favor arrastrado del mes anterior, a partir del IVA que cargues en cada comprobante (solapa Comprobantes)."
          onQuieroPremium={abrirPlanes}
        >
          <PosicionIva posicion={posicionIva} onCambiarManual={handleCambiarIvaManual} onEliminarMes={handleEliminarMesIva} />
        </PremiumLock>
      )}

      {seccion === 'iibb' && (
        <PremiumLock
          activo={esPremium}
          titulo="Posición de Ingresos Brutos"
          descripcion="Base imponible por tus facturas emitidas, multiplicada por la alícuota, menos las retenciones del mes — ambas editables a mano."
          onQuieroPremium={abrirPlanes}
        >
          <PosicionIngresosBrutos
            posicion={posicionIngresosBrutos}
            onCambiarManual={handleCambiarIngresosBrutosManual}
            onEliminarMes={handleEliminarMesIngresosBrutos}
          />
        </PremiumLock>
      )}

      {seccion === 'monotributo' && (
        <PremiumLock
          activo={esPremium}
          titulo="Monotributo"
          descripcion="En qué categoría estás según tus últimos 12 meses y en cuál vas a quedar en la próxima recategorización, con la cuota que te corresponde."
          onQuieroPremium={abrirPlanes}
        >
          <Monotributo facturas={facturas} datos={monotributo} onCambiar={setMonotributo} />
        </PremiumLock>
      )}

      {seccion === 'patrimonio' && (
        <PremiumLock
          activo={esPremium}
          titulo="Patrimonio / Bienes"
          descripcion="Inversiones, inmuebles, vehículos, maquinaria o stock que podrías liquidar ante un quiebre de caja — un colchón de referencia, aparte del runway principal."
          onQuieroPremium={abrirPlanes}
        >
          <Patrimonio bienes={bienes} runwayExtendido={runwayExtendido} onAgregar={handleAgregarBien} onEliminar={handleEliminarBien} />
        </PremiumLock>
      )}

      {seccion === 'backup' && (
        <Backup
          datos={negocioDataActual}
          onRestaurar={handleRestaurarBackup}
          backupsAutomaticos={backupsAutomaticos}
          onObtenerBackupAutomatico={handleObtenerBackupAutomatico}
        />
      )}

      {seccion === 'ayuda' && <Ayuda esPremium={esPremium} esFull={esFull} />}

      {seccion === 'dashboard' && (
        <>
          {esPremium ? (
            <>
              <AlertasPanel alertas={alertas} />
              <Recomendaciones recomendaciones={recomendaciones} />
            </>
          ) : (
            <button
              onClick={abrirPlanes}
              className="mb-6 flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--series-blue)' }}
            >
              <Lock size={14} className="shrink-0" aria-hidden="true" /> Con el plan Medio recibís alertas automáticas sobre tu caja, deudas y facturas vencidas
            </button>
          )}

          <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {esFull ? (
              <Card>
                <h2 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Cuentas bancarias
                </h2>
                <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Con el plan Full el saldo de cada cuenta se actualiza solo con lo que cobrás/pagás desde
                  Comprobantes, Cuentas corrientes, Cheques y Remitos — gestionalo desde Tesorería.
                </p>
                <p className="tabular text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatoMoneda(calcularSaldoTotalBancos(cuentas))}
                </p>
                <button
                  onClick={() => setSeccion('tesoreria')}
                  className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
                >
                  Ir a Tesorería →
                </button>
              </Card>
            ) : (
              <CuentasBancarias
                cuentas={cuentas}
                onAgregar={handleAgregarCuenta}
                onCambiarSaldo={handleCambiarSaldoCuenta}
                onEliminar={handleEliminarCuenta}
              />
            )}
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
              <p className="-mt-2 mb-4 inline-flex items-start gap-1 text-xs" style={{ color: 'var(--series-blue)' }}>
                <BarChart3 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                Ya cargaste ventas o compras en la solapa Comprobantes: los indicadores de abajo usan{' '}
                {usaIngresosReales && usaGastosReales
                  ? 'el promedio real de esas ventas y compras'
                  : usaIngresosReales
                    ? 'el promedio real de esas ventas'
                    : 'el promedio real de esas compras'}{' '}
                en vez de esta estimación (que sigue sirviendo para la composición de gastos y el punto de
                equilibrio).
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Ingresos mensuales estimados
                  {usaIngresosReales && (
                    <span style={{ color: 'var(--series-blue)' }}> (no usado)</span>
                  )}
                </span>
                <InputMoneda
                  value={ingresos}
                  onChange={setIngresos}
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
                  <InputMoneda
                    value={montos[c.key] ?? 0}
                    onChange={(v) => cambiarMonto(c.key, v)}
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

          <section className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${esPremium ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <KpiCard
              label="Margen operativo"
              info="Qué porcentaje de cada peso que factura tu negocio queda como ganancia, después de pagar todos los gastos."
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
              info="Cuántos meses te alcanza la plata que tenés en el banco para cubrir tus gastos fijos, si de golpe dejaras de facturar."
              value={runwayMeses === Infinity ? '∞' : `${runwayMeses.toFixed(1)} meses`}
              status={runwayMeses >= 6 ? 'good' : runwayMeses >= 3 ? 'warning' : 'critical'}
              statusLabel="Si el ingreso cayera a cero, así de lejos llega tu caja pagando solo tus gastos fijos"
            />
            {esPremium && (
              <KpiCard
                label="Runway extendido"
                info="Lo mismo que el runway de caja, pero sumando lo que podrías conseguir vendiendo tu patrimonio (inversiones, vehículos, etc.) y tu stock si hiciera falta."
                value={runwayExtendido === Infinity ? '∞' : `${runwayExtendido.toFixed(1)} meses`}
                status={runwayExtendido >= 6 ? 'good' : runwayExtendido >= 3 ? 'warning' : 'critical'}
                statusLabel={
                  valorBienes > 0
                    ? `Caja + patrimonio y stock (${formatoMoneda(valorBienes)}), pagando solo gastos fijos`
                    : 'Cargá tus bienes en Patrimonio o productos en Stock para sumarlos acá'
                }
              />
            )}
            <KpiCard
              label="Punto de equilibrio"
              info="Cuánto tenés que facturar por mes como mínimo para no perder plata — ni ganar ni perder."
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
              info="Cuántos meses de tu ingreso actual necesitarías, sin gastar en nada más, para pagar toda la deuda que tenés pendiente."
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
            <GastosPorCategoria categorias={categoriasDona.categorias} esReal={categoriasDona.esReal} />
            <FlujoDeCaja
              saldoInicial={saldoInicial}
              ingresos={ingresosProyeccion}
              usaIngresosReales={usaIngresosReales}
              gastosTotales={gastosProyeccion}
              usaGastosReales={usaGastosReales}
              gastosExtraPorMes={gastosAguinaldo}
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
            <Button onClick={handleDescargarPdf} variante="primario" pill icono={<FileDown size={16} aria-hidden="true" />}>
              Descargar informe financiero
            </Button>
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
