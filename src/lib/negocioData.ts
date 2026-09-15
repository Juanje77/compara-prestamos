import type { Anticipo, Bien, Cheque, ClasificacionesProveedores, CuentaBancaria, Deuda, Factura, IngresosBrutosManualMes, IvaManualMes, MovimientoDiario, MovimientoStock, Pago, Producto, RemitoPresupuesto } from './cfo'

export interface NegocioData {
  ingresos: number
  meses: number
  montos: Record<string, number>
  cuentas: CuentaBancaria[]
  deudas: Deuda[]
  /** Patrimonio / bienes realizables ante un quiebre de caja — ver calcularRunwayExtendido. */
  bienes: Bien[]
  /** Ediciones manuales de "Real" por mes ("YYYY-MM") y categoría — lo que no está acá pero sí
   * hay facturas clasificadas, se completa solo (ver calcularRealEfectivoPorMes). */
  realManualPorMes: Record<string, Record<string, number>>
  facturas: Factura[]
  clasificaciones: ClasificacionesProveedores
  /** Clientes agregados a mano en la solapa Clientes, sin factura todavía — ver listarClientes. */
  clientesManual: string[]
  cheques: Cheque[]
  /** Pagos parciales imputados desde Cuentas corrientes — ver agruparCuentaCorriente. */
  pagos: Pago[]
  /** Remitos/presupuestos de trabajos todavía sin facturar — ver listarRemitosPendientes. */
  remitos: RemitoPresupuesto[]
  /** Anticipos cobrados/pagados contra un remito o presupuesto — ver calcularSaldoRemito. */
  anticipos: Anticipo[]
  /** Catálogo de productos de Stock — ver calcularValorInventario. */
  productos: Producto[]
  /** Historial de movimientos de stock (entrada/salida/ajuste) — ver aplicarMovimientoStock. */
  movimientosStock: MovimientoStock[]
  /** Ediciones manuales de la Posición de IVA por mes — ver calcularPosicionIvaPorMes. */
  ivaManualPorMes: Record<string, IvaManualMes>
  /** Ediciones manuales de la Posición de Ingresos Brutos por mes — ver calcularPosicionIngresosBrutosPorMes. */
  ingresosBrutosManualPorMes: Record<string, IngresosBrutosManualMes>
  /** Carga diaria simple de ingresos y gastos (Básico) — ver calcularResumenMovimientosDiarios. */
  movimientosDiarios: MovimientoDiario[]
  tasaCrecimiento: number
  nombreNegocio: string
}

const STORAGE_KEY = 'compara-prestamos.negocio-empresa'

export function cargarNegocioData(): Partial<NegocioData> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

export function guardarNegocioData(data: NegocioData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage no disponible (modo privado, etc.) — se ignora silenciosamente
  }
}

/** Borra la copia local — se usa al cerrar sesión, para que el próximo usuario en este
 * mismo navegador no vea (ni un instante) los datos del anterior mientras carga Firestore. */
export function borrarNegocioDataLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // se ignora
  }
}
