import { jsPDF } from 'jspdf'
import type { SimulacionGuardada } from './history'
import { formatoMoneda, formatoPorcentaje } from './finance'

const NAVY: [number, number, number] = [22, 48, 92]
const GRAY: [number, number, number] = [90, 90, 90]
const GREEN: [number, number, number] = [12, 163, 12]

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

function pieDePagina(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(
    'Tasas de referencia — verificá siempre la tasa vigente con el banco antes de decidir. Asesoramiento: WhatsApp +54 9 2392 583117.',
    14,
    pageHeight - 10,
    { maxWidth: pageWidth - 28 },
  )
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
