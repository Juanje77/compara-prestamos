import { useEffect, useMemo, useRef, useState } from 'react'
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
import { IngresosGastos } from '../components/IngresosGastos'
import { InputMoneda } from '../components/InputMoneda'
import { Patrimonio } from '../components/Patrimonio'
import { CuentasCorrientes } from '../components/CuentasCorrientes'
import { RemitosPresupuestos } from '../components/RemitosPresupuestos'
import { Stock } from '../components/Stock'
import {
  CATEGORIAS_GASTO,
  agruparCuentaCorriente,
  aplicarMovimientoStock,
  calcularCoberturaDeuda,
  calcularCuotaDeudaTotal,
  calcularDeudaTotal,
  calcularDesvios,
  calcularEndeudamientoMeses,
  calcularGastosTotales,
  calcularMargenBrutoTotal,
  calcularMargenOperativo,
  calcularAgingCuentas,
  calcularDSOyDPO,
  calcularPosicionIngresosBrutosPorMes,
  calcularPosicionIvaPorMes,
  calcularPromediosMensualesReales,
  calcularPuntoEquilibrio,
  calcularRanking,
  calcularRealEfectivoPorMes,
  calcularRunwayExtendido,
  calcularRunwayMeses,
  calcularSaldoFactura,
  calcularSaldoTotalBancos,
  calcularTendenciaMensual,
  calcularValorTotalBienes,
  generarAlertas,
  generarRecomendaciones,
  generarMovimientosDeRemito,
  imputarPagoAFIFO,
  listarClientes,
  listarProveedores,
  listarRemitosPendientes,
  proyectarFlujoCaja,
  proyectarFlujoCajaEscenarios,
  revertirMovimientoStock,
  vincularRemitoAFactura,
  type Anticipo,
  type Bien,
  type CategoriaGasto,
  type Cheque,
  type ClasificacionesProveedores,
  type CuentaBancaria,
  type Deuda as DeudaTipo,
  type EstadoCheque,
  type IngresosBrutosManualMes,
  type IvaManualMes,
  type Factura,
  type MedioPago,
  type MovimientoDiario,
  type MovimientoStock,
  type Pago,
  type Producto,
  type RemitoPresupuesto,
  type TipoFactura,
  type TipoMovimientoStock,
} from '../lib/cfo'
import { formatoMoneda, formatoPorcentaje } from '../lib/finance'
import { abrirInformeFinanciero, abrirInformeSaludFinanciera } from '../lib/htmlReport'
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
  { key: 'facturas', label: 'Comprobantes' },
  { key: 'ingresosGastos', label: 'Ingresos y gastos' },
  { key: 'cobranzas', label: 'Cobranzas y pagos' },
  { key: 'cuentasCorrientes', label: 'Cuentas corrientes' },
  { key: 'remitos', label: 'Remitos y presupuestos' },
  { key: 'stock', label: 'Stock' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'presupuesto', label: 'Presupuesto vs. Real' },
  { key: 'cheques', label: 'Cheques' },
  { key: 'iva', label: 'Posición de IVA' },
  { key: 'iibb', label: 'Ingresos Brutos' },
  { key: 'patrimonio', label: 'Patrimonio' },
] as const

/** Secciones exclusivas del plan Full (el sistema de gestión de uso diario) — el resto que
 * requiere pago sigue disponible desde el plan Medio. */
const SECCIONES_FULL = new Set(['cuentasCorrientes', 'remitos', 'cheques', 'stock'])

type Seccion = (typeof SECCIONES)[number]['key']

interface Props {
  esPremium: boolean
  /** Plan Full (arriba de Medio) — desbloquea Cuentas corrientes, Remitos/presupuestos y
   * Cheques, el sistema de gestión de uso diario. */
  esFull?: boolean
}

