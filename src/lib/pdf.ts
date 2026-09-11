import { jsPDF } from 'jspdf'
import type { SimulacionGuardada } from './history'
import { formatoMoneda, formatoPorcentaje } from './finance'
import type { CategoriaGasto, CuentaBancaria, Deuda, FilaProyeccion, PuntoEquilibrio } from './cfo'
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

interface DashboardEmpresaPdfData {
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
  endeudamientoMeses: number
  proyeccion: FilaProyeccion[]
}

function encabezadoEmpresa(doc: jsPDF, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...NAVY)
  doc.text('FinCorp — Dashboard financiero para empresas', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text('Juan Costantini · Contador Público · MP: T20F94', 14, y + 6)
  return y + 14
}

const MENSAJE_PIE_EMPRESA =
  'Estimación orientativa a partir de los datos cargados por el usuario — no reemplaza un análisis financiero profesional. Asesoramiento: WhatsApp +54 9 2392 583117.'

export function descargarPdfDashboardEmpresa(datos: DashboardEmpresaPdfData) {
  const doc = new jsPDF()
  let y = encabezadoEmpresa(doc, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, 14, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Cuentas bancarias', 14, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (datos.cuentas.length === 0) {
    doc.setTextColor(...GRAY)
    doc.text('No se cargaron cuentas.', 14, y)
    y += 5.5
  } else {
    for (const c of datos.cuentas) {
      if (y > doc.internal.pageSize.getHeight() - 25) {
        pieDePagina(doc, MENSAJE_PIE_EMPRESA)
        doc.addPage()
        y = encabezadoEmpresa(doc, 20)
      }
      doc.setTextColor(...(c.saldo < 0 ? RED : ([40, 40, 40] as [number, number, number])))
      doc.text(`${c.nombre}: ${formatoMoneda(c.saldo)}${c.saldo < 0 ? ' (descubierto)' : ''}`, 14, y)
      y += 5.5
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(datos.saldoInicial < 0 ? RED : NAVY))
  doc.text(`Saldo total en bancos: ${formatoMoneda(datos.saldoInicial)}`, 14, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Deudas', 14, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (datos.deudas.length === 0) {
    doc.setTextColor(...GRAY)
    doc.text('No se cargaron deudas.', 14, y)
    y += 5.5
  } else {
    for (const d of datos.deudas) {
      if (y > doc.internal.pageSize.getHeight() - 25) {
        pieDePagina(doc, MENSAJE_PIE_EMPRESA)
        doc.addPage()
        y = encabezadoEmpresa(doc, 20)
      }
      doc.setTextColor(40, 40, 40)
      doc.text(`${d.concepto}: ${formatoMoneda(d.montoAdeudado)} (cuota ${formatoMoneda(d.cuotaMensual)}/mes)`, 14, y)
      y += 5.5
    }
    const deudaTotal = datos.deudas.reduce((s, d) => s + d.montoAdeudado, 0)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(`Deuda total: ${formatoMoneda(deudaTotal)}`, 14, y)
    y += 5.5
  }
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Datos del negocio', 14, y)
  y += 7
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
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Indicadores clave', 14, y)
  y += 7

  const margenColor: [number, number, number] =
    datos.margenOperativo >= 15 ? GREEN : datos.margenOperativo >= 0 ? AMBER : RED
  const runwayColor: [number, number, number] = datos.runwayMeses >= 6 ? GREEN : datos.runwayMeses >= 3 ? AMBER : RED
  const equilibrioColor: [number, number, number] = !datos.puntoEquilibrio.alcanzable
    ? RED
    : datos.ingresos >= datos.puntoEquilibrio.ingresosNecesarios
      ? GREEN
      : AMBER

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 40)
  doc.text('Margen operativo:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...margenColor)
  doc.text(formatoPorcentaje(datos.margenOperativo), 60, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  doc.text('Runway de caja:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...runwayColor)
  doc.text(datos.runwayMeses === Infinity ? 'Sin límite' : `${datos.runwayMeses.toFixed(1)} meses`, 60, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  doc.text('Punto de equilibrio:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...equilibrioColor)
  doc.text(
    datos.puntoEquilibrio.alcanzable ? formatoMoneda(datos.puntoEquilibrio.ingresosNecesarios) : 'No alcanzable',
    60,
    y,
  )
  y += 6

  const endeudamientoColor: [number, number, number] =
    datos.deudaTotal <= 0 || datos.endeudamientoMeses <= 3 ? GREEN : datos.endeudamientoMeses <= 6 ? AMBER : RED
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  doc.text('Endeudamiento:', 14, y)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...endeudamientoColor)
  doc.text(
    datos.deudaTotal <= 0
      ? 'Sin deudas'
      : datos.endeudamientoMeses === Infinity
        ? 'Sin límite'
        : `${datos.endeudamientoMeses.toFixed(1)} meses de ingreso`,
    60,
    y,
  )
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Composición de gastos', 14, y)
  y += 7

  doc.setFillColor(240, 240, 238)
  doc.rect(14, y - 4, 182, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Categoría', 16, y)
  doc.text('Tipo', 100, y)
  doc.text('Monto', 130, y)
  doc.text('% del total', 165, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  for (const c of datos.categorias.filter((c) => c.monto > 0)) {
    const pct = datos.gastosTotales > 0 ? (c.monto / datos.gastosTotales) * 100 : 0
    doc.text(c.label, 16, y)
    doc.text(c.tipo, 100, y)
    doc.text(formatoMoneda(c.monto), 130, y)
    doc.text(`${pct.toFixed(0)}%`, 165, y)
    y += 5.5
  }
  y += 6

  if (y > doc.internal.pageSize.getHeight() - 70) {
    pieDePagina(doc, MENSAJE_PIE_EMPRESA)
    doc.addPage()
    y = encabezadoEmpresa(doc, 20)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...NAVY)
  doc.text('Proyección de flujo de caja', 14, y)
  y += 7

  doc.setFillColor(240, 240, 238)
  doc.rect(14, y - 4, 182, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Mes', 16, y)
  doc.text('Saldo proyectado', 100, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  for (const fila of datos.proyeccion) {
    if (y > doc.internal.pageSize.getHeight() - 25) {
      pieDePagina(doc, MENSAJE_PIE_EMPRESA)
      doc.addPage()
      y = encabezadoEmpresa(doc, 20)
    }
    doc.setTextColor(...(fila.saldo < 0 ? RED : ([40, 40, 40] as [number, number, number])))
    doc.text(`Mes ${fila.mes}`, 16, y)
    doc.text(formatoMoneda(fila.saldo), 100, y)
    y += 5.5
  }

  pieDePagina(doc, MENSAJE_PIE_EMPRESA)
  doc.save(`dashboard-empresa-${new Date().toISOString().slice(0, 10)}.pdf`)
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
