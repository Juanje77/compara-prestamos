// Informes en HTML, pensados para abrirse en una pestaña nueva e imprimirse como PDF desde el
// propio navegador (Ctrl+P / Cmd+P → Guardar como PDF). En vez de dibujar texto plano con jsPDF,
// se arma un documento con CSS de verdad y gráficos en SVG — mucho más flexible y prolijo que
// dibujar rectángulos a mano, sin agregar ninguna dependencia nueva.
import { formatoMoneda, formatoPorcentaje } from './finance'
import type {
  AgingCuentas,
  CategoriaGasto,
  CuentaBancaria,
  Deuda,
  EscenarioProyeccion,
  FilaProyeccion,
  IndicadoresCobroPago,
  MargenBrutoTotal,
  PuntoEquilibrio,
  RankingContraparte,
  Recomendacion,
  TendenciaMensual,
} from './cfo'
import { calcularCostoEmpleado, type Empleado } from './cfo'

// ---------------------------------------------------------------------------
// Paleta — misma que src/index.css (modo claro), fijada en hexadecimal porque
// el documento se abre en una pestaña propia, sin las variables CSS de la app.
// ---------------------------------------------------------------------------

const COLOR = {
  navy: '#16305c',
  texto: '#0b0b0b',
  textoSecundario: '#52514e',
  textoMuted: '#898781',
  borde: '#e1e0d9',
  fondo: '#fcfcfb',
  fondoAlterno: '#f9f9f7',
  azul: '#0052ff',
  serie2: '#eb6834',
  serie3: '#1baf7a',
  serie4: '#eda100',
  serie5: '#e87ba4',
  serie6: '#008300',
  serie7: '#4a3aa7',
  bueno: '#006300',
  advertencia: '#b3790f',
  critico: '#d03b3b',
} as const

const SERIES = [COLOR.azul, COLOR.serie2, COLOR.serie3, COLOR.serie4, COLOR.serie5, COLOR.serie6, COLOR.serie7]

function escapeHtml(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Gráficos en SVG
// ---------------------------------------------------------------------------

interface ItemBarra {
  label: string
  value: number
  color?: string
}

/** Barras horizontales — para rankings, aging y composición de gastos: mejor que un gráfico de
 * torta cuando hay más de 4-5 categorías (más fácil de comparar longitudes que ángulos). */
function svgBarrasHorizontales(items: ItemBarra[], formato: (n: number) => string = formatoMoneda): string {
  if (items.length === 0) return ''
  const ancho = 640
  const altoFila = 30
  const alto = items.length * altoFila + 8
  const anchoBarraMax = ancho - 320
  const maxValor = Math.max(1, ...items.map((i) => Math.abs(i.value)))

  const filas = items
    .map((item, i) => {
      const y = i * altoFila
      const w = Math.max(2, (Math.abs(item.value) / maxValor) * anchoBarraMax)
      const color = item.color ?? COLOR.azul
      return `
        <text x="0" y="${y + 19}" font-size="12.5" fill="${COLOR.textoSecundario}">${escapeHtml(item.label)}</text>
        <rect x="220" y="${y + 4}" width="${w}" height="18" rx="3" fill="${color}"/>
        <text x="${220 + w + 10}" y="${y + 18}" font-size="12.5" font-weight="600" fill="${COLOR.texto}">${escapeHtml(formato(item.value))}</text>
      `
    })
    .join('')

  return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" style="max-width:${ancho}px;display:block">${filas}</svg>`
}

interface SerieLinea {
  nombre: string
  color: string
  puntos: number[]
  discontinua?: boolean
}

/** Gráfico de líneas simple (uno o varios ejes Y compartidos) — para tendencias mes a mes. */
function svgLineas(series: SerieLinea[], etiquetasX: string[], formato: (n: number) => string = formatoMoneda): string {
  const ancho = 640
  const alto = 230
  const margen = { top: 12, right: 32, bottom: 28, left: 78 }
  const anchoGrafico = ancho - margen.left - margen.right
  const altoGrafico = alto - margen.top - margen.bottom
  const n = etiquetasX.length

  const todos = series.flatMap((s) => s.puntos)
  const maxV = Math.max(...todos, 0)
  const minV = Math.min(...todos, 0)
  const rango = maxV - minV || 1

  const x = (i: number) => margen.left + (n <= 1 ? anchoGrafico / 2 : (i / (n - 1)) * anchoGrafico)
  const y = (v: number) => margen.top + altoGrafico - ((v - minV) / rango) * altoGrafico

  const pasos = 4
  let grilla = ''
  for (let g = 0; g <= pasos; g++) {
    const valor = minV + (rango * g) / pasos
    const yy = y(valor)
    grilla += `<line x1="${margen.left}" y1="${yy}" x2="${ancho - margen.right}" y2="${yy}" stroke="${COLOR.borde}" stroke-width="1"/>`
    grilla += `<text x="${margen.left - 8}" y="${yy + 4}" font-size="10.5" text-anchor="end" fill="${COLOR.textoMuted}">${escapeHtml(formato(valor))}</text>`
  }

  const ejeX = etiquetasX
    .map((t, i) => `<text x="${x(i)}" y="${alto - 8}" font-size="10.5" text-anchor="middle" fill="${COLOR.textoMuted}">${escapeHtml(t)}</text>`)
    .join('')

  const lineas = series
    .map((s) => {
      const puntos = s.puntos.map((v, i) => `${x(i)},${y(v)}`).join(' ')
      const puntitos = s.puntos.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}"/>`).join('')
      const dash = s.discontinua ? ' stroke-dasharray="5,4"' : ''
      return `<polyline points="${puntos}" fill="none" stroke="${s.color}" stroke-width="2.5"${dash}/>${puntitos}`
    })
    .join('')

  const leyenda = series
    .map(
      (s) =>
        `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:18px"><span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block"></span>${escapeHtml(s.nombre)}</span>`,
    )
    .join('')

  return `
    <svg viewBox="0 0 ${ancho} ${alto}" width="100%" style="max-width:${ancho}px;display:block">${grilla}${lineas}${ejeX}</svg>
    <div style="margin-top:8px;font-size:12px;color:${COLOR.textoSecundario}">${leyenda}</div>
  `
}

