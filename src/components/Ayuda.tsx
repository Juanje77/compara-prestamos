import { useState } from 'react'
import { Card } from './Card'

type Tier = 'basico' | 'medio' | 'full'

interface SeccionAyuda {
  id: string
  numero: string
  titulo: string
  tier: Tier
  descripcion: string
  pasos: string[]
  tip?: string
}

const TIER_LABEL: Record<Tier, string> = {
  basico: 'Básico',
  medio: 'Medio',
  full: 'Full',
}

const TIER_COLOR: Record<Tier, { bg: string; text: string }> = {
  basico: { bg: 'var(--gridline)', text: 'var(--text-secondary)' },
  medio: { bg: 'color-mix(in srgb, var(--series-blue) 14%, transparent)', text: 'var(--series-blue)' },
  full: { bg: 'color-mix(in srgb, var(--series-4) 20%, transparent)', text: 'var(--series-4)' },
}

const SECCIONES: SeccionAyuda[] = [
  {
    id: 'dashboard',
    numero: '01',
    titulo: 'Dashboard',
    tier: 'basico',
    descripcion: 'Tu panorama general: cuánta plata tenés, cuánto debés, y los indicadores clave para saber si tu negocio está sano.',
    pasos: [
      'Cargá cada cuenta bancaria o caja con su nombre y saldo actual. (Con el plan Full, el saldo pasa a actualizarse solo — ver Tesorería.)',
      'Cargá tus deudas: concepto, monto adeudado, cuota mensual y próximo vencimiento.',
      'Completá tus ingresos y gastos mensuales estimados por categoría (sueldos, alquiler, insumos, impuestos, etc.).',
      'Mirá el gráfico de anillo "Composición de gastos": muestra lo real de este mes en cuanto tengas al menos una factura clasificada (con el plan Medio), y mientras tanto el estimado que cargaste acá.',
      'Revisá los indicadores — margen operativo, runway, punto de equilibrio, endeudamiento, cobertura de deuda. Si alguno aparece en rojo o naranja, es momento de mirar más de cerca.',
      'La proyección de caja incluye el golpe del aguinaldo en junio y diciembre si tenés empleados cargados en Sueldos, así que el bache de esos meses se ve venir.',
      'Con el plan Medio o superior, mirá el panel de Alertas y Recomendaciones — avisa solo sobre facturas vencidas, cheques por cobrar, stock bajo mínimo, etc.',
    ],
  },
  {
    id: 'comprobantes',
    numero: '02',
    titulo: 'Comprobantes',
    tier: 'medio',
    descripcion: 'Tus facturas, notas de crédito y débito. De acá salen ventas y compras netas, margen bruto, IVA, y qué falta cobrar o pagar.',
    pasos: [
      'Elegí `Emitida (venta)` o `Recibida (compra)` y el tipo de comprobante.',
      'Cargá cliente o proveedor, monto, IVA y fecha — o traé todo de una con `Importar desde ARCA`.',
      'Cuando la cobres o la pagues de verdad, tildá `Cobrada` / `Pagada`.',
      'Elegí el medio (Caja, Transferencia o Cheque) y, si ya tenés cuentas cargadas en Tesorería, elegí a cuál entró o salió la plata.',
      'Usá `Exportar para el contador` cuando necesites mandarle los libros al estudio contable.',
    ],
    tip: 'El selector de cuenta solo aparece si ya cargaste al menos una cuenta en Tesorería (plan Full). Sin eso, el tilde de cobrado/pagado funciona igual, solo que no queda registrado en ninguna caja puntual.',
  },
  {
    id: 'ingresos-gastos',
    numero: '03',
    titulo: 'Ingresos y gastos',
    tier: 'basico',
    descripcion: 'Carga diaria simple, para un control rápido del día a día — independiente de Comprobantes, no impacta en IVA.',
    pasos: [
      'Elegí si es un ingreso o un gasto.',
      'Cargá el monto, la fecha y un concepto corto.',
      'Se van sumando en un resumen simple, útil si todavía no facturás formalmente.',
    ],
  },
  {
    id: 'cobranzas',
    numero: '04',
    titulo: 'Cobranzas y pagos',
    tier: 'medio',
    descripcion: 'Calendario semanal de lo que falta cobrar y pagar — no se carga nada acá, se arma solo con las fechas de tus Comprobantes.',
    pasos: [
      'Mirá lo agrupado por semana: qué vence y cuánto.',
      'Tildá cada ítem cuando se cobre o se pague — es el mismo tilde que en Comprobantes, se sincroniza para los dos lados.',
      'Elegí el medio y, si tenés el plan Full, la cuenta — igual que en Comprobantes, así el saldo de esa cuenta en Tesorería baja o sube al toque.',
      'Con el plan Full, también aparecen los cheques por cobrar/pagar, con el mismo cambio de estado que en la solapa Cheques.',
    ],
  },
  {
    id: 'cuentas-corrientes',
    numero: '05',
    titulo: 'Cuentas corrientes',
    tier: 'full',
    descripcion: 'Cuánto te debe o le debés a cada cliente y proveedor, con la posibilidad de cobrar o pagar de a partes.',
    pasos: [
      'Elegí el cliente o proveedor con saldo pendiente.',
      'Cargá el monto del pago a cuenta, la fecha, el medio y (si no es cheque) la cuenta.',
      'Se aplica automático a la factura pendiente más antigua primero — vas cancelando una deuda grande de a partes, sin tildar cada factura entera.',
      'Los remitos/presupuestos sin facturar de esa misma cuenta también se ven acá, sumados al saldo total.',
    ],
    tip: 'Los anticipos de un remito se registran desde la solapa Remitos, no desde acá — "Registrar pago" solo toca facturas.',
  },
  {
    id: 'remitos',
    numero: '06',
    titulo: 'Remitos y presupuestos',
    tier: 'full',
    descripcion: 'Para trabajos largos: entregás un remito o pasás un presupuesto, cobrás un anticipo, y facturás todo junto al terminar.',
    pasos: [
      'Cargá el remito o presupuesto: cliente/proveedor, fecha, y el monto total.',
      'Para un cliente industrial, en vez de tipear el monto podés cargar líneas: productos de Stock (descuentan/suman inventario solo) y también "Mano de obra / otro costo" para lo que no es producto — flete, instalación, alquiler de equipo. El monto se calcula solo sumando todas las líneas.',
      'Registrá los anticipos que te vayan pagando, con su cuenta si corresponde.',
      'Cuando factures el trabajo completo, tocá `Vincular` a esa factura — los anticipos ya cobrados pasan a ser pago de esa factura sin cargarlos de nuevo.',
    ],
    tip: 'Remitos y presupuestos no suman a ventas/compras ni a IVA — son solo un seguimiento hasta que se facturan de verdad. Las líneas de "mano de obra / otro costo" tampoco mueven stock, solo suman al monto.',
  },
  {
    id: 'margenes',
    numero: '07',
    titulo: 'Márgenes por sector',
    tier: 'full',
    descripcion: 'Cuánto factura, cuánto cuesta y cuánto deja de ganancia cada división o centro de costo de tu negocio.',
    pasos: [
      'Creá un sector por cada división del negocio (ej: "Metalúrgica", "Instalaciones", "Service").',
      'Al cargar un remito en la solapa Remitos, asignale un sector desde el selector del formulario.',
      'En Sueldos repartí el costo de cada empleado entre los sectores con un porcentaje, para que la mano de obra entre en el margen.',
      'Volvé acá para ver, por sector y mes a mes: el ingreso (remitos a clientes), el costo (remitos a proveedores + líneas de producto + nómina asignada) y la ganancia resultante.',
    ],
    tip: 'Se mira un mes por vez, porque el costo de la nómina es mensual y mezclarlo con los remitos de todo el año daría un margen sin sentido. Solo cuenta remitos, nunca presupuestos. Las líneas de "mano de obra / otro costo" de un remito se cuentan al mismo precio facturado (margen cero): el costo real de esa mano de obra entra por la nómina asignada al sector.',
  },
  {
    id: 'sueldos',
    numero: '08',
    titulo: 'Sueldos',
    tier: 'full',
    descripcion: 'Nómina de empleados: cuánto cobra cada uno de bolsillo y cuánto le cuesta realmente a la empresa.',
    pasos: [
      'Completá una sola vez los datos de la empresa para el recibo: CUIT, domicilio y lugar de pago (el art. 140 de la LCT los exige).',
      'Cargá cada empleado con su nombre, CUIL, fecha de ingreso, legajo y sueldo básico de convenio.',
      'Sumá los otros haberes del recibo (antigüedad, presentismo, día del gremio, acuerdos) marcando cuáles son remunerativos y cuáles no: los no remunerativos no pagan jubilación ni PAMI, y tampoco generan contribuciones patronales.',
      'Los descuentos vienen con los tres de siempre —jubilación 11% y Ley 19.032 3% sobre lo remunerativo, obra social 3% sobre el total— y podés sumar los de tu convenio (S.E.C., F.A.E.C. y S., cuota sindical), eligiendo para cada uno la base sobre la que se calcula.',
      'Del lado de la empresa quedan dos porcentajes editables: contribuciones patronales (seguridad social) y cargas sociales adicionales (ART, seguro de vida, sindicato patronal), ambos sobre lo remunerativo.',
      'Mirá el resumen de la nómina vigente: remunerativo, no remunerativo, neto, contribuciones, cargas sociales y costo total para la empresa.',
      'En "Pago de la nómina" registrá los dos egresos del mes: primero los netos al personal y después las cargas sociales (F.931, ART y sindicato). Elegí de qué caja o cuenta sale la plata y el saldo en Tesorería baja al toque.',
      'Los dos pagos aparecen también en Cobranzas y pagos con su fecha estimada, para verlos venir en la semana — pero se registran acá, que es donde se elige la cuenta.',
      'En junio y diciembre aparecen además las dos cuotas del aguinaldo (SAC), calculadas como medio sueldo bruto por empleado con sus mismos aportes y contribuciones.',
      'Si tenés sectores creados, repartí el costo de cada empleado entre ellos con un % — sirve para los que hacen varias tareas (60% Metalúrgica, 40% Service).',
      'Cada empleado se ve como una fila con su neto y su costo; tocala para abrir el detalle y editarlo.',
      'Cuando la liquidación del mes está lista, tocá `Cerrar liquidación del mes`: eso congela los números de ese período y le asigna a cada recibo su numeración correlativa. Hasta entonces los recibos salen marcados como BORRADOR sin numerar.',
      'Con el ícono de la impresora imprimís el recibo de un empleado, o `Imprimir todos los recibos` para toda la nómina, uno por hoja. La constancia del último depósito de aportes se completa sola con el pago de cargas sociales que hayas registrado del mes anterior.',
      'En `Ver libro de sueldos` tenés el registro del art. 52 de la LCT con todos los períodos cerrados, un asiento por recibo y los totales acumulados.',
      'Dado de baja un empleado con `Dar de baja` en vez de borrarlo, para no perder el historial.',
    ],
    tip: 'En cuanto cargás al menos un empleado activo, el costo total de la nómina pasa a ser el valor automático (marcado "auto") de la categoría "Sueldos" en Presupuesto vs. Real y en el gráfico de Composición de gastos del Dashboard, en vez del estimado que cargaste a mano. Ojo con cerrar la liquidación: si después reabrís el período, los números de recibo ya usados no se reciclan — la numeración sigue siempre hacia adelante, como corresponde. Y el libro de sueldos, para tener validez legal, tiene que estar rubricado por la autoridad del trabajo de tu jurisdicción.',
  },
  {
    id: 'stock',
    numero: '09',
    titulo: 'Stock',
    tier: 'full',
    descripcion: 'Catálogo de productos con control de entradas y salidas, conectado solo con Remitos.',
    pasos: [
      'Cargá un producto a mano, o importá tu catálogo entero desde Excel.',
      'Usá `± Ajustar` para registrar entradas, salidas o ajustes manuales.',
      'Si armás un remito con líneas de producto, el stock se descuenta (venta) o suma (compra) solo, sin cargarlo de nuevo acá.',
      'Podés eliminar un producto en cualquier momento — si tiene movimientos cargados, te pide confirmar antes de borrar su historial.',
    ],
  },
  {
    id: 'tesoreria',
    numero: '10',
    titulo: 'Tesorería',
    tier: 'full',
    descripcion: 'El saldo real de cada caja o cuenta bancaria, armado solo con lo que vas cobrando y pagando en el resto del sistema.',
    pasos: [
      'Cargá cada cuenta con su nombre y su saldo inicial.',
      'A partir de ahí, no se edita el saldo a mano: sube o baja solo con lo que marqués como cobrado/pagado en Comprobantes, Cuentas corrientes, Cheques y Remitos.',
      'Usá `± Ajustar` solo para lo que no viene de ahí — un gasto bancario, un retiro de caja.',
      'Para conciliar contra el banco: tocá `Conciliar`, subí el extracto (Excel), y se empareja solo lo que tiene el mismo monto y hasta 3 días de diferencia de fecha.',
      'Lo que no matchea se resuelve a mano: `Vincular a…` si es algo que ya tenías cargado con otra fecha, o `+ Ajuste` si es algo nuevo que el banco cobró sin que lo supieras (una comisión, un débito automático).',
      'Mirá la diferencia entre el saldo del sistema y el del extracto — tiene que ir bajando a $0 a medida que conciliás.',
    ],
  },
  {
    id: 'cheques',
    numero: '11',
    titulo: 'Cheques',
    tier: 'full',
    descripcion: 'Cheques de terceros que recibís y cheques propios que emitís.',
    pasos: [
      'Cargá tipo (recibido/emitido), banco, monto, fecha de emisión y de cobro.',
      'Opcional: vinculá el cheque a las facturas que cubre — quedan marcadas como cobradas/pagadas al toque.',
      'Cuando el banco lo acredite (o lo vendas/descuentes antes de tiempo), cambiá el estado a `Cobrado` o `Vendido` y elegí la cuenta — recién ahí impacta en Tesorería.',
      'Si rebota, marcalo `Rechazado` — se revierten solas las facturas que cubría.',
    ],
  },
  {
    id: 'proveedores',
    numero: '12',
    titulo: 'Proveedores',
    tier: 'medio',
    descripcion: 'Lista de proveedores con el total facturado, clasificados por categoría de gasto.',
    pasos: [
      'Se completa sola con cada factura recibida que cargues en Comprobantes.',
      'Asigná una categoría a cada uno (sueldos, insumos, alquiler…) para que el Dashboard reparta bien tus gastos.',
      'También podés agregar un proveedor a mano, sin factura todavía.',
    ],
  },
  {
    id: 'clientes',
    numero: '13',
    titulo: 'Clientes',
    tier: 'medio',
    descripcion: 'Mismo formato que Proveedores, pero para ventas, sin categoría.',
    pasos: [
      'Se completa sola con cada factura emitida que cargues.',
      'Podés agregar un cliente a mano si todavía no le facturaste.',
    ],
  },
  {
    id: 'presupuesto-real',
    numero: '14',
    titulo: 'Presupuesto vs. Real',
    tier: 'medio',
    descripcion: 'Compará lo que presupuestaste en el Dashboard contra lo que facturaste y gastaste de verdad, mes a mes.',
    pasos: [
      'Elegí el mes que querés revisar.',
      'Arriba de todo, "Ventas del mes" compara el ingreso que presupuestaste en el Dashboard contra lo que realmente facturaste ese mes (se completa solo con tus facturas emitidas) — acá superar el presupuesto es una buena noticia.',
      'Más abajo, cargá el gasto real de cada categoría, o dejá que se complete solo con tus facturas ya clasificadas.',
      'Mirá el desvío en pesos y en porcentaje, tanto de ventas como categoría por categoría de gasto.',
    ],
  },
  {
    id: 'iva',
    numero: '15',
    titulo: 'Posición de IVA',
    tier: 'medio',
    descripcion: 'Cuánto débito fiscal generaron tus ventas, cuánto crédito tus compras, y el saldo a pagar o a favor por mes.',
    pasos: [
      'Se calcula solo a partir del IVA que cargaste en cada factura de Comprobantes.',
      'Hacé ajustes manuales por mes si tenés retenciones, percepciones u otros ajustes que no salen de una factura.',
    ],
  },
  {
    id: 'iibb',
    numero: '16',
    titulo: 'Ingresos Brutos',
    tier: 'medio',
    descripcion: 'La misma lógica que IVA, aplicada a Ingresos Brutos con tu alícuota.',
    pasos: [
      'Se calcula solo a partir de tus ventas cargadas en Comprobantes.',
      'Ajustá a mano por mes cuando corresponda.',
    ],
  },
  {
    id: 'patrimonio',
    numero: '17',
    titulo: 'Patrimonio',
    tier: 'medio',
    descripcion: 'Bienes que no son caja del día a día, pero que podrías vender ante un quiebre de caja.',
    pasos: [
      'Cargá cada bien: inversión, inmueble, vehículo, maquinaria, stock excedente u otro, con su valor estimado.',
      'Se suma al "Runway extendido" — un colchón de referencia aparte del runway principal, que solo mira tu caja real.',
    ],
  },
  {
    id: 'contador',
    numero: '18',
    titulo: 'Exportar para el contador',
    tier: 'medio',
    descripcion: 'Un Excel prolijo, listo para mandar al estudio contable o importar en su sistema.',
    pasos: [
      'Desde Comprobantes, tocá `Exportar para el contador`.',
      'Se descarga un Excel con las hojas "IVA Ventas" e "IVA Compras" — disponible desde el plan Medio.',
      'Con el plan Full, el mismo archivo trae además "Cuentas por Cobrar", "Cuentas por Pagar", "Cheques", "Resumen de cuentas" y "Movimientos Tesorería".',
    ],
  },
]