export function EmpresasPage({ esPremium, esFull = false }: Props) {
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
  const [bienes, setBienes] = useState<Bien[]>(() => cargarNegocioData()?.bienes ?? [])
  const [realManualPorMes, setRealManualPorMes] = useState<Record<string, Record<string, number>>>(
    () => cargarNegocioData()?.realManualPorMes ?? {},
  )
  const [mesPresupuesto, setMesPresupuesto] = useState(() => mesActualISO())
  const [facturas, setFacturas] = useState<Factura[]>(() => cargarNegocioData()?.facturas ?? [])
  const [clasificaciones, setClasificaciones] = useState<ClasificacionesProveedores>(
    () => cargarNegocioData()?.clasificaciones ?? {},
  )
  const [clientesManual, setClientesManual] = useState<string[]>(() => cargarNegocioData()?.clientesManual ?? [])
  const [cheques, setCheques] = useState<Cheque[]>(() => cargarNegocioData()?.cheques ?? [])
  const [pagos, setPagos] = useState<Pago[]>(() => cargarNegocioData()?.pagos ?? [])
  const [remitos, setRemitos] = useState<RemitoPresupuesto[]>(() => cargarNegocioData()?.remitos ?? [])
  const [anticipos, setAnticipos] = useState<Anticipo[]>(() => cargarNegocioData()?.anticipos ?? [])
  const [productos, setProductos] = useState<Producto[]>(() => cargarNegocioData()?.productos ?? [])
  const [movimientosStock, setMovimientosStock] = useState<MovimientoStock[]>(
    () => cargarNegocioData()?.movimientosStock ?? [],
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
          setBienes(d.bienes ?? [])
          setRealManualPorMes(d.realManualPorMes ?? {})
          setFacturas(d.facturas ?? [])
          setClasificaciones(d.clasificaciones ?? {})
          setClientesManual(d.clientesManual ?? [])
          setCheques(d.cheques ?? [])
          setPagos(d.pagos ?? [])
          setRemitos(d.remitos ?? [])
          setAnticipos(d.anticipos ?? [])
          setProductos(d.productos ?? [])
          setMovimientosStock(d.movimientosStock ?? [])
          setIvaManualPorMes(d.ivaManualPorMes ?? {})
          setIngresosBrutosManualPorMes(d.ingresosBrutosManualPorMes ?? {})
          setMovimientosDiarios(d.movimientosDiarios ?? [])
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
      bienes,
      realManualPorMes,
      facturas,
      clasificaciones,
      clientesManual,
      cheques,
      pagos,
      remitos,
      anticipos,
      productos,
      movimientosStock,
      ivaManualPorMes,
      ingresosBrutosManualPorMes,
      movimientosDiarios,
      tasaCrecimiento,
      nombreNegocio,
    })
  }, [
    ingresos,
    meses,
    montos,
    cuentas,
    deudas,
    bienes,
    realManualPorMes,
    facturas,
    clasificaciones,
    clientesManual,
    cheques,
    pagos,
    remitos,
    anticipos,
    productos,
    movimientosStock,
    ivaManualPorMes,
    ingresosBrutosManualPorMes,
    movimientosDiarios,
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
          bienes,
          realManualPorMes,
          facturas,
          clasificaciones,
          clientesManual,
          cheques,
          pagos,
          remitos,
          anticipos,
          productos,
          movimientosStock,
          ivaManualPorMes,
          ingresosBrutosManualPorMes,
          movimientosDiarios,
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
    bienes,
    realManualPorMes,
    facturas,
    clasificaciones,
    clientesManual,
    cheques,
    pagos,
    remitos,
    anticipos,
    productos,
    movimientosStock,
    ivaManualPorMes,
    ingresosBrutosManualPorMes,
    movimientosDiarios,
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

  function handleAgregarBien(bien: Omit<Bien, 'id'>) {
    setBienes((prev) => [...prev, { ...bien, id: generarId() }])
  }

  function handleEliminarBien(id: string) {
    setBienes((prev) => prev.filter((b) => b.id !== id))
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
    if (cambios.medioPago === 'cheque') {
      const factura = facturas.find((f) => f.id === id)
      const quedaCumplida = cambios.cumplido ?? factura?.cumplido
      if (factura && quedaCumplida) crearChequeAutomatico({ ...factura, ...cambios })
    }
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
  }

  function handleCambiarEstadoCheque(id: string, estado: EstadoCheque) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)))
  }

  function handleCambiarComisionCheque(id: string, comisionDescuento: number) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, comisionDescuento } : c)))
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
    setCheques((prev) => prev.filter((c) => c.id !== id))
  }

  function handleAplicarPagoCuenta(
    contraparte: string,
    tipo: TipoFactura,
    monto: number,
    fecha: string,
    medioPago: MedioPago | undefined,
  ) {
    const grupo = (tipo === 'emitida' ? cuentaCorrienteCobrar : cuentaCorrientePagar).find(
      (g) => g.contraparte === contraparte,
    )
    if (!grupo || monto <= 0) return
    const { pagos: nuevosPagos, facturaIdsCubiertas } = imputarPagoAFIFO(grupo.facturas, monto, fecha, medioPago, generarId)
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
  }

  function handleAgregarRemito(remito: Omit<RemitoPresupuesto, 'id' | 'estado'>) {
    const nuevoRemito: RemitoPresupuesto = { ...remito, id: generarId(), estado: 'pendiente' }
    setRemitos((prev) => [...prev, nuevoRemito])
    const nuevosMovimientos = generarMovimientosDeRemito(nuevoRemito, generarId)
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
    setRemitos((prev) => prev.filter((r) => r.id !== id))
    setAnticipos((prev) => prev.filter((a) => a.remitoId !== id))
  }

  function handleRegistrarAnticipo(remitoId: string, monto: number, fecha: string, medioPago: MedioPago | undefined) {
    if (monto <= 0) return
    setAnticipos((prev) => [...prev, { id: generarId(), remitoId, monto, fecha, medioPago }])
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

  function handleAgregarMovimientoDiario(movimiento: Omit<MovimientoDiario, 'id'>) {
    setMovimientosDiarios((prev) => [...prev, { ...movimiento, id: generarId() }])
  }

  function handleEliminarMovimientoDiario(id: string) {
    setMovimientosDiarios((prev) => prev.filter((m) => m.id !== id))
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

  const { fijos: gastosFijos, variables: gastosVariables, total: gastosTotales } = calcularGastosTotales(categorias)
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
  const gastosEfectivos = usaGastosReales ? promediosReales!.comprasPromedio : gastosTotales
  const ingresosProyeccion = ingresosEfectivos
  const gastosProyeccion = gastosEfectivos

  const margenOperativo = calcularMargenOperativo(ingresosEfectivos, gastosEfectivos)
  // Runway: cuántos meses cubre la caja pagando SOLO los gastos fijos si el ingreso cayera a
  // cero — no los gastos totales, porque los variables (insumos, mercadería) dejarían de
  // comprarse junto con la caída del ingreso que los genera.
  const runwayMeses = calcularRunwayMeses(saldoInicial, gastosFijos)
  const valorBienes = useMemo(() => calcularValorTotalBienes(bienes), [bienes])
  const runwayExtendido = calcularRunwayExtendido(saldoInicial, valorBienes, gastosFijos)
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
    () => generarAlertas({ margenOperativo, runwayMeses, proyeccion, deudas, facturas }),
    [margenOperativo, runwayMeses, proyeccion, deudas, facturas],
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
    () => proyectarFlujoCajaEscenarios(saldoInicial, ingresosProyeccion, gastosProyeccion, meses, esPremium ? tasaCrecimiento : 0),
    [saldoInicial, ingresosProyeccion, gastosProyeccion, meses, esPremium, tasaCrecimiento],
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
            {SECCIONES_FULL.has(s.key)
              ? !esFull && ' 🔒'
              : !esPremium &&
                (s.key === 'presupuesto' ||
                  s.key === 'facturas' ||
                  s.key === 'proveedores' ||
                  s.key === 'clientes' ||
                  s.key === 'iva' ||
                  s.key === 'iibb' ||
                  s.key === 'patrimonio') &&
                ' 🔒'}
          </button>
        ))}
      </nav>

      {seccion === 'ingresosGastos' && (
        <IngresosGastos
          movimientos={movimientosDiarios}
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
          titulo="Comprobantes"
          descripcion="Importá tus facturas, notas de crédito y débito (desde ARCA o a mano) y mirá ventas y compras netas, margen bruto por mes, tus principales clientes/proveedores y qué tan sana es tu facturación."
          onQuieroPremium={abrirPlanes}
        >
          <Facturas
            facturas={facturas}
            pagos={pagos}
            onAgregar={handleAgregarFactura}
            onImportarVarias={handleImportarFacturas}
            onCambiar={handleCambiarFactura}
            onEliminar={handleEliminarFactura}
            onVaciar={handleVaciarFacturas}
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
            contrapartesClientes={contrapartesClientes}
            contrapartesProveedores={contrapartesProveedores}
            onAgregar={handleAgregarRemito}
            onRegistrarAnticipo={handleRegistrarAnticipo}
            onVincularFactura={handleVincularRemitoAFactura}
            onEliminar={handleEliminarRemito}
          />
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
              🔒 Con el plan Medio recibís alertas automáticas sobre tu caja, deudas y facturas vencidas
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
                📊 Ya cargaste ventas o compras en la solapa Comprobantes: los indicadores de abajo usan{' '}
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
                info="Lo mismo que el runway de caja, pero sumando lo que podrías conseguir vendiendo tu patrimonio (inversiones, vehículos, etc.) si hiciera falta."
                value={runwayExtendido === Infinity ? '∞' : `${runwayExtendido.toFixed(1)} meses`}
                status={runwayExtendido >= 6 ? 'good' : runwayExtendido >= 3 ? 'warning' : 'critical'}
                statusLabel={
                  valorBienes > 0
                    ? `Caja + patrimonio (${formatoMoneda(valorBienes)}), pagando solo gastos fijos`
                    : 'Cargá tus bienes en la solapa Patrimonio para sumarlos acá'
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
            <GastosPorCategoria categorias={categorias} />
            <FlujoDeCaja
              saldoInicial={saldoInicial}
              ingresos={ingresosProyeccion}
              usaIngresosReales={usaIngresosReales}
              gastosTotales={gastosProyeccion}
              usaGastosReales={usaGastosReales}
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