interface ItemDona {
  label: string
  value: number
  color: string
}

/** Dona — para composiciones con pocas categorías (máximo 5-6, si no conviene una barra). */
function svgDona(items: ItemDona[], tam = 150): string {
  const positivos = items.filter((i) => i.value > 0)
  if (positivos.length === 0) return ''
  const r = tam / 2 - 6
  const cx = tam / 2
  const cy = tam / 2
  const total = positivos.reduce((s, i) => s + i.value, 0) || 1
  let anguloActual = -90

  const arcos = positivos
    .map((item) => {
      const angulo = (item.value / total) * 360
      const rad1 = (Math.PI * anguloActual) / 180
      const anguloFin = anguloActual + angulo
      const rad2 = (Math.PI * anguloFin) / 180
      const x1 = cx + r * Math.cos(rad1)
      const y1 = cy + r * Math.sin(rad1)
      const x2 = cx + r * Math.cos(rad2)
      const y2 = cy + r * Math.sin(rad2)
      const largeArc = angulo > 180 ? 1 : 0
      anguloActual = anguloFin
      return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${item.color}" stroke="${COLOR.fondo}" stroke-width="2"/>`
    })
    .join('')

  return `<svg viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}">${arcos}<circle cx="${cx}" cy="${cy}" r="${r * 0.56}" fill="${COLOR.fondo}"/></svg>`
}

// ---------------------------------------------------------------------------
// Bloques de HTML reutilizables
// ---------------------------------------------------------------------------

function tarjetaKpi(label: string, valor: string, color: string, sublabel?: string): string {
  return `
    <div class="kpi">
      <p class="kpi-label">${escapeHtml(label)}</p>
      <p class="kpi-valor" style="color:${color}">${escapeHtml(valor)}</p>
      ${sublabel ? `<p class="kpi-sub">${escapeHtml(sublabel)}</p>` : ''}
    </div>
  `
}

function seccion(titulo: string, contenido: string, descripcion?: string): string {
  return `
    <section class="seccion">
      <h2>${escapeHtml(titulo)}</h2>
      ${descripcion ? `<p class="descripcion">${escapeHtml(descripcion)}</p>` : ''}
      ${contenido}
    </section>
  `
}

function badgePrioridad(prioridad: 'alta' | 'media'): string {
  const color = prioridad === 'alta' ? COLOR.critico : COLOR.advertencia
  return `<span class="badge" style="background:${color}">${prioridad.toUpperCase()}</span>`
}

function bloqueRecomendaciones(recomendaciones: Recomendacion[]): string {
  if (recomendaciones.length === 0) return ''
  const items = recomendaciones
    .map((r) => `<li>${badgePrioridad(r.prioridad)}<span>${escapeHtml(r.texto)}</span></li>`)
    .join('')
  return seccion('💡 Qué hacer', `<ul class="recomendaciones">${items}</ul>`)
}

