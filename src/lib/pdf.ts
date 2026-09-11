import { jsPDF } from 'jspdf'
import type { SimulacionGuardada } from './history'
import { formatoMoneda, formatoPorcentaje } from './finance'
import type {
  CategoriaGasto,
  CuentaBancaria,
  Deuda,
  FilaProyeccion,
  MargenBrutoTotal,
  PuntoEquilibrio,
  RankingContraparte,
  ResumenMensual,
} from './cfo'
import type { Movimiento } from './movimientosSemana'
import type { AgrupacionSemanal } from './semanas'

const NAVY: [number, number, number] = [22, 48, 92]
const GRAY: [number, number, number] = [90, 90, 90]
const GREEN: [number, number, number] = [12, 163, 12]
const RED: [number, number, number] = [208, 59, 59]
const AMBER: [number, number, number] = [173, 122, 0]

const NOMBRE_TIPO: Record<SimulacionGuardada['tipo'], string> = {
  personal: 'Préstamo personal',
  prendario: 'Préstamo prendario (auto)',
  hipotecario: 'Crédito hipotecario (UVA)',
  jubilados: 'Préstamo para jubilados/pensionados (ANSES)',
}

function encabezado(doc: jsPDF, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...NAVY)
  doc.text('Comparador de Préstamos Argentina', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text('Juan Costantini · Contador Público · MP: T20F94', 14, y + 6)
  return y + 14
}

function pieDePagina(
  doc: jsPDF,
  mensaje = 'Tasas de referencia — verificá siempre la tasa vigente con el banco antes de decidir. Asesoramiento: WhatsApp +54 9 2392 583117.',
) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(mensaje, 14, pageHeight - 10, { maxWidth: pageWidth - 28 })
}