const FLUJO = [
  { titulo: 'Cargá la cuenta en Tesorería', detalle: '"Banco Nación", con su saldo inicial actual.' },
  { titulo: 'Cargá la factura en Comprobantes', detalle: 'Emitida, a tu cliente, con el monto de la venta.' },
  { titulo: 'Tildá "Cobrada"', detalle: 'Elegí el medio (por ejemplo Transferencia) y esa misma cuenta, "Banco Nación".' },
  { titulo: 'Andá a Tesorería', detalle: 'El saldo de "Banco Nación" ya subió, exacto por ese monto — sin tocar nada más.' },
  { titulo: 'Cuando llegue el resumen del banco', detalle: 'Tesorería → esa cuenta → "Conciliar" → subís el extracto y confirmás que coincide con lo cargado.' },
]

const PLANES_TABLA: { label: string; basico: boolean; medio: boolean; full: boolean }[] = [
  { label: 'Dashboard, Ingresos y gastos', basico: true, medio: true, full: true },
  { label: 'Comprobantes, IVA e Ingresos Brutos', basico: false, medio: true, full: true },
  { label: 'Proveedores, Clientes, Presupuesto vs. Real', basico: false, medio: true, full: true },
  { label: 'Patrimonio y alertas automáticas', basico: false, medio: true, full: true },
  { label: 'Exportar para el contador', basico: false, medio: true, full: true },
  { label: 'Cuentas corrientes', basico: false, medio: false, full: true },
  { label: 'Remitos y presupuestos', basico: false, medio: false, full: true },
  { label: 'Stock', basico: false, medio: false, full: true },
  { label: 'Tesorería + conciliación bancaria', basico: false, medio: false, full: true },
  { label: 'Cheques', basico: false, medio: false, full: true },
]