function mesLegible(mes: string): string {
  const [anio, m] = mes.split('-')
  const fecha = new Date(Number(anio), Number(m) - 1, 1)
  const texto = fecha.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// ---------------------------------------------------------------------------
// Documento base
// ---------------------------------------------------------------------------

const ESTILO = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #e5e4de;
    color: ${COLOR.texto};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .barra-imprimir {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 10px;
    background: ${COLOR.navy};
  }
  .barra-imprimir button {
    background: white;
    color: ${COLOR.navy};
    border: none;
    border-radius: 999px;
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .hoja {
    max-width: 800px;
    margin: 24px auto;
    background: ${COLOR.fondo};
    padding: 40px 48px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.12);
  }
  .encabezado {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid ${COLOR.navy};
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .marca { display: flex; align-items: center; gap: 10px; }
  .logo {
    width: 34px; height: 34px; border-radius: 8px; background: ${COLOR.navy};
    color: white; display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 17px; font-family: Georgia, serif;
  }
  .marca-nombre { font-weight: 800; font-size: 19px; color: ${COLOR.navy}; letter-spacing: -0.02em; }
  .marca-nombre span { color: ${COLOR.azul}; }
  h1 { font-size: 21px; margin: 2px 0 2px; color: ${COLOR.navy}; }
  .meta { font-size: 12px; color: ${COLOR.textoMuted}; text-align: right; }
  .veredicto {
    display: inline-block; padding: 3px 14px; border-radius: 999px; color: white;
    font-weight: 700; font-size: 12.5px; letter-spacing: 0.03em;
  }
  .seccion { margin-bottom: 26px; page-break-inside: avoid; }
  .seccion h2 { font-size: 15px; color: ${COLOR.navy}; margin: 0 0 6px; }
  .seccion h3 { font-size: 13px; color: ${COLOR.texto}; margin: 14px 0 8px; }
  .descripcion { font-size: 12px; color: ${COLOR.textoMuted}; margin: 0 0 12px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 6px; }
  .kpi { border: 1px solid ${COLOR.borde}; border-radius: 10px; padding: 12px 14px; background: ${COLOR.fondoAlterno}; }
  .kpi-label { font-size: 11px; color: ${COLOR.textoMuted}; margin: 0 0 2px; }
  .kpi-valor { font-size: 17px; font-weight: 700; margin: 0; }
  .kpi-sub { font-size: 10.5px; color: ${COLOR.textoMuted}; margin: 2px 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.02em; color: ${COLOR.textoMuted}; padding: 0 8px 6px 0; border-bottom: 1px solid ${COLOR.borde}; }
  td { padding: 7px 8px 7px 0; border-bottom: 1px solid ${COLOR.borde}; }
  td.num, th.num { text-align: right; }
  tfoot td { font-weight: 700; border-top: 2px solid ${COLOR.navy}; border-bottom: none; }
  ul.recomendaciones { list-style: none; margin: 0; padding: 0; }
  ul.recomendaciones li { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px solid ${COLOR.borde}; font-size: 12.5px; }
  ul.recomendaciones li:last-child { border-bottom: none; }
  .badge { flex-shrink: 0; color: white; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px; margin-top: 1px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .flex-dona { display: flex; align-items: center; gap: 20px; }
  .leyenda-dona { list-style: none; margin: 0; padding: 0; font-size: 12px; flex: 1; }
  .leyenda-dona li { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
  .punto { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
  .pie-pagina { margin-top: 32px; padding-top: 14px; border-top: 1px solid ${COLOR.borde}; font-size: 10.5px; color: ${COLOR.textoMuted}; font-style: italic; }
  @media print {
    body { background: white; }
    .barra-imprimir { display: none; }
    .hoja { box-shadow: none; margin: 0; max-width: none; padding: 0; }
    @page { margin: 16mm; }
  }
`

function documentoBase(titulo: string, tituloNegocio: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(titulo)} - ${escapeHtml(tituloNegocio)}</title>
<style>${ESTILO}</style>
</head>
<body>
  <div class="barra-imprimir">
    <button onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
  </div>
  <div class="hoja">
    ${cuerpo}
    <p class="pie-pagina">Estimación orientativa a partir de los datos cargados por el usuario — no reemplaza un análisis financiero profesional. Elaborado con FinCorp · Juan Costantini, Contador Público (MP: T20F94). Asesoramiento: WhatsApp +54 9 2392 583117.</p>
  </div>
</body>
</html>`
}

function encabezadoDocumento(titulo: string, subtitulo: string): string {
  return `
    <div class="encabezado">
      <div>
        <div class="marca">
          <span class="logo">F</span>
          <span class="marca-nombre">Fin<span>Corp</span></span>
        </div>
        <h1>${escapeHtml(titulo)}</h1>
        <p style="margin:0;color:${COLOR.textoSecundario};font-size:13px">${escapeHtml(subtitulo)}</p>
      </div>
      <p class="meta">Generado el<br>${escapeHtml(new Date().toLocaleString('es-AR'))}</p>
    </div>
  `
}

/** Abre el documento en una pestaña nueva vía un Blob URL — el usuario lo imprime a PDF desde ahí
 * con el diálogo nativo del navegador (no requiere ninguna librería de generación de PDF). */
function abrirDocumentoHtml(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const ventana = window.open(url, '_blank')
  if (!ventana) {
    window.alert('El navegador bloqueó la ventana del informe. Permití los pop-ups para este sitio e intentá de nuevo.')
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// ---------------------------------------------------------------------------
// Informe financiero (Dashboard)
// ---------------------------------------------------------------------------

export interface InformeFinancieroData {
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
  escenarios: EscenarioProyeccion[]
  recomendaciones: Recomendacion[]
}

export function abrirInformeFinanciero(datos: InformeFinancieroData) {
  const tituloNegocio = datos.nombreNegocio.trim() || 'Tu negocio'

  const margenColor = datos.margenOperativo >= 15 ? COLOR.bueno : datos.margenOperativo >= 0 ? COLOR.advertencia : COLOR.critico
  const runwayColor = datos.runwayMeses >= 6 ? COLOR.bueno : datos.runwayMeses >= 3 ? COLOR.advertencia : COLOR.critico
  const endeudamientoColor =
    datos.deudaTotal <= 0 || datos.endeudamientoMeses <= 3 ? COLOR.bueno : datos.endeudamientoMeses <= 6 ? COLOR.advertencia : COLOR.critico
  const equilibrioColor = !datos.puntoEquilibrio.alcanzable
    ? COLOR.critico
    : datos.ingresos >= datos.puntoEquilibrio.ingresosNecesarios
      ? COLOR.bueno
      : COLOR.advertencia
  const coberturaColor =
    datos.cuotaDeudaTotal <= 0 || datos.coberturaDeuda >= 2 ? COLOR.bueno : datos.coberturaDeuda >= 1.2 ? COLOR.advertencia : COLOR.critico

  const critico = datos.margenOperativo < 0 || datos.runwayMeses < 3 || (datos.cuotaDeudaTotal > 0 && datos.coberturaDeuda < 1.2)
  const ajustado =
    !critico &&
    (datos.margenOperativo < 15 || datos.runwayMeses < 6 || datos.endeudamientoMeses > 6 || !datos.puntoEquilibrio.alcanzable)
  const veredicto = critico ? 'CRÍTICA' : ajustado ? 'AJUSTADA' : 'SALUDABLE'
  const veredictoColor = critico ? COLOR.critico : ajustado ? COLOR.advertencia : COLOR.bueno

  const resumenEjecutivo = seccion(
    'Resumen ejecutivo',
    `
      <p style="margin:0 0 14px">Situación financiera general: <span class="veredicto" style="background:${veredictoColor}">${veredicto}</span></p>
      <div class="kpis">
        ${tarjetaKpi('Margen operativo', formatoPorcentaje(datos.margenOperativo), margenColor)}
        ${tarjetaKpi('Runway de caja', datos.runwayMeses === Infinity ? 'Sin límite' : `${datos.runwayMeses.toFixed(1)} meses`, runwayColor)}
        ${tarjetaKpi(
          'Punto de equilibrio',
          datos.puntoEquilibrio.alcanzable ? formatoMoneda(datos.puntoEquilibrio.ingresosNecesarios) : 'No alcanzable',
          equilibrioColor,
        )}
        ${tarjetaKpi(
          'Endeudamiento',
          datos.deudaTotal <= 0 ? 'Sin deudas' : datos.endeudamientoMeses === Infinity ? 'Sin límite' : `${datos.endeudamientoMeses.toFixed(1)} meses de ingreso`,
          endeudamientoColor,
        )}
        ${tarjetaKpi(
          'Cobertura de deuda',
          datos.cuotaDeudaTotal <= 0 ? 'Sin cuotas' : datos.coberturaDeuda === Infinity ? 'Sin límite' : `${datos.coberturaDeuda.toFixed(1)}x el ingreso`,
          coberturaColor,
        )}
      </div>
    `,
  )

  const categoriasConMonto = datos.categorias.filter((c) => c.monto > 0)
  const donaGastos = svgDona(
    categoriasConMonto.map((c, i) => ({ label: c.label, value: c.monto, color: SERIES[i % SERIES.length] })),
  )
  const leyendaGastos = categoriasConMonto
    .map(
      (c, i) => `
      <li>
        <span class="punto" style="background:${SERIES[i % SERIES.length]}"></span>
        <span style="flex:1">${escapeHtml(c.label)}</span>
        <strong>${escapeHtml(formatoMoneda(c.monto))}</strong>
      </li>
    `,
    )
    .join('')

  const ingresosGastos = seccion(
    'Ingresos y gastos mensuales',
    `
      <div class="kpis" style="margin-bottom:16px">
        ${tarjetaKpi('Ingresos mensuales', formatoMoneda(datos.ingresos), COLOR.texto)}
        ${tarjetaKpi('Gastos fijos', formatoMoneda(datos.gastosFijos), COLOR.texto)}
        ${tarjetaKpi('Gastos variables', formatoMoneda(datos.gastosVariables), COLOR.texto)}
        ${tarjetaKpi('Gastos totales', formatoMoneda(datos.gastosTotales), COLOR.texto)}
      </div>
      <h3>Composición de gastos</h3>
      <div class="flex-dona">
        ${donaGastos}
        <ul class="leyenda-dona">${leyendaGastos}</ul>
      </div>
    `,
  )

  const filasCuentas =
    datos.cuentas.length === 0
      ? '<tr><td colspan="2" style="color:' + COLOR.textoMuted + '">No se cargaron cuentas.</td></tr>'
      : datos.cuentas
          .map(
            (c) =>
              `<tr><td>${escapeHtml(c.nombre)}</td><td class="num" style="color:${c.saldo < 0 ? COLOR.critico : COLOR.texto}">${escapeHtml(formatoMoneda(c.saldo))}${c.saldo < 0 ? ' (descubierto)' : ''}</td></tr>`,
          )
          .join('')

  const filasDeudas =
    datos.deudas.length === 0
      ? '<tr><td colspan="3" style="color:' + COLOR.textoMuted + '">No se cargaron deudas.</td></tr>'
      : datos.deudas
          .map(
            (d) =>
              `<tr><td>${escapeHtml(d.concepto)}</td><td class="num">${escapeHtml(formatoMoneda(d.montoAdeudado))}</td><td class="num">${escapeHtml(formatoMoneda(d.cuotaMensual))}/mes</td></tr>`,
          )
          .join('')

  const cuentasYDeudas = seccion(
    'Cuentas bancarias y deudas',
    `
      <div class="grid-2">
        <div>
          <h3>Cuentas bancarias</h3>
          <table><tbody>${filasCuentas}</tbody>
            <tfoot><tr><td>Saldo total</td><td class="num" style="color:${datos.saldoInicial < 0 ? COLOR.critico : COLOR.navy}">${escapeHtml(formatoMoneda(datos.saldoInicial))}</td></tr></tfoot>
          </table>
        </div>
        <div>
          <h3>Deudas</h3>
          <table><tbody>${filasDeudas}</tbody>
            <tfoot><tr><td colspan="2">Deuda total</td><td class="num">${escapeHtml(formatoMoneda(datos.deudaTotal))}</td></tr></tfoot>
          </table>
        </div>
      </div>
    `,
  )

  const base = datos.escenarios.find((e) => e.nombre === 'base')?.filas ?? datos.proyeccion
  const pesimista = datos.escenarios.find((e) => e.nombre === 'pesimista')?.filas
  const optimista = datos.escenarios.find((e) => e.nombre === 'optimista')?.filas
  const etiquetasMeses = base.map((f) => `M${f.mes}`)
  const seriesProyeccion: SerieLinea[] = [{ nombre: 'Base', color: COLOR.azul, puntos: base.map((f) => f.saldo) }]
  if (pesimista) seriesProyeccion.unshift({ nombre: 'Pesimista', color: COLOR.critico, puntos: pesimista.map((f) => f.saldo), discontinua: true })
  if (optimista) seriesProyeccion.push({ nombre: 'Optimista', color: COLOR.bueno, puntos: optimista.map((f) => f.saldo), discontinua: true })

  const proyeccionSeccion = seccion(
    'Proyección de flujo de caja',
    svgLineas(seriesProyeccion, etiquetasMeses),
    pesimista && optimista
      ? 'Pesimista: 10% menos de ingresos y 10% más de gastos. Optimista: lo inverso. Ningún CFO presenta una proyección con un solo número.'
      : undefined,
  )

  const cuerpo = `
    ${encabezadoDocumento(`Informe Financiero — ${tituloNegocio}`, 'Diagnóstico integral del negocio a partir de los datos cargados en FinCorp')}
    ${resumenEjecutivo}
    ${bloqueRecomendaciones(datos.recomendaciones)}
    ${ingresosGastos}
    ${cuentasYDeudas}
    ${proyeccionSeccion}
  `

  abrirDocumentoHtml(documentoBase('Informe Financiero', tituloNegocio, cuerpo))
}

// ---------------------------------------------------------------------------
// Informe de salud financiera (Salud financiera / comprobantes)
// ---------------------------------------------------------------------------

export interface InformeSaludFinancieraData {
  nombreNegocio: string
  resumenMensual: TendenciaMensual[]
  rankingClientes: RankingContraparte[]
  rankingProveedores: RankingContraparte[]
  margenTotal: MargenBrutoTotal
  indicadoresCobroPago: IndicadoresCobroPago
  aging: AgingCuentas
}

export function abrirInformeSaludFinanciera(datos: InformeSaludFinancieraData) {
  const tituloNegocio = datos.nombreNegocio.trim() || 'Tu negocio'

  if (datos.resumenMensual.length === 0) {
    const cuerpo = `
      ${encabezadoDocumento(`Informe de Salud Financiera — ${tituloNegocio}`, 'A partir de tus facturas, notas de crédito y notas de débito')}
      <p style="color:${COLOR.textoMuted}">Todavía no se importaron ni cargaron comprobantes.</p>
    `
    abrirDocumentoHtml(documentoBase('Informe de Salud Financiera', tituloNegocio, cuerpo))
    return
  }

  const resumen = seccion(
    'Resumen del período',
    `
      <div class="kpis">
        ${tarjetaKpi('Ventas netas', formatoMoneda(datos.margenTotal.ventasNetas), COLOR.texto)}
        ${tarjetaKpi('Compras netas', formatoMoneda(datos.margenTotal.comprasNetas), COLOR.texto)}
        ${tarjetaKpi(
          'Margen bruto',
          `${formatoMoneda(datos.margenTotal.margenBruto)} (${formatoPorcentaje(datos.margenTotal.margenBrutoPct)})`,
          datos.margenTotal.margenBruto >= 0 ? COLOR.bueno : COLOR.critico,
        )}
      </div>
    `,
    'Es la suma de todas las ventas menos la suma de todas las compras del período, no un promedio mensual.',
  )

  const cobroPago = datos.indicadoresCobroPago.hayDatos
    ? seccion(
        'Indicadores de cobro y pago',
        `
          <div class="kpis" style="margin-bottom:18px">
            ${tarjetaKpi('DSO — días de cobro', `${datos.indicadoresCobroPago.dso.toFixed(0)} días`, COLOR.texto, `Pendiente: ${formatoMoneda(datos.indicadoresCobroPago.cuentasPorCobrar)}`)}
            ${tarjetaKpi('DPO — días de pago', `${datos.indicadoresCobroPago.dpo.toFixed(0)} días`, COLOR.texto, `Pendiente: ${formatoMoneda(datos.indicadoresCobroPago.cuentasPorPagar)}`)}
            ${tarjetaKpi(
              'Ciclo de conversión',
              `${datos.indicadoresCobroPago.cicloConversionEfectivo >= 0 ? '+' : ''}${datos.indicadoresCobroPago.cicloConversionEfectivo.toFixed(0)} días`,
              datos.indicadoresCobroPago.cicloConversionEfectivo <= 0 ? COLOR.bueno : COLOR.advertencia,
              datos.indicadoresCobroPago.cicloConversionEfectivo <= 0 ? 'Te financiás con tus proveedores' : 'Financiás a tus clientes',
            )}
          </div>
          <div class="grid-2">
            <div>
              <h3>Antigüedad de lo que falta cobrar</h3>
              ${svgBarrasHorizontales(
                datos.aging.cobrar.map((t) => ({ label: `${t.etiqueta}${t.cantidad ? ` (${t.cantidad})` : ''}`, value: t.monto, color: t.etiqueta === 'Al día' ? COLOR.serie3 : COLOR.serie4 })),
              )}
            </div>
            <div>
              <h3>Antigüedad de lo que falta pagar</h3>
              ${svgBarrasHorizontales(
                datos.aging.pagar.map((t) => ({ label: `${t.etiqueta}${t.cantidad ? ` (${t.cantidad})` : ''}`, value: t.monto, color: t.etiqueta === 'Al día' ? COLOR.serie3 : COLOR.serie4 })),
              )}
            </div>
          </div>
        `,
        'Días promedio en base a lo pendiente hoy y la facturación mensual habitual.',
      )
    : ''

  const tendencia = seccion(
    'Ventas y compras netas por mes',
    svgLineas(
      [
        { nombre: 'Ventas netas', color: COLOR.azul, puntos: datos.resumenMensual.map((r) => r.ventasNetas) },
        { nombre: 'Compras netas', color: COLOR.serie2, puntos: datos.resumenMensual.map((r) => r.comprasNetas) },
      ],
      datos.resumenMensual.map((r) => mesLegible(r.mes)),
    ) +
      `<h3>Margen mensual</h3>` +
      svgBarrasHorizontales(
        datos.resumenMensual.map((r) => ({ label: mesLegible(r.mes), value: r.margenPct, color: r.margenPct >= 0 ? COLOR.serie3 : COLOR.critico })),
        formatoPorcentaje,
      ),
    'El margen bruto real del período se calcula sobre el total acumulado (arriba), no como promedio de estos porcentajes mensuales.',
  )

  const rankings = seccion(
    'Principales clientes y proveedores',
    `
      <div class="grid-2">
        <div>
          <h3>Top clientes</h3>
          ${datos.rankingClientes.length > 0 ? svgBarrasHorizontales(datos.rankingClientes.map((r, i) => ({ label: r.contraparte, value: r.monto, color: SERIES[i % SERIES.length] }))) : `<p style="color:${COLOR.textoMuted}">Sin datos suficientes.</p>`}
        </div>
        <div>
          <h3>Top proveedores</h3>
          ${datos.rankingProveedores.length > 0 ? svgBarrasHorizontales(datos.rankingProveedores.map((r, i) => ({ label: r.contraparte, value: r.monto, color: SERIES[i % SERIES.length] }))) : `<p style="color:${COLOR.textoMuted}">Sin datos suficientes.</p>`}
        </div>
      </div>
    `,
  )

  const cuerpo = `
    ${encabezadoDocumento(`Informe de Salud Financiera — ${tituloNegocio}`, 'A partir de tus facturas, notas de crédito y notas de débito')}
    ${resumen}
    ${cobroPago}
    ${tendencia}
    ${rankings}
  `

  abrirDocumentoHtml(documentoBase('Informe de Salud Financiera', tituloNegocio, cuerpo))
}

// ---------------------------------------------------------------------------
// Recibo de sueldo (Sueldos)
// ---------------------------------------------------------------------------
//
// Réplica de la estructura de un recibo en relación de dependencia: los haberes en sus columnas
// de remunerativo y no remunerativo, los descuentos con la base sobre la que se calculó cada uno,
// los subtotales y el neto. Con varios empleados se imprime uno por hoja.

export interface ReciboSueldoData {
  nombreNegocio: string
  /** Mes liquidado, en formato "YYYY-MM". */
  mes: string
  empleados: Empleado[]
}

function etiquetaMesLargo(mesISO: string): string {
  const [anio, mes] = mesISO.split('-').map(Number)
  const texto = new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function celdaMonto(valor: number): string {
  return valor === 0 ? '<td class="num" style="color:' + COLOR.textoMuted + '">—</td>' : `<td class="num">${formatoMoneda(valor)}</td>`
}

function reciboDeEmpleado(empleado: Empleado, nombreNegocio: string, mes: string): string {
  const costo = calcularCostoEmpleado(empleado)
  const conceptos = empleado.conceptos ?? []

  const filasHaberes = [
    `<tr><td>Sueldo básico</td><td class="num">${formatoMoneda(empleado.sueldoBruto)}</td>${celdaMonto(0)}</tr>`,
    ...conceptos.map(
      (c) =>
        `<tr><td>${escapeHtml(c.descripcion || 'Sin descripción')}</td>` +
        (c.remunerativo ? `<td class="num">${formatoMoneda(c.monto)}</td>${celdaMonto(0)}` : `${celdaMonto(0)}<td class="num">${formatoMoneda(c.monto)}</td>`) +
        `</tr>`,
    ),
  ].join('')

  const filasDescuentos = costo.descuentos
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.descripcion || 'Sin descripción')}</td>` +
        `<td class="num">${formatoPorcentaje(d.porcentaje)}</td>` +
        `<td class="num">${formatoMoneda(d.montoBase)}</td>` +
        `<td class="num">${formatoMoneda(d.monto)}</td></tr>`,
    )
    .join('')

  return `
    <section class="recibo">
      <div class="encabezado">
        <div>
          <div class="marca">
            <span class="logo">F</span>
            <span class="marca-nombre">Fin<span>Corp</span></span>
          </div>
          <h1>Recibo de sueldo</h1>
          <p style="margin:0;color:${COLOR.textoSecundario};font-size:13px">${escapeHtml(nombreNegocio)} — ${escapeHtml(etiquetaMesLargo(mes))}</p>
        </div>
        <p class="meta">Generado el<br>${escapeHtml(new Date().toLocaleDateString('es-AR'))}</p>
      </div>

      <table class="datos-empleado">
        <tr>
          <td><span>Empleado</span><strong>${escapeHtml(empleado.nombre)}</strong></td>
          <td><span>Categoría / convenio</span><strong>${escapeHtml(empleado.categoria || '—')}</strong></td>
          <td><span>Período</span><strong>${escapeHtml(etiquetaMesLargo(mes))}</strong></td>
        </tr>
      </table>

      <h2>Haberes</h2>
      <table class="tabla">
        <thead><tr><th>Concepto</th><th class="num">Remunerativo</th><th class="num">No remunerativo</th></tr></thead>
        <tbody>${filasHaberes}</tbody>
        <tfoot>
          <tr><td>Subtotales</td><td class="num">${formatoMoneda(costo.remunerativo)}</td><td class="num">${formatoMoneda(costo.noRemunerativo)}</td></tr>
        </tfoot>
      </table>

      <h2>Descuentos</h2>
      <table class="tabla">
        <thead><tr><th>Concepto</th><th class="num">%</th><th class="num">Base</th><th class="num">Importe</th></tr></thead>
        <tbody>${filasDescuentos}</tbody>
        <tfoot>
          <tr><td colspan="3">Total de descuentos</td><td class="num">${formatoMoneda(costo.totalDescuentos)}</td></tr>
        </tfoot>
      </table>

      <div class="neto">
        <span>Neto a cobrar</span>
        <strong>${formatoMoneda(costo.sueldoNeto)}</strong>
      </div>

      <table class="tabla costo-empresa">
        <thead><tr><th colspan="2">Costo para la empresa (no forma parte del recibo del empleado)</th></tr></thead>
        <tbody>
          <tr><td>Haberes totales</td><td class="num">${formatoMoneda(costo.brutoTotal)}</td></tr>
          <tr><td>Contribuciones patronales (${formatoPorcentaje(empleado.contribucionesPatronalesPct)} s/ remunerativo)</td><td class="num">${formatoMoneda(costo.contribucionesPatronales)}</td></tr>
          <tr><td>Cargas sociales adicionales — ART, seguro de vida, sindicato</td><td class="num">${formatoMoneda(costo.cargasSocialesAdicionales)}</td></tr>
        </tbody>
        <tfoot><tr><td>Costo total</td><td class="num">${formatoMoneda(costo.costoEmpresa)}</td></tr></tfoot>
      </table>

      <div class="firmas">
        <div><span></span><p>Firma del empleador</p></div>
        <div><span></span><p>Firma del empleado — recibí conforme</p></div>
      </div>
    </section>
  `
}

const ESTILO_RECIBO = `
  .recibo { margin-bottom: 40px; }
  .recibo + .recibo { border-top: 2px dashed ${COLOR.borde}; padding-top: 32px; }
  .datos-empleado { width: 100%; border-collapse: collapse; margin: 0 0 22px; }
  .datos-empleado td { border: 1px solid ${COLOR.borde}; padding: 8px 10px; vertical-align: top; width: 33.33%; }
  .datos-empleado span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: ${COLOR.textoMuted}; margin-bottom: 2px; }
  .datos-empleado strong { font-size: 13px; color: ${COLOR.texto}; }
  .tabla { width: 100%; border-collapse: collapse; margin: 0 0 22px; font-size: 13px; }
  .tabla th, .tabla td { border: 1px solid ${COLOR.borde}; padding: 6px 10px; text-align: left; }
  .tabla thead th { background: ${COLOR.fondoAlterno}; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: ${COLOR.textoSecundario}; }
  .tabla tfoot td { background: ${COLOR.fondoAlterno}; font-weight: 600; }
  .tabla .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .neto { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 2px solid ${COLOR.navy}; border-radius: 8px; padding: 12px 16px; margin: 0 0 22px; }
  .neto span { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: ${COLOR.textoSecundario}; }
  .neto strong { font-size: 22px; color: ${COLOR.navy}; font-variant-numeric: tabular-nums; }
  .costo-empresa thead th { background: ${COLOR.fondo}; color: ${COLOR.textoMuted}; font-weight: 500; }
  .firmas { display: flex; gap: 40px; margin-top: 48px; }
  .firmas div { flex: 1; text-align: center; }
  .firmas span { display: block; border-top: 1px solid ${COLOR.texto}; margin-bottom: 6px; }
  .firmas p { margin: 0; font-size: 11px; color: ${COLOR.textoMuted}; }
  @media print { .recibo { page-break-after: always; } .recibo:last-child { page-break-after: auto; } .recibo + .recibo { border-top: none; padding-top: 0; } }
`

/** Abre los recibos del mes en una pestaña nueva, uno por hoja, listos para imprimir o guardar
 * como PDF con el diálogo del navegador. */
export function abrirRecibosSueldo(datos: ReciboSueldoData) {
  const tituloNegocio = datos.nombreNegocio.trim() || 'Tu negocio'
  const cuerpo = datos.empleados.map((e) => reciboDeEmpleado(e, tituloNegocio, datos.mes)).join('')
  const html = documentoBase('Recibo de sueldo', tituloNegocio, cuerpo).replace(
    '</style>',
    `${ESTILO_RECIBO}</style>`,
  )
  abrirDocumentoHtml(html)
}