function dibujarTablaSimulacion(doc: jsPDF, sim: SimulacionGuardada, yInicial: number): number {
  let y = yInicial
  const esHipotecario = sim.tipo === 'hipotecario'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text(NOMBRE_TIPO[sim.tipo], 14, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  const fecha = new Date(sim.fecha).toLocaleString('es-AR')
  doc.text(
    `Fecha: ${fecha}   ·   Monto: ${formatoMoneda(sim.monto)}   ·   Plazo: ${sim.plazo} meses`,
    14,
    y,
  )
  y += 8

  const columnas = esHipotecario
    ? [
        { label: 'Banco', w: 75 },
        { label: 'TNA', w: 25 },
        { label: 'CFT', w: 25 },
        { label: 'Monto máx.', w: 40 },
      ]
    : [
        { label: 'Banco', w: 62 },
        { label: 'TNA', w: 18 },
        { label: 'CFT', w: 18 },
        { label: 'Cuota mensual', w: 33 },
        { label: 'Costo total', w: 33 },
      ]

  const xInicio = 14
  doc.setFillColor(240, 240, 238)
  doc.rect(xInicio, y - 4, columnas.reduce((s, c) => s + c.w, 0), 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  let x = xInicio + 2
  for (const col of columnas) {
    doc.text(col.label, x, y)
    x += col.w
  }
  y += 6

  const ordenadas = [...sim.ofertas].sort((a, b) => a.cft - b.cft)
  const mejorId = ordenadas[0]?.id

  doc.setFont('helvetica', 'normal')
  for (const o of ordenadas) {
    if (y > doc.internal.pageSize.getHeight() - 25) {
      pieDePagina(doc)
      doc.addPage()
      y = encabezado(doc, 20)
    }
    const esMejor = o.id === mejorId
    doc.setTextColor(...(esMejor ? GREEN : ([40, 40, 40] as [number, number, number])))
    doc.setFont('helvetica', esMejor ? 'bold' : 'normal')
    doc.setFontSize(8)
    x = xInicio + 2
    const maxLen = esMejor ? 20 : 30
    const nombreCorto = o.banco.length > maxLen ? `${o.banco.slice(0, maxLen - 1)}...` : o.banco
    const nombreBanco = esMejor ? `${nombreCorto} (MEJOR)` : nombreCorto
    const valores = esHipotecario
      ? [nombreBanco, formatoPorcentaje(o.tna), formatoPorcentaje(o.cft), formatoMoneda(o.montoMax)]
      : [
          nombreBanco,
          formatoPorcentaje(o.tna),
          formatoPorcentaje(o.cft),
          formatoMoneda(o.cuotaMensual),
          formatoMoneda(o.costoTotal),
        ]
    valores.forEach((v, i) => {
      doc.text(String(v), x, y)
      x += columnas[i].w
    })
    y += 6
  }

  return y + 8
}

export function descargarPdfSimulacion(sim: SimulacionGuardada) {
  const doc = new jsPDF()
  let y = encabezado(doc, 20)
  y = dibujarTablaSimulacion(doc, sim, y)
  pieDePagina(doc)
  const fechaArchivo = new Date(sim.fecha).toISOString().slice(0, 10)
  doc.save(`simulacion-${sim.tipo}-${fechaArchivo}.pdf`)
}

export function descargarPdfHistorial(simulaciones: SimulacionGuardada[]) {
  if (simulaciones.length === 0) return
  const doc = new jsPDF()
  let y = encabezado(doc, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Historial de ${simulaciones.length} simulación(es)`, 14, y)
  y += 10

  for (const sim of simulaciones) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      pieDePagina(doc)
      doc.addPage()
      y = encabezado(doc, 20)
    }
    y = dibujarTablaSimulacion(doc, sim, y)
  }

  pieDePagina(doc)
  doc.save(`historial-simulaciones-${new Date().toISOString().slice(0, 10)}.pdf`)
}

interface InformeFinancieroData {
  nombreNegocio: string
  cuentas: CuentaBancaria[]
  deudas: Deuda[]
  saldoInicial: number
  ingresos: number
  categorias: CategoriaGasto[]
  gastosFijos: number
  gastosVariables: number
  gastosTotales: number
  margenOperativo: number
  runwayMeses: number
  puntoEquilibrio: PuntoEquilibrio
  deudaTotal: number
  cuotaDeudaTotal: number
  endeudamientoMeses: number
  coberturaDeuda: number
  proyeccion: FilaProyeccion[]
}

const MENSAJE_PIE_EMPRESA =
  'Estimación orientativa a partir de los datos cargados por el usuario — no reemplaza un análisis financiero profesional. Asesoramiento: WhatsApp +54 9 2392 583117.'

function mesLegiblePdf(mes: string): string {
  const [anio, m] = mes.split('-')
  const fecha = new Date(Number(anio), Number(m) - 1, 1)
  return fecha.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
}

/** Helpers compartidos por los distintos informes (encabezado propio, paginación, títulos y tablas). */
function crearHelpersInforme(doc: jsPDF, titulo: string) {
  function encabezado(d: jsPDF, y: number): number {
    d.setFont('helvetica', 'bold')
    d.setFontSize(16)
    d.setTextColor(...NAVY)
    d.text(titulo, 14, y)
    d.setFont('helvetica', 'normal')
    d.setFontSize(10)
    d.setTextColor(...GRAY)
    d.text('Elaborado con FinCorp · Juan Costantini, Contador Público (MP: T20F94)', 14, y + 6)
    return y + 14
  }

  function saltoSiHaceFalta(y: number, margenInferior = 25): number {
    if (y > doc.internal.pageSize.getHeight() - margenInferior) {
      pieDePagina(doc, MENSAJE_PIE_EMPRESA)
      doc.addPage()
      return encabezado(doc, 20)
    }
    return y
  }

  function tituloSeccion(y: number, texto: string): number {
    y = saltoSiHaceFalta(y, 35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text(texto, 14, y)
    return y + 7
  }

  function encabezadoTabla(y: number, columnas: { label: string; x: number }[]): number {
    doc.setFillColor(240, 240, 238)
    doc.rect(14, y - 4, 182, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...GRAY)
    for (const col of columnas) doc.text(col.label, col.x, y)
    return y + 6
  }

  function filaIndicador(y: number, label: string, valor: string, color: [number, number, number]): number {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(label, 14, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...color)
    doc.text(valor, 75, y)
    return y + 6
  }

  return { encabezado, saltoSiHaceFalta, tituloSeccion, encabezadoTabla, filaIndicador }
}

export function descargarInformeFinanciero(datos: InformeFinancieroData) {
  const doc = new jsPDF()
  const tituloNegocio = datos.nombreNegocio.trim() || 'Tu negocio'
  const { encabezado, saltoSiHaceFalta, tituloSeccion, encabezadoTabla, filaIndicador } = crearHelpersInforme(
    doc,
    `Informe Financiero — ${tituloNegocio}`,
  )

  let y = encabezado(doc, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, y)
  y += 10

  // --- Resumen ejecutivo ---------------------------------------------------
  const margenColor: [number, number, number] = datos.margenOperativo >= 15 ? GREEN : datos.margenOperativo >= 0 ? AMBER : RED
  const runwayColor: [number, number, number] = datos.runwayMeses >= 6 ? GREEN : datos.runwayMeses >= 3 ? AMBER : RED
  const endeudamientoColor: [number, number, number] =
    datos.deudaTotal <= 0 || datos.endeudamientoMeses <= 3 ? GREEN : datos.endeudamientoMeses <= 6 ? AMBER : RED
  const equilibrioColor: [number, number, number] = !datos.puntoEquilibrio.alcanzable
    ? RED
    : datos.ingresos >= datos.puntoEquilibrio.ingresosNecesarios
      ? GREEN
      : AMBER
  const coberturaColor: [number, number, number] =
    datos.cuotaDeudaTotal <= 0 || datos.coberturaDeuda >= 2 ? GREEN : datos.coberturaDeuda >= 1.2 ? AMBER : RED

  const critico = datos.margenOperativo < 0 || datos.runwayMeses < 3 || (datos.cuotaDeudaTotal > 0 && datos.coberturaDeuda < 1.2)
  const ajustado =
    !critico && (datos.margenOperativo < 15 || datos.runwayMeses < 6 || datos.endeudamientoMeses > 6 || !datos.puntoEquilibrio.alcanzable)
  const veredicto = critico ? 'CRÍTICA' : ajustado ? 'AJUSTADA' : 'SALUDABLE'
  const veredictoColor: [number, number, number] = critico ? RED : ajustado ? AMBER : GREEN

  y = tituloSeccion(y, 'Resumen ejecutivo')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 40)
  doc.text('Situación financiera general:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...veredictoColor)
  doc.text(veredicto, 75, y)
  y += 8

  y = filaIndicador(y, 'Margen operativo:', formatoPorcentaje(datos.margenOperativo), margenColor)
  y = filaIndicador(
    y,
    'Runway de caja:',
    datos.runwayMeses === Infinity ? 'Sin límite' : `${datos.runwayMeses.toFixed(1)} meses`,
    runwayColor,
  )
  y = filaIndicador(
    y,
    'Punto de equilibrio:',
    datos.puntoEquilibrio.alcanzable ? formatoMoneda(datos.puntoEquilibrio.ingresosNecesarios) : 'No alcanzable',
    equilibrioColor,
  )
  y = filaIndicador(
    y,
    'Endeudamiento:',
    datos.deudaTotal <= 0
      ? 'Sin deudas'
      : datos.endeudamientoMeses === Infinity
        ? 'Sin límite'
        : `${datos.endeudamientoMeses.toFixed(1)} meses de ingreso`,
    endeudamientoColor,
  )
  y = filaIndicador(
    y,
    'Cobertura de deuda:',
    datos.cuotaDeudaTotal <= 0
      ? 'Sin cuotas'
      : datos.coberturaDeuda === Infinity
        ? 'Sin límite'
        : `${datos.coberturaDeuda.toFixed(1)}x el ingreso mensual`,
    coberturaColor,
  )
  y += 6

  // --- Ingresos y gastos -----------------------------------------------------
  y = tituloSeccion(y, 'Ingresos y gastos mensuales')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 40)
  doc.text(`Ingresos mensuales estimados: ${formatoMoneda(datos.ingresos)}`, 14, y)
  y += 5.5
  doc.text(
    `Gastos totales mensuales: ${formatoMoneda(datos.gastosTotales)}  (fijos: ${formatoMoneda(datos.gastosFijos)} · variables: ${formatoMoneda(datos.gastosVariables)})`,
    14,
    y,
  )
  y += 9

  y = saltoSiHaceFalta(y, 40)
  y = encabezadoTabla(y, [
    { label: 'Categoría', x: 16 },
    { label: 'Tipo', x: 100 },
    { label: 'Monto', x: 130 },
    { label: '% del total', x: 165 },
  ])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  for (const c of datos.categorias.filter((c) => c.monto > 0)) {
    y = saltoSiHaceFalta(y)
    const pct = datos.gastosTotales > 0 ? (c.monto / datos.gastosTotales) * 100 : 0
    doc.text(c.label, 16, y)
    doc.text(c.tipo, 100, y)
    doc.text(formatoMoneda(c.monto), 130, y)
    doc.text(`${pct.toFixed(0)}%`, 165, y)
    y += 5.5
  }
  y += 5

  // --- Cuentas bancarias y deudas ---------------------------------------------
  y = tituloSeccion(y, 'Cuentas bancarias')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (datos.cuentas.length === 0) {
    doc.setTextColor(...GRAY)
    doc.text('No se cargaron cuentas.', 14, y)
    y += 5.5
  } else {
    for (const c of datos.cuentas) {
      y = saltoSiHaceFalta(y)
      doc.setTextColor(...(c.saldo < 0 ? RED : ([40, 40, 40] as [number, number, number])))
      doc.text(`${c.nombre}: ${formatoMoneda(c.saldo)}${c.saldo < 0 ? ' (descubierto)' : ''}`, 14, y)
      y += 5.5
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(datos.saldoInicial < 0 ? RED : NAVY))
  doc.text(`Saldo total en bancos: ${formatoMoneda(datos.saldoInicial)}`, 14, y)
  y += 10

  y = tituloSeccion(y, 'Deudas')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (datos.deudas.length === 0) {
    doc.setTextColor(...GRAY)
    doc.text('No se cargaron deudas.', 14, y)
    y += 5.5
  } else {
    for (const d of datos.deudas) {
      y = saltoSiHaceFalta(y)
      doc.setTextColor(40, 40, 40)
      doc.text(`${d.concepto}: ${formatoMoneda(d.montoAdeudado)} (cuota ${formatoMoneda(d.cuotaMensual)}/mes)`, 14, y)
      y += 5.5
    }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(`Deuda total: ${formatoMoneda(datos.deudaTotal)}`, 14, y)
    y += 5.5
  }
  y += 5

  // --- Proyección de flujo de caja --------------------------------------------
  y = tituloSeccion(y, 'Proyección de flujo de caja')
  y = encabezadoTabla(y, [
    { label: 'Mes', x: 16 },
    { label: 'Saldo proyectado', x: 100 },
  ])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  for (const fila of datos.proyeccion) {
    y = saltoSiHaceFalta(y)
    doc.setTextColor(...(fila.saldo < 0 ? RED : ([40, 40, 40] as [number, number, number])))
    doc.text(`Mes ${fila.mes}`, 16, y)
    doc.text(formatoMoneda(fila.saldo), 100, y)
    y += 5.5
  }
  pieDePagina(doc, MENSAJE_PIE_EMPRESA)
  doc.save(`informe-financiero-${new Date().toISOString().slice(0, 10)}.pdf`)
}

interface InformeSaludFinancieraData {
  nombreNegocio: string
  resumenMensual: ResumenMensual[]
  rankingClientes: RankingContraparte[]
  rankingProveedores: RankingContraparte[]
  margenTotal: MargenBrutoTotal
}

/** Informe independiente, armado solo a partir de los comprobantes (facturas y notas de crédito/débito). */
export function descargarInformeSaludFinanciera(datos: InformeSaludFinancieraData) {
  const doc = new jsPDF()
  const tituloNegocio = datos.nombreNegocio.trim() || 'Tu negocio'
  const { encabezado, saltoSiHaceFalta, tituloSeccion, encabezadoTabla } = crearHelpersInforme(
    doc,
    `Informe de Salud Financiera — ${tituloNegocio}`,
  )

  let y = encabezado(doc, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, y)
  y += 4.5
  doc.setFont('helvetica', 'italic')
  doc.text('Elaborado a partir de tus facturas, notas de crédito y notas de débito importadas o cargadas.', 14, y)
  y += 10

  if (datos.resumenMensual.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.text('Todavía no se importaron ni cargaron comprobantes.', 14, y)
    pieDePagina(doc, MENSAJE_PIE_EMPRESA)
    doc.save(`informe-salud-financiera-${new Date().toISOString().slice(0, 10)}.pdf`)
    return
  }

  y = tituloSeccion(y, 'Resumen del período')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 40)
  doc.text(`Ventas netas del período: ${formatoMoneda(datos.margenTotal.ventasNetas)}`, 14, y)
  y += 5.5
  doc.text(`Compras netas del período: ${formatoMoneda(datos.margenTotal.comprasNetas)}`, 14, y)
  y += 5.5
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(datos.margenTotal.margenBruto >= 0 ? GREEN : RED))
  doc.text(
    `Margen bruto del período: ${formatoMoneda(datos.margenTotal.margenBruto)} (${formatoPorcentaje(datos.margenTotal.margenBrutoPct)})`,
    14,
    y,
  )
  y += 5
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('Es la suma de todas las ventas menos la suma de todas las compras del período, no un promedio mensual.', 14, y)
  y += 9

  y = tituloSeccion(y, 'Ventas y compras netas por mes')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.text('Solo para ver la evolución mes a mes — el margen del período se calcula arriba, sobre el total.', 14, y)
  y += 5
  y = encabezadoTabla(y, [
    { label: 'Mes', x: 16 },
    { label: 'Ventas netas', x: 90 },
    { label: 'Compras netas', x: 145 },
  ])
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  for (const r of datos.resumenMensual) {
    y = saltoSiHaceFalta(y)
    doc.text(mesLegiblePdf(r.mes), 16, y)
    doc.text(formatoMoneda(r.ventasNetas), 90, y)
    doc.text(formatoMoneda(r.comprasNetas), 145, y)
    y += 5.5
  }
  y += 6

  y = saltoSiHaceFalta(y, 40)
  y = tituloSeccion(y, 'Principales clientes y proveedores')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('Top clientes', 14, y)
  doc.text('Top proveedores', 105, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  const truncar = (texto: string, maxLen = 28) => (texto.length > maxLen ? `${texto.slice(0, maxLen - 1)}…` : texto)
  const maxFilas = Math.max(datos.rankingClientes.length, datos.rankingProveedores.length)
  if (maxFilas === 0) {
    doc.setTextColor(...GRAY)
    doc.text('Sin datos suficientes.', 14, y)
    y += 8
  } else {
    for (let i = 0; i < maxFilas; i++) {
      y = saltoSiHaceFalta(y)
      const cliente = datos.rankingClientes[i]
      const proveedor = datos.rankingProveedores[i]
      if (cliente) doc.text(`${truncar(cliente.contraparte)}: ${formatoMoneda(cliente.monto)}`, 14, y)
      if (proveedor) doc.text(`${truncar(proveedor.contraparte)}: ${formatoMoneda(proveedor.monto)}`, 105, y)
      y += 5.5
    }
    y += 5
  }

  pieDePagina(doc, MENSAJE_PIE_EMPRESA)
  doc.save(`informe-salud-financiera-${new Date().toISOString().slice(0, 10)}.pdf`)
}

function encabezadoCobranzas(doc: jsPDF, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...NAVY)
  doc.text('FinCorp — Cobranzas y pagos semanales', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text('Juan Costantini · Contador Público · MP: T20F94', 14, y + 6)
  return y + 14
}

export function descargarPdfCobranzasSemanal(agrupacion: AgrupacionSemanal, movimientos: Movimiento[]) {
  const doc = new jsPDF()
  let y = encabezadoCobranzas(doc, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, y)
  y += 10

  // --- Resumen: 4 columnas, una por semana ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Resumen semanal', 14, y)
  y += 8

  const xInicio = 14
  const colEtiqueta = 32
  const anchoDisponible = 182 - colEtiqueta
  const colSemana = anchoDisponible / agrupacion.semanas.length

  doc.setFillColor(240, 240, 238)
  doc.rect(xInicio, y - 4, 182, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  agrupacion.semanas.forEach((s, i) => {
    const x = xInicio + colEtiqueta + i * colSemana
    doc.text(`Semana ${i + 1}`, x, y - 1)
    doc.text(`${s.inicio.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}-${s.fin.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`, x, y + 2.5)
  })
  y += 8

  const filas: { label: string; valores: number[]; color?: (v: number) => [number, number, number] }[] = [
    { label: 'Cobros', valores: agrupacion.totalesPorSemana.map((t) => t.cobros) },
    { label: 'Pagos', valores: agrupacion.totalesPorSemana.map((t) => t.pagos) },
    {
      label: 'Saldo neto',
      valores: agrupacion.totalesPorSemana.map((t) => t.saldo),
      color: (v) => (v >= 0 ? GREEN : RED),
    },
  ]

  for (const fila of filas) {
    doc.setFont('helvetica', fila.label === 'Saldo neto' ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(40, 40, 40)
    doc.text(fila.label, xInicio, y)
    fila.valores.forEach((v, i) => {
      const x = xInicio + colEtiqueta + i * colSemana
      doc.setTextColor(...(fila.color ? fila.color(v) : ([40, 40, 40] as [number, number, number])))
      doc.text(formatoMoneda(v), x, y)
    })
    y += 6
  }
  y += 6

  // --- Detalle por semana ---
  const movimientosPorSemana = (idx: number) =>
    movimientos.filter((m) => {
      const fecha = new Date(`${m.fecha}T00:00:00`)
      return fecha >= agrupacion.semanas[idx].inicio && fecha <= agrupacion.semanas[idx].fin
    })

  agrupacion.semanas.forEach((semana, idx) => {
    const items = movimientosPorSemana(idx)
    if (items.length === 0) return

    if (y > doc.internal.pageSize.getHeight() - 40) {
      pieDePagina(doc, MENSAJE_PIE_EMPRESA)
      doc.addPage()
      y = encabezadoCobranzas(doc, 20)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...NAVY)
    doc.text(semana.label, 14, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const m of items) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        pieDePagina(doc, MENSAJE_PIE_EMPRESA)
        doc.addPage()
        y = encabezadoCobranzas(doc, 20)
      }
      doc.setTextColor(...(m.tipo === 'cobro' ? GREEN : RED))
      doc.text(m.tipo === 'cobro' ? 'Cobrar' : 'Pagar', 16, y)
      doc.setTextColor(40, 40, 40)
      doc.text(m.concepto, 40, y)
      doc.text(new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR'), 120, y)
      doc.text(formatoMoneda(m.monto), 150, y)
      doc.setTextColor(...GRAY)
      doc.text(m.cumplido ? 'Cumplido' : 'Pendiente', 175, y)
      y += 5.5
    }
    y += 4
  })

  pieDePagina(doc, MENSAJE_PIE_EMPRESA)
  doc.save(`cobranzas-pagos-semanal-${new Date().toISOString().slice(0, 10)}.pdf`)
}