/** Convierte `texto entre backticks` en chips con estilo de control de UI. */
function conChips(texto: string) {
  const partes = texto.split(/(`[^`]+`)/g)
  return partes.map((parte, i) => {
    if (parte.startsWith('`') && parte.endsWith('`')) {
      return (
        <code
          key={i}
          className="mx-0.5 rounded px-1.5 py-0.5 text-[13px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          {parte.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{parte}</span>
  })
}

function TierBadge({ tier }: { tier: Tier }) {
  const c = TIER_COLOR[tier]
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      {TIER_LABEL[tier]}
    </span>
  )
}

function TarjetaSeccion({ seccion }: { seccion: SeccionAyuda }) {
  return (
    <Card as="section" id={`ayuda-${seccion.id}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {seccion.numero}
        </span>
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {seccion.titulo}
        </h3>
        <TierBadge tier={seccion.tier} />
      </div>
      <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {seccion.descripcion}
      </p>
      <ol className="space-y-2">
        {seccion.pasos.map((paso, i) => (
          <li key={i} className="flex gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
              style={{ background: 'color-mix(in srgb, var(--series-blue) 14%, transparent)', color: 'var(--series-blue)' }}
            >
              {i + 1}
            </span>
            <span className="leading-relaxed">{conChips(paso)}</span>
          </li>
        ))}
      </ol>
      {seccion.tip && (
        <p
          className="mt-3 rounded-lg border p-2.5 text-xs leading-relaxed"
          style={{ borderColor: 'var(--status-warning)', background: 'color-mix(in srgb, var(--status-warning) 12%, transparent)', color: 'var(--text-primary)' }}
        >
          <strong>Ojo: </strong>
          {seccion.tip}
        </p>
      )}
    </Card>
  )
}

