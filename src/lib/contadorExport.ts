import type { Cheque, CuentaBancaria, CuentaCorrienteContraparte, Factura, MovimientoTesoreria, TipoComprobante } from './cfo'
import { deltaDeMovimientoTesoreria, etiquetaEstadoCheque, ivaConSigno, montoConSigno, montoNetoCheque, montoNetoConSigno } from './cfo'

// ---------------------------------------------------------------------------
// Exportación a Excel para el contador: un libro con una hoja por cada
// registro contable (IVA, cuentas corrientes, cheques, tesorería), listo para
// mandar tal cual o importar en el sistema del estudio contable.
// ---------------------------------------------------------------------------

type FilaCelda = string | number | null

const TIPO_COMPROBANTE_LABEL: Record<TipoComprobante, string> = {
  factura: 'Factura',
  nota_credito: 'Nota de Crédito',
  nota_debito: 'Nota de Débito',
}

function fechaLegible(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR')
}

function encabezado(...columnas: string[]) {
  return columnas.map((c) => ({ value: c, fontWeight: 'bold' as const }))
}

function hojaIva(facturas: Factura[], tipo: 'emitida' | 'recibida', etiquetaContraparte: string) {
  const filas = facturas
    .filter((f) => f.tipo === tipo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const filasDatos: FilaCelda[][] = filas.map((f) => [
    fechaLegible(f.fecha),
    TIPO_COMPROBANTE_LABEL[f.tipoComprobante],
    f.numero ?? '',
    f.contraparte,
    montoNetoConSigno(f),
    ivaConSigno(f),
    montoConSigno(f),
  ])

  const totalNeto = filas.reduce((s, f) => s + montoNetoConSigno(f), 0)
  const totalIva = filas.reduce((s, f) => s + ivaConSigno(f), 0)
  const totalMonto = filas.reduce((s, f) => s + montoConSigno(f), 0)

  return {
    sheet: tipo === 'emitida' ? 'IVA Ventas' : 'IVA Compras',
    columns: [{ width: 12 }, { width: 16 }, { width: 12 }, { width: 28 }, { width: 14 }, { width: 12 }, { width: 14 }],
    data: [
      encabezado('Fecha', 'Comprobante', 'Número', etiquetaContraparte, 'Neto', 'IVA', 'Total'),
      ...filasDatos,
      [
        '',
        '',
        '',
        { value: 'TOTALES', fontWeight: 'bold' as const },
        { value: totalNeto, fontWeight: 'bold' as const },
        { value: totalIva, fontWeight: 'bold' as const },
        { value: totalMonto, fontWeight: 'bold' as const },
      ],
    ],
  }
}

function hojaCuentaCorriente(grupos: CuentaCorrienteContraparte[], titulo: string, etiquetaContraparte: string) {
  const filasDatos: FilaCelda[][] = []
  for (const grupo of [...grupos].sort((a, b) => a.contraparte.localeCompare(b.contraparte))) {
    for (const f of grupo.facturas) {
      filasDatos.push([grupo.contraparte, f.numero ?? '', fechaLegible(f.fecha), f.monto, f.montoPagado, f.saldo])
    }
  }
  const totalSaldo = grupos.reduce((s, g) => s + g.saldo, 0)

  return {
    sheet: titulo,
    columns: [{ width: 28 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }],
    data: [
      encabezado(etiquetaContraparte, 'Factura N°', 'Fecha', 'Monto', 'Pagado', 'Saldo'),
      ...filasDatos,
      ['', '', '', '', { value: 'TOTAL', fontWeight: 'bold' as const }, { value: totalSaldo, fontWeight: 'bold' as const }],
    ],
  }
}

function hojaCheques(cheques: Cheque[]) {
  const filas = [...cheques].sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))
  const filasDatos: FilaCelda[][] = filas.map((c) => [
    c.tipo === 'recibido' ? 'Recibido' : 'Emitido',
    c.banco,
    c.numero ?? '',
    c.contraparte,
    c.monto,
    fechaLegible(c.fechaEmision),
    fechaLegible(c.fechaCobro),
    etiquetaEstadoCheque(c.estado, c.tipo),
    c.comisionDescuento ?? 0,
    montoNetoCheque(c),
  ])

  return {
    sheet: 'Cheques',
    columns: [
      { width: 10 }, { width: 16 }, { width: 10 }, { width: 24 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    ],
    data: [
      encabezado('Tipo', 'Banco', 'Número', 'Cliente/Proveedor', 'Monto', 'Emisión', 'Cobro', 'Estado', 'Comisión', 'Neto'),
      ...filasDatos,
    ],
  }
}

