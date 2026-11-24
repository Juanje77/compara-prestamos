// Informes en HTML, pensados para abrirse en una pestaña nueva e imprimirse como PDF desde el
// propio navegador (Ctrl+P / Cmd+P → Guardar como PDF). En vez de dibujar texto plano con jsPDF,
// se arma un documento con CSS de verdad y gráficos en SVG — mucho más flexible y prolijo que
// dibujar rectángulos a mano, sin agregar ninguna dependencia nueva.
import { formatoMoneda, formatoPorcentaje } from './finance'
import type { Extracto } from './extractoCuentaCorriente'
import type { AgrupacionSemanal } from './semanas'
import type { Movimiento } from './movimientosSemana'
import type { PosicionFinanciera } from './posicionFinanciera'
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
  return seccion('Qué hacer', `<ul class="recomendaciones">${items}</ul>`)
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
    /* Cada cuenta en su hoja: así se le manda a un cliente la suya sin el saldo de los demás. */
    section.cuenta { break-before: page; }
    section.cuenta:first-of-type { break-before: auto; }
    .hoja { box-shadow: none; margin: 0; max-width: none; padding: 0; }
    @page { margin: 16mm; }
  }
`

const PIE_INFORME =
  'Estimación orientativa a partir de los datos cargados por el usuario — no reemplaza un análisis financiero profesional. Elaborado con FinCorp · Juan Costantini, Contador Público (MP: T20F94). Asesoramiento: WhatsApp +54 9 2392 583117.'

function documentoBase(titulo: string, tituloNegocio: string, cuerpo: string, pie = PIE_INFORME): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(titulo)} - ${escapeHtml(tituloNegocio)}</title>
<style>${ESTILO}</style>
</head>
<body>
  <div class="barra-imprimir">
    <button onclick="window.print()">Imprimir / Guardar como PDF</button>
  </div>
  <div class="hoja">
    ${cuerpo}
    <p class="pie-pagina">${pie}</p>
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
// Extracto de cuentas corrientes (Full)
// ---------------------------------------------------------------------------
//
// Lo que uno manda cuando reclama un saldo, o cuando el cliente lo discute. No alcanza con "me
// debés tanto": hay que poder mostrar de dónde sale, factura por factura y pago por pago.

export interface InformeCuentasCorrientesData {
  nombreNegocio: string
  /** 'cobrar' son los clientes; 'pagar', los proveedores. */
  lado: 'cobrar' | 'pagar'
  extractos: Extracto[]
}

/**
 * Este informe NO lleva el pie de "estimación orientativa" de los demás. No es una proyección ni
 * un análisis: es el detalle de los comprobantes cargados. Y como se le manda al cliente para
 * reclamarle un saldo, un texto que diga "estimación" lo debilita justo donde tiene que ser
 * firme. La reserva que sí corresponde es otra: que se reclame si ya se pagó.
 */
const PIE_EXTRACTO =
  'Detalle de los comprobantes registrados a la fecha. Si registraste un pago que no figura, avisanos para conciliarlo. Elaborado con FinCorp · Juan Costantini, Contador Público (MP: T20F94).'

export function abrirInformeCuentasCorrientes({ nombreNegocio, lado, extractos }: InformeCuentasCorrientesData) {
  const tituloNegocio = nombreNegocio.trim() || 'Tu negocio'
  const esCobrar = lado === 'cobrar'
  const titulo = esCobrar ? 'Cuentas corrientes a cobrar' : 'Cuentas corrientes a pagar'
  const subtitulo = esCobrar
    ? 'Movimiento de cada cliente y cómo se llegó a su saldo'
    : 'Movimiento de cada proveedor y cómo se llegó a su saldo'

  if (extractos.length === 0) {
    abrirDocumentoHtml(
      documentoBase(
        titulo,
        tituloNegocio,
        `${encabezadoDocumento(`${titulo} — ${tituloNegocio}`, subtitulo)}
         <p style="color:${COLOR.textoSecundario}">No hay saldos pendientes.</p>`,
        PIE_EXTRACTO,
      ),
    )
    return
  }

  const total = extractos.reduce((s, e) => s + e.saldo, 0)

  const resumen = `
    <section class="bloque">
      <h2>Resumen</h2>
      <table>
        <thead>
          <tr>
            <th>${esCobrar ? 'Cliente' : 'Proveedor'}</th>
            <th class="num">Movimientos</th>
            <th class="num">Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${extractos
            .map(
              (e) => `<tr>
                <td>${escapeHtml(e.contraparte)}</td>
                <td class="num">${e.filas.length}</td>
                <td class="num">${formatoMoneda(e.saldo)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="num"></td>
            <td class="num">${formatoMoneda(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  `

  // Cada cuenta arranca en página nueva: así se le manda a un cliente la suya sola, sin el saldo
  // de los demás, que es la primera razón por la que uno imprime esto.
  const detalle = extractos
    .map(
      (e) => `
    <section class="bloque cuenta">
      <h2>${escapeHtml(e.contraparte)}</h2>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Detalle</th>
            <th class="num">Debe</th>
            <th class="num">Haber</th>
            <th class="num">Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${e.filas
            .map(
              (f) => `<tr>
                <td>${escapeHtml(new Date(`${f.fecha}T00:00:00`).toLocaleDateString('es-AR'))}</td>
                <td>${escapeHtml(f.detalle)}</td>
                <td class="num">${f.debe > 0 ? formatoMoneda(f.debe) : ''}</td>
                <td class="num">${f.haber > 0 ? formatoMoneda(f.haber) : ''}</td>
                <td class="num">${formatoMoneda(f.saldo)}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">Saldo ${esCobrar ? 'a cobrar' : 'a pagar'}</td>
            <td class="num">${formatoMoneda(e.totalDebe)}</td>
            <td class="num">${formatoMoneda(e.totalHaber)}</td>
            <td class="num">${formatoMoneda(e.saldo)}</td>
          </tr>
        </tfoot>
      </table>
    </section>`,
    )
    .join('')

  abrirDocumentoHtml(
    documentoBase(
      titulo,
      tituloNegocio,
      `${encabezadoDocumento(`${titulo} — ${tituloNegocio}`, subtitulo)}${resumen}${detalle}`,
      PIE_EXTRACTO,
    ),
  )
}

// ---------------------------------------------------------------------------
// Cobranzas y pagos de las próximas semanas
// ---------------------------------------------------------------------------
//
// La planilla de la semana, en papel. Es la que se lleva a la reunión con el socio o al banco:
// con cuánta caja se arranca, qué entra y qué sale cada semana, y con cuánto se termina.

export type LadoInformeSemanal = 'todo' | 'cobros' | 'pagos'

export interface InformeCobranzasPagosData {
  nombreNegocio: string
  posicion: PosicionFinanciera
  agrupacion: AgrupacionSemanal
  /** Lo vencido que sigue sin cumplirse, que es lo que arrastra el acumulado. */
  vencidosPendientes: Movimiento[]
  /** Qué incluir. 'cobros' y 'pagos' son listas de trabajo para darle a alguien; 'todo' es la
   * proyección de caja completa. */
  lado?: LadoInformeSemanal
}

const TITULO_LADO: Record<LadoInformeSemanal, string> = {
  todo: 'Cobranzas y pagos',
  cobros: 'Cobranzas a realizar',
  pagos: 'Pagos a realizar',
}

function filaMovimiento(m: Movimiento, columnas: 'ambas' | 'una'): string {
  const cumplido = m.cumplido ? ` <span style="color:${COLOR.textoMuted}">(cumplido)</span>` : ''
  const celdas =
    columnas === 'ambas'
      ? `<td class="num">${m.tipo === 'cobro' ? formatoMoneda(m.monto) : ''}</td>
         <td class="num">${m.tipo === 'pago' ? formatoMoneda(m.monto) : ''}</td>`
      : `<td class="num">${formatoMoneda(m.monto)}</td>`
  return `<tr>
    <td>${escapeHtml(new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR'))}</td>
    <td>${escapeHtml(m.concepto)}${cumplido}</td>
    ${celdas}
  </tr>`
}

const PIE_SEMANAL =
  'Proyección armada con los comprobantes, cheques y movimientos cargados a la fecha. Las fechas de cobro y pago son las estimadas: un cambio en cualquiera de ellas mueve el saldo de las semanas siguientes. Elaborado con FinCorp · Juan Costantini, Contador Público (MP: T20F94).'

const PIE_COBRANZA =
  'Fechas estimadas según los comprobantes cargados. Antes de reclamar, verificá que el pago no haya entrado ya. Elaborado con FinCorp · Juan Costantini, Contador Público (MP: T20F94).'

const PIE_PAGOS =
  'Fechas estimadas según los comprobantes cargados. Confirmá el importe con el comprobante antes de pagar. Elaborado con FinCorp · Juan Costantini, Contador Público (MP: T20F94).'

/**
 * El informe semanal, entero o de un solo lado.
 *
 * La versión de un solo lado no es el informe completo con una columna tapada: es otro documento,
 * y por dos razones. Una, de uso: quien sale a cobrar necesita a quién, cuánto y desde cuándo, no
 * la proyección de caja. La otra, más importante: ese papel se le da a un empleado o a un gestor,
 * y el informe completo muestra el saldo de las cuentas bancarias y la posición neta del negocio.
 * Eso no tiene por qué salir de la empresa adentro de una lista de cobranza.
 */
export function abrirInformeCobranzasPagos({
  nombreNegocio,
  posicion,
  agrupacion,
  vencidosPendientes,
  lado = 'todo',
}: InformeCobranzasPagosData) {
  const tituloNegocio = nombreNegocio.trim() || 'Tu negocio'
  const esTodo = lado === 'todo'
  const tipoBuscado = lado === 'pagos' ? 'pago' : 'cobro'
  const titulo = TITULO_LADO[lado]
  const { semanas, totalesPorSemana, movimientosPorSemana } = agrupacion
  const desde = semanas[0]?.inicio
  const hasta = semanas[semanas.length - 1]?.fin
  const periodo =
    desde && hasta
      ? `Del ${desde.toLocaleDateString('es-AR')} al ${hasta.toLocaleDateString('es-AR')}`
      : 'Próximas semanas'

  /** Los movimientos de una semana que corresponden a este informe. */
  const deLaSemana = (i: number) =>
    esTodo ? movimientosPorSemana[i] : movimientosPorSemana[i].filter((m) => m.tipo === tipoBuscado)
  const vencidos = esTodo ? vencidosPendientes : vencidosPendientes.filter((m) => m.tipo === tipoBuscado)
  const totalVencido = vencidos.reduce((s, m) => s + m.monto, 0)
  const totalPeriodo = semanas.reduce((s, _, i) => s + deLaSemana(i).reduce((t, m) => t + m.monto, 0), 0)

  const cabecera = esTodo
    ? `<section class="bloque">
        <h2>Posición financiera de hoy</h2>
        <div class="kpis">
          ${tarjetaKpi('Caja y bancos', formatoMoneda(posicion.caja), COLOR.texto)}
          ${tarjetaKpi('Falta cobrar', formatoMoneda(posicion.aCobrar.total), COLOR.texto)}
          ${tarjetaKpi('Falta pagar', formatoMoneda(posicion.aPagar.total), COLOR.texto)}
          ${tarjetaKpi(
            'Posición neta',
            formatoMoneda(posicion.posicionNeta),
            posicion.posicionNeta >= 0 ? COLOR.bueno : COLOR.critico,
            'Si entra y sale todo lo pendiente',
          )}
        </div>
      </section>`
    : `<section class="bloque">
        <h2>Resumen</h2>
        <div class="kpis">
          ${tarjetaKpi(
            lado === 'cobros' ? 'Vencido sin cobrar' : 'Vencido sin pagar',
            formatoMoneda(totalVencido),
            totalVencido > 0 ? COLOR.critico : COLOR.texto,
            `${vencidos.length} ${vencidos.length === 1 ? 'pendiente' : 'pendientes'}`,
          )}
          ${tarjetaKpi('En estas 4 semanas', formatoMoneda(totalPeriodo), COLOR.texto)}
          ${tarjetaKpi('Total a gestionar', formatoMoneda(totalVencido + totalPeriodo), COLOR.texto)}
        </div>
      </section>`

  const resumenSemanas = esTodo
    ? `<section class="bloque">
        <h2>Semana a semana</h2>
        <table>
          <thead>
            <tr>
              <th>Semana</th><th class="num">Cobros</th><th class="num">Pagos</th>
              <th class="num">Resultado</th><th class="num">Saldo al cierre</th>
            </tr>
          </thead>
          <tbody>
            ${semanas
              .map((s, i) => {
                const t = totalesPorSemana[i]
                return `<tr>
                  <td>${escapeHtml(`${s.inicio.toLocaleDateString('es-AR')} al ${s.fin.toLocaleDateString('es-AR')}`)}</td>
                  <td class="num">${t.cobros > 0 ? formatoMoneda(t.cobros) : ''}</td>
                  <td class="num">${t.pagos > 0 ? formatoMoneda(t.pagos) : ''}</td>
                  <td class="num">${formatoMoneda(t.saldo)}</td>
                  <td class="num" style="color:${t.saldoAcumulado < 0 ? COLOR.critico : COLOR.texto};font-weight:700">${formatoMoneda(t.saldoAcumulado)}</td>
                </tr>`
              })
              .join('')}
          </tbody>
        </table>
        <p style="margin:10px 0 0;font-size:11px;color:${COLOR.textoMuted}">
          El saldo al cierre arrastra el de la semana anterior y arranca de ${escapeHtml(formatoMoneda(agrupacion.saldoInicial))}:
          la caja de hoy más lo vencido que todavía está pendiente.
        </p>
      </section>`
    : ''

  const encabezadosDetalle = esTodo
    ? '<th class="num">Cobro</th><th class="num">Pago</th>'
    : `<th class="num">${lado === 'cobros' ? 'A cobrar' : 'A pagar'}</th>`

  const bloqueVencidos =
    vencidos.length > 0
      ? `<section class="bloque">
          <h2>${esTodo ? 'Vencido y todavía pendiente' : `Vencido — ${formatoMoneda(totalVencido)}`}</h2>
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th>${encabezadosDetalle}</tr></thead>
            <tbody>${vencidos.map((m) => filaMovimiento(m, esTodo ? 'ambas' : 'una')).join('')}</tbody>
          </table>
        </section>`
      : ''

  const detalle = semanas
    .map((s, i) => {
      const movs = deLaSemana(i)
      if (movs.length === 0) return ''
      const t = totalesPorSemana[i]
      const totalFila = esTodo
        ? `<td class="num">${formatoMoneda(t.cobros)}</td><td class="num">${formatoMoneda(t.pagos)}</td>`
        : `<td class="num">${formatoMoneda(movs.reduce((x, m) => x + m.monto, 0))}</td>`
      return `<section class="bloque">
        <h2>${escapeHtml(`${s.inicio.toLocaleDateString('es-AR')} al ${s.fin.toLocaleDateString('es-AR')}`)}</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Concepto</th>${encabezadosDetalle}</tr></thead>
          <tbody>${movs.map((m) => filaMovimiento(m, esTodo ? 'ambas' : 'una')).join('')}</tbody>
          <tfoot><tr><td colspan="2">Total de la semana</td>${totalFila}</tr></tfoot>
        </table>
      </section>`
    })
    .join('')

  const sinNada =
    !esTodo && vencidos.length === 0 && totalPeriodo === 0
      ? `<p style="color:${COLOR.textoSecundario}">No hay nada pendiente en este período.</p>`
      : ''

  const subtitulo = esTodo
    ? periodo
    : `${periodo} · ${lado === 'cobros' ? 'Clientes a reclamar' : 'Obligaciones a pagar'}`

  const cuerpo = `
    ${encabezadoDocumento(`${titulo} — ${tituloNegocio}`, subtitulo)}
    ${cabecera}
    ${resumenSemanas}
    ${bloqueVencidos}
    ${detalle}
    ${sinNada}
  `
  const pie = esTodo ? PIE_SEMANAL : lado === 'cobros' ? PIE_COBRANZA : PIE_PAGOS
  abrirDocumentoHtml(documentoBase(titulo, tituloNegocio, cuerpo, pie))
}