interface Props {
  esPremium: boolean
  esFull: boolean
}

export function Ayuda({ esPremium, esFull }: Props) {
  const [filtro, setFiltro] = useState<'todos' | Tier>('todos')

  const visibles = SECCIONES.filter((s) => {
    if (filtro === 'todos') return true
    if (filtro === 'full') return true
    if (filtro === 'medio') return s.tier !== 'full'
    return s.tier === 'basico'
  })

  return (
    <div className="space-y-6">
      <Card as="section">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ayuda
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Qué es cada solapa, para qué sirve y los pasos exactos para usarla.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {(['todos', 'basico', 'medio', 'full'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className="rounded-full border px-3 py-1 text-xs font-semibold"
                style={
                  filtro === f
                    ? { background: 'var(--text-primary)', borderColor: 'var(--text-primary)', color: 'var(--surface-1)' }
                    : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }
                }
              >
                {f === 'todos' ? 'Todos' : TIER_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Tu plan actual: <strong style={{ color: 'var(--text-secondary)' }}>{esFull ? 'Full' : esPremium ? 'Medio' : 'Básico'}</strong>. Filtrá por
          plan para ver solo lo que ya tenés disponible.
        </p>
      </Card>

      {visibles.map((s) => (
        <TarjetaSeccion key={s.id} seccion={s} />
      ))}

      {(filtro === 'todos' || filtro === 'full') && (
        <Card as="section">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Ejemplo de punta a punta
            </h3>
            <TierBadge tier="full" />
          </div>
          <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            La pregunta más común: "si cobro una factura, ¿me lo lleva al banco que elegí?" — sí, así es como se ve el recorrido completo.
          </p>
          <ol className="space-y-3">
            {FLUJO.map((paso, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: 'color-mix(in srgb, var(--series-4) 20%, transparent)', color: 'var(--series-4)' }}
                >
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {paso.titulo}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {paso.detalle}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card as="section">
        <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Comparar planes
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Qué desbloquea cada nivel — podés probar el plan Full completo gratis.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                <th className="pb-2 pr-4 font-medium">Función</th>
                <th className="pb-2 px-2 text-center font-medium">Básico</th>
                <th className="pb-2 px-2 text-center font-medium">Medio</th>
                <th className="pb-2 pl-2 text-center font-medium">Full</th>
              </tr>
            </thead>
            <tbody>
              {PLANES_TABLA.map((fila) => (
                <tr key={fila.label} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                  <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>
                    {fila.label}
                  </td>
                  <td className="py-2 px-2 text-center" style={{ color: fila.basico ? 'var(--status-good-text)' : 'var(--gridline)' }}>
                    {fila.basico ? '✓' : '—'}
                  </td>
                  <td className="py-2 px-2 text-center" style={{ color: fila.medio ? 'var(--status-good-text)' : 'var(--gridline)' }}>
                    {fila.medio ? '✓' : '—'}
                  </td>
                  <td className="py-2 pl-2 text-center" style={{ color: fila.full ? 'var(--status-good-text)' : 'var(--gridline)' }}>
                    {fila.full ? '✓' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