function hojaResumenCuentas(cuentas: CuentaBancaria[]) {
  const filasDatos: FilaCelda[][] = cuentas.map((c) => [c.nombre, c.saldo])
  const total = cuentas.reduce((s, c) => s + c.saldo, 0)

  return {
    sheet: 'Resumen de cuentas',
    columns: [{ width: 28 }, { width: 14 }],
    data: [
      encabezado('Cuenta', 'Saldo'),
      ...filasDatos,
      [{ value: 'TOTAL', fontWeight: 'bold' as const }, { value: total, fontWeight: 'bold' as const }],
    ],
  }
}

const ORIGEN_LABEL: Record<MovimientoTesoreria['origen'], string> = {
  factura: 'Factura',
  anticipo: 'Anticipo',
  cheque: 'Cheque',
  sueldo: 'Sueldos',
  manual: 'Ajuste manual',
}

function hojaTesoreria(cuentas: CuentaBancaria[], movimientos: MovimientoTesoreria[]) {
  const nombrePorCuenta = new Map(cuentas.map((c) => [c.id, c.nombre]))
  const filas = [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const filasDatos: FilaCelda[][] = filas.map((m) => [
    nombrePorCuenta.get(m.cuentaId) ?? m.cuentaId,
    fechaLegible(m.fecha),
    deltaDeMovimientoTesoreria(m),
    m.concepto ?? '',
    ORIGEN_LABEL[m.origen],
  ])

  return {
    sheet: 'Movimientos Tesorería',
    columns: [{ width: 20 }, { width: 12 }, { width: 14 }, { width: 32 }, { width: 14 }],
    data: [encabezado('Cuenta', 'Fecha', 'Monto', 'Concepto', 'Origen'), ...filasDatos],
  }
}

export interface DatosExportacionContador {
  nombreNegocio: string
  facturas: Factura[]
  esFull: boolean
  cuentaCorrienteCobrar: CuentaCorrienteContraparte[]
  cuentaCorrientePagar: CuentaCorrienteContraparte[]
  cheques: Cheque[]
  cuentas: CuentaBancaria[]
  movimientosTesoreria: MovimientoTesoreria[]
}

/**
 * Arma un libro Excel con una hoja por cada registro contable — IVA Ventas/Compras siempre, y con
 * el plan Full además Cuentas por Cobrar/Pagar, Cheques, Resumen de cuentas y Movimientos de
 * Tesorería — y dispara la descarga.
 */
export async function exportarParaContador(datos: DatosExportacionContador) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default

  const hojas = [hojaIva(datos.facturas, 'emitida', 'Cliente'), hojaIva(datos.facturas, 'recibida', 'Proveedor')]

  if (datos.esFull) {
    hojas.push(
      hojaCuentaCorriente(datos.cuentaCorrienteCobrar, 'Cuentas por Cobrar', 'Cliente'),
      hojaCuentaCorriente(datos.cuentaCorrientePagar, 'Cuentas por Pagar', 'Proveedor'),
      hojaCheques(datos.cheques),
      hojaResumenCuentas(datos.cuentas),
      hojaTesoreria(datos.cuentas, datos.movimientosTesoreria),
    )
  }

  const slugNegocio = (datos.nombreNegocio.trim() || 'negocio').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const nombreArchivo = `contador-${slugNegocio}-${new Date().toISOString().slice(0, 10)}.xlsx`
  await writeXlsxFile(hojas).toFile(nombreArchivo)
}
