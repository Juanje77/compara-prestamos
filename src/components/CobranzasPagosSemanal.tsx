import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Cloud, Download, FileDown, FileUp, Landmark, Pencil, Receipt, Trash2, Users } from 'lucide-react'
import {
  agregarMovimiento,
  agregarMovimientos,
  alternarCumplido,
  cambiarMedioPago,
  editarMovimiento,
  eliminarMovimiento,
  marcarCumplidoVarios,
  obtenerMovimientos,
  reemplazarMovimientos,
  vaciarSemana,
  type Movimiento,
  type TipoMovimiento,
} from '../lib/movimientosSemana'
import { agruparPorSemana, indiceDeSemana, type RangoSemana } from '../lib/semanas'
import {
  PREFIJO_CHEQUE,
  PREFIJO_FACTURA,
  PREFIJO_SUELDO,
  calcularPosicionFinanciera,
  type OrigenMovimiento,
} from '../lib/posicionFinanciera'
import { armarMovimientos } from '../lib/movimientosDelNegocio'
import { importarMovimientosDesdeExcel } from '../lib/excelImport'
import { descargarPlantillaMovimientos } from '../lib/plantillasImportacion'
import { formatoMoneda } from '../lib/finance'
import { descargarPdfCobranzasSemanal } from '../lib/pdf'
import { cargarDatosUsuario, guardarDatosUsuario } from '../lib/userSync'
import { useAuth } from '../lib/AuthContext'
import {
  MEDIOS_PAGO_LABEL,
  type Cheque,
  type CuentaBancaria,
  type EstadoCheque,
  type Factura,
  calcularSaldoTotalBancos,
  type MedioPago,
  type Pago as PagoFactura,
  type PagoSueldos,
} from '../lib/cfo'
import { InputMoneda } from './InputMoneda'
import { IconButton } from './IconButton'
import { Card } from './Card'
import { Button } from './Button'


function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Fecha "de hoy", que se actualiza sola a la medianoche (y al volver a la pestaña si se cruzó de
 * día mientras estaba en segundo plano) para que las semanas se recalculen sin depender de que el
 * usuario recargue la página. */
function useFechaActual(): Date {
  const [hoy, setHoy] = useState(() => new Date())

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    function programarProximaMedianoche() {
      const ahora = new Date()
      const proximaMedianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 5)
      timeoutId = setTimeout(() => {
        setHoy(new Date())
        programarProximaMedianoche()
      }, proximaMedianoche.getTime() - ahora.getTime())
    }
    programarProximaMedianoche()

    function alVolverVisible() {
      if (document.visibilityState !== 'visible') return
      setHoy((prev) => {
        const ahora = new Date()
        return ahora.toDateString() !== prev.toDateString() ? ahora : prev
      })
    }
    document.addEventListener('visibilitychange', alVolverVisible)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', alVolverVisible)
    }
  }, [])

  return hoy
}

/** Un renglón del desglose de la posición. Los que están en cero igual se muestran: ver un
 * "Cheques a cobrar $ 0" dice algo —que no hay cheques—, mientras que esconder el renglón deja al
 * usuario preguntándose si el sistema los está contando. */
/**
 * Un renglón del desglose, que se abre para ver qué lo compone.
 *
 * Poder abrirlo no es un adorno: un total que no cierra es imposible de revisar si no se ve de
 * qué está hecho. Con la lista a la vista, un movimiento cargado dos veces o una fecha mal
 * puesta se encuentran en segundos, sin tener que exportar nada.
 */
function LineaPosicion({
  etiqueta,
  monto,
  movimientos = [],
}: {
  etiqueta: string
  monto: number
  movimientos?: Movimiento[]
}) {
  const [abierto, setAbierto] = useState(false)
  const sePuedeAbrir = movimientos.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => sePuedeAbrir && setAbierto((v) => !v)}
        aria-expanded={sePuedeAbrir ? abierto : undefined}
        disabled={!sePuedeAbrir}
        className="flex w-full items-center justify-between gap-2 text-left"
        style={{ cursor: sePuedeAbrir ? 'pointer' : 'default' }}
      >
        <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
          {etiqueta}
          {sePuedeAbrir && (
            <>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({movimientos.length})
              </span>
              <ChevronDown
                size={12}
                aria-hidden="true"
                style={{ transform: abierto ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
              />
            </>
          )}
        </span>
        <span className="tabular font-medium" style={{ color: 'var(--text-primary)' }}>
          {formatoMoneda(monto)}
        </span>
      </button>

      {abierto && (
        <ul className="mt-1 mb-2 max-h-56 space-y-0.5 overflow-y-auto rounded-md px-2 py-1.5 text-xs" style={{ background: 'var(--surface-2)' }}>
          {[...movimientos]
            .sort((a, b) => b.monto - a.monto)
            .map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                  {m.concepto}
                  <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                    {fechaCorta(m.fecha)}
                  </span>
                </span>
                <span className="tabular shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  {formatoMoneda(m.monto)}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

/** "2026-04-15" → "15/04". En el detalle la fecha es para ubicar el movimiento, no para leerla
 * completa: el año ocupa lugar y casi siempre es el mismo. */
function fechaCorta(fechaISO: string): string {
  const [, mes, dia] = fechaISO.split('-')
  return `${dia}/${mes}`
}

function etiquetaSemana(fechaISO: string, semanas: RangoSemana[]): { texto: string; color: string } {
  const idx = indiceDeSemana(fechaISO, semanas)
  if (idx !== null) return { texto: semanas[idx].labelCorto, color: 'var(--text-muted)' }
  const fecha = new Date(`${fechaISO}T00:00:00`)
  if (fecha < semanas[0].inicio) return { texto: 'Vencido', color: 'var(--status-critical)' }
  return { texto: 'Más adelante', color: 'var(--text-muted)' }
}

function ImportarExcelButton({
  activo,
  onImportar,
}: {
  activo: boolean
  onImportar: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
      style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
    >
      <FileUp size={14} aria-hidden="true" /> {activo ? 'Importando…' : 'Importar Excel'}
      <input type="file" accept=".xlsx,.xls" onChange={onImportar} className="hidden" disabled={activo} />
    </label>
  )
}

interface ColumnaProps {
  titulo: string
  tituloCumplido: string
  movimientos: Movimiento[]
  semanas: RangoSemana[]
  onAgregar: (concepto: string, monto: number, fecha: string) => void
  onToggle: (id: string) => void
  onEliminar: (id: string) => void
  /** Corregir un movimiento cargado a mano: concepto, importe o fecha. */
  onEditar: (id: string, cambios: { concepto: string; monto: number; fecha: string }) => void
  /** Ir a la pantalla que manda sobre un movimiento generado (Comprobantes, Cheques, Sueldos). */
  onIrAlOrigen: (origen: OrigenMovimiento, concepto: string) => void
  onMarcarVarios: (ids: string[], cumplido: boolean) => void
  onCambiarMedioPago: (id: string, medioPago: MedioPago | undefined) => void
  /** Cuentas bancarias/caja (plan Full) para elegir dónde entró/salió la plata de una factura. */
  cuentas?: CuentaBancaria[]
  onCambiarCuentaFactura: (id: string, cuentaId: string) => void
  extra?: React.ReactNode
}

function FilaMovimiento({
  m,
  semanas,
  seleccionado,
  onSeleccionar,
  onToggle,
  onEliminar,
  onEditar,
  onIrAlOrigen,
  onCambiarMedioPago,
  cuentas,
  onCambiarCuentaFactura,
}: {
  m: Movimiento
  semanas: RangoSemana[]
  seleccionado: boolean
  onSeleccionar: (id: string, marcado: boolean) => void
  onToggle: (id: string) => void
  onEliminar: (id: string) => void
  onEditar: (id: string, cambios: { concepto: string; monto: number; fecha: string }) => void
  onIrAlOrigen: (origen: OrigenMovimiento, concepto: string) => void
  onCambiarMedioPago: (id: string, medioPago: MedioPago | undefined) => void
  cuentas?: CuentaBancaria[]
  onCambiarCuentaFactura: (id: string, cuentaId: string) => void
}) {
  const etiqueta = etiquetaSemana(m.fecha, semanas)
  const deFactura = m.id.startsWith(PREFIJO_FACTURA)
  const deCheque = m.id.startsWith(PREFIJO_CHEQUE)
  const deSueldo = m.id.startsWith(PREFIJO_SUELDO)
  // Solo se editan acá los cargados a mano. Los que vienen de Comprobantes, Cheques o Sueldos se
  // corrigen en su propia pantalla, que es donde está el dato de verdad: cambiarle el importe
  // acá a una factura dejaría la factura diciendo una cosa y la proyección otra.
  const editable = !deFactura && !deCheque && !deSueldo
  const [editando, setEditando] = useState(false)
  const [concepto, setConcepto] = useState(m.concepto)
  const [monto, setMonto] = useState(m.monto)
  const [fecha, setFecha] = useState(m.fecha)

  function abrirEdicion() {
    setConcepto(m.concepto)
    setMonto(m.monto)
    setFecha(m.fecha)
    setEditando(true)
  }

  function guardar() {
    if (!concepto.trim() || monto <= 0 || !fecha) return
    onEditar(m.id, { concepto: concepto.trim(), monto, fecha })
    setEditando(false)
  }

  if (editando) {
    return (
      <li className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--series-blue)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            aria-label="Concepto"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardar()
              if (e.key === 'Escape') setEditando(false)
            }}
            className="min-w-[140px] flex-1 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <InputMoneda
            value={monto}
            onChange={setMonto}
            aria-label="Monto"
            className="tabular w-28 shrink-0 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-label="Fecha"
            className="shrink-0 rounded-lg border px-2 py-1 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <button
            type="button"
            onClick={guardar}
            className="shrink-0 rounded-lg px-3 py-1 text-xs font-semibold text-white"
            style={{ background: 'var(--series-blue)' }}
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="shrink-0 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancelar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li
      className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
      style={{ borderColor: 'var(--border)', opacity: m.cumplido ? 0.55 : 1 }}
    >
      <input
        type="checkbox"
        checked={seleccionado}
        onChange={(e) => onSeleccionar(m.id, e.target.checked)}
        aria-label="Seleccionar"
        className="h-4 w-4 shrink-0"
        disabled={deSueldo}
      />
      <input
        type="checkbox"
        checked={m.cumplido}
        onChange={() => onToggle(m.id)}
        aria-label={m.cumplido ? 'Marcar como pendiente' : 'Marcar como cumplido'}
        className="h-4 w-4 shrink-0 accent-current"
        style={{ color: 'var(--series-blue)' }}
        disabled={deSueldo}
        title={deSueldo ? 'El pago de la nómina se registra desde la solapa Sueldos' : undefined}
      />
      <span
        className="flex flex-1 items-center gap-1 truncate"
        style={{
          color: 'var(--text-primary)',
          textDecoration: m.cumplido ? 'line-through' : 'none',
        }}
        title={
          deFactura
            ? 'Generado desde Comprobantes'
            : deCheque
              ? 'Generado desde Cheques'
              : deSueldo
                ? 'Generado desde Sueldos — el pago se registra ahí'
                : undefined
        }
      >
        {deFactura && <Receipt size={13} className="shrink-0" aria-hidden="true" />}
        {deCheque && <Landmark size={13} className="shrink-0" aria-hidden="true" />}
        {deSueldo && <Users size={13} className="shrink-0" aria-hidden="true" />}
        <span className="truncate">{m.concepto}</span>
      </span>
      <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
        {new Date(`${m.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
      </span>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
        style={{ color: etiqueta.color, background: 'var(--surface-2)' }}
      >
        {etiqueta.texto}
      </span>
      {m.cumplido && !deCheque && (
        <select
          value={m.medioPago ?? ''}
          onChange={(e) => onCambiarMedioPago(m.id, (e.target.value || undefined) as MedioPago | undefined)}
          title="Con qué se cobró/pagó"
          className="shrink-0 rounded border px-1.5 py-0.5 text-xs"
          style={{
            borderColor: m.medioPago ? 'var(--border)' : 'var(--status-warning)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">Medio…</option>
          {(Object.keys(MEDIOS_PAGO_LABEL) as MedioPago[]).map((medio) => (
            <option key={medio} value={medio}>
              {MEDIOS_PAGO_LABEL[medio]}
            </option>
          ))}
        </select>
      )}
      {m.cumplido && deFactura && m.medioPago && m.medioPago !== 'cheque' && cuentas && cuentas.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onCambiarCuentaFactura(m.id, e.target.value)
          }}
          title="En qué caja o cuenta entró/salió la plata"
          className="shrink-0 rounded border px-1.5 py-0.5 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        >
          <option value="">Cuenta…</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      )}
      <span className="tabular shrink-0 font-medium" style={{ color: 'var(--text-primary)' }}>
        {formatoMoneda(m.monto)}
      </span>
      {/* El mismo lápiz para todos. En los cargados a mano abre la edición en la fila; en los que
          vienen de otra pantalla lleva hasta ahí, que es donde está el dato de verdad. Tener dos
          íconos distintos haría pensar que unos se editan y otros no, cuando todos se editan: lo
          único que cambia es dónde. */}
      <IconButton
        icon={Pencil}
        onClick={() =>
          editable
            ? abrirEdicion()
            : onIrAlOrigen(deFactura ? 'factura' : deCheque ? 'cheque' : 'sueldo', m.concepto)
        }
        label={
          editable
            ? 'Editar'
            : `Editar en ${deFactura ? 'Comprobantes' : deCheque ? 'Cheques' : 'Sueldos'}`
        }
        className="shrink-0"
      />
      {!deFactura && !deCheque && (
        <IconButton icon={Trash2} onClick={() => onEliminar(m.id)} label="Eliminar" className="shrink-0" />
      )}
    </li>
  )
}

function ColumnaMovimientos({
  titulo,
  tituloCumplido,
  movimientos,
  semanas,
  onAgregar,
  onToggle,
  onEliminar,
  onEditar,
  onIrAlOrigen,
  onMarcarVarios,
  onCambiarMedioPago,
  cuentas,
  onCambiarCuentaFactura,
  extra,
}: ColumnaProps) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState(0)
  const [fecha, setFecha] = useState(hoyISO())
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [verCumplidos, setVerCumplidos] = useState(false)

  const pendientes = movimientos.filter((m) => !m.cumplido)
  const cumplidos = movimientos.filter((m) => m.cumplido)
  const totalPendiente = pendientes.reduce((s, m) => s + m.monto, 0)
  const totalCumplido = cumplidos.reduce((s, m) => s + m.monto, 0)
  const total = totalPendiente + totalCumplido
  const progresoPct = total > 0 ? (totalCumplido / total) * 100 : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!concepto.trim() || !monto || monto <= 0) return
    onAgregar(concepto.trim(), monto, fecha)
    setConcepto('')
    setMonto(0)
  }

  function alternarSeleccion(id: string, marcado: boolean) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (marcado) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function seleccionarTodos(lista: Movimiento[], marcado: boolean) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      for (const m of lista) {
        if (marcado) next.add(m.id)
        else next.delete(m.id)
      }
      return next
    })
  }

  function handleMarcarSeleccionados(cumplido: boolean) {
    onMarcarVarios([...seleccionados], cumplido)
    setSeleccionados(new Set())
  }

  const todosPendientesSeleccionados = pendientes.length > 0 && pendientes.every((m) => seleccionados.has(m.id))
  const todosCumplidosSeleccionados = cumplidos.length > 0 && cumplidos.every((m) => seleccionados.has(m.id))
  const haySeleccion = seleccionados.size > 0

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {titulo}
        </h3>
        {extra}
      </div>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Cliente / proveedor"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <InputMoneda
          placeholder="Monto"
          value={monto}
          onChange={setMonto}
          className="tabular w-24 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="tabular w-36 shrink-0 rounded-lg border px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
        <Button type="submit" variante="primario">
          Agregar
        </Button>
      </form>

      {movimientos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Todavía no cargaste nada.
        </p>
      ) : (
        <>
          {haySeleccion && (
            <div
              className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs"
              style={{ borderColor: 'var(--series-blue)', background: 'var(--surface-2)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {seleccionados.size} seleccionada(s)
              </span>
              <Button
                onClick={() => handleMarcarSeleccionados(true)}
                variante="primario"
                pill
                style={{ background: 'var(--status-good)' }}
                icono={<Check size={13} aria-hidden="true" />}
              >
                Marcar como {tituloCumplido}
              </Button>
              <button
                onClick={() => handleMarcarSeleccionados(false)}
                className="rounded-full border px-3 py-1 font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                ↺ Marcar como pendiente
              </button>
              <button
                onClick={() => setSeleccionados(new Set())}
                className="ml-auto text-xs underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancelar selección
              </button>
            </div>
          )}

          <div className="mb-1 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={todosPendientesSeleccionados}
                onChange={(e) => seleccionarTodos(pendientes, e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Seleccionar todas las pendientes ({pendientes.length})
            </label>
          </div>

          {pendientes.length === 0 ? (
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--status-good-text)' }}>
              <Check size={14} aria-hidden="true" /> No hay nada pendiente.
            </p>
          ) : (
            <ul className="mb-2 max-h-72 space-y-1.5 overflow-y-auto">
              {pendientes.map((m) => (
                <FilaMovimiento
                  key={m.id}
                  m={m}
                  semanas={semanas}
                  seleccionado={seleccionados.has(m.id)}
                  onSeleccionar={alternarSeleccion}
                  onToggle={onToggle}
                  onEliminar={onEliminar}
                  onEditar={onEditar}
                  onIrAlOrigen={onIrAlOrigen}
                  onCambiarMedioPago={onCambiarMedioPago}
                  cuentas={cuentas}
                  onCambiarCuentaFactura={onCambiarCuentaFactura}
                />
              ))}
            </ul>
          )}

          {cumplidos.length > 0 && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--gridline)' }}>
              <button
                onClick={() => setVerCumplidos((v) => !v)}
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                {verCumplidos ? '▾' : '▸'} {tituloCumplido} ({cumplidos.length}) — {formatoMoneda(totalCumplido)}
              </button>
              {verCumplidos && (
                <>
                  <label
                    className="mb-1 flex cursor-pointer items-center gap-1.5 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <input
                      type="checkbox"
                      checked={todosCumplidosSeleccionados}
                      onChange={(e) => seleccionarTodos(cumplidos, e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    Seleccionar todas
                  </label>
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                    {cumplidos.map((m) => (
                      <FilaMovimiento
                        key={m.id}
                        m={m}
                        semanas={semanas}
                        seleccionado={seleccionados.has(m.id)}
                        onSeleccionar={alternarSeleccion}
                        onToggle={onToggle}
                        onEliminar={onEliminar}
                        onEditar={onEditar}
                        onIrAlOrigen={onIrAlOrigen}
                        onCambiarMedioPago={onCambiarMedioPago}
                        cuentas={cuentas}
                        onCambiarCuentaFactura={onCambiarCuentaFactura}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>
            Cumplido: <span className="tabular font-semibold">{formatoMoneda(totalCumplido)}</span>
          </span>
          <span>
            Pendiente: <span className="tabular font-semibold">{formatoMoneda(totalPendiente)}</span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--gridline)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${progresoPct}%`, background: 'var(--status-good)' }}
          />
        </div>
      </div>
    </Card>
  )
}

interface Props {
  facturas?: Factura[]
  onCambiarFactura?: (id: string, cambios: Partial<Pick<Factura, 'cumplido' | 'medioPago'>> & { cuentaId?: string }) => void
  cheques?: Cheque[]
  onCambiarEstadoCheque?: (id: string, estado: EstadoCheque) => void
  /** Cuentas bancarias/caja (plan Full) para elegir dónde entró/salió la plata al cobrar/pagar. */
  cuentas?: CuentaBancaria[]
  /** Pagos que genera la nómina del mes (plan Full) — se muestran para verlos venir, pero se
   * registran desde la solapa Sueldos. */
  pagosSueldos?: PagoSueldos[]
  /** Los pagos a cuenta ya registrados, para que una factura cobrada a medias cuente solo por su
   * saldo y no por el monto completo. Se llama así y no `pagos` porque en esta pantalla `pagos`
   * ya son los movimientos de salida de la semana, que es otra cosa. */
  pagosDeFacturas?: PagoFactura[]
  /** Llevar a la pantalla que manda sobre un movimiento generado. Sin esto el lápiz de esas
   * filas no tendría a dónde ir, así que el botón directamente no se muestra. */
  onIrAlOrigen?: (origen: OrigenMovimiento, concepto: string) => void
  /** De quién son los datos en Firestore. Para un empleado es el uid del dueño, no el suyo (ver
   * src/lib/empresa.ts). Sin esto, un usuario invitado guardaría la planilla en su propia cuenta
   * vacía y el dueño nunca la vería. */
  uidDatos?: string | null
}

export function CobranzasPagosSemanal({
  facturas = [],
  onCambiarFactura,
  cheques = [],
  onCambiarEstadoCheque,
  cuentas,
  pagosSueldos = [],
  pagosDeFacturas = [],
  onIrAlOrigen,
  uidDatos,
}: Props) {
  const { user } = useAuth()
  // Sin acceso resuelto se cae en el uid propio, que es como funcionaba antes de que existieran
  // los usuarios de la empresa.
  const uid = uidDatos ?? user?.uid ?? null
  const hoy = useFechaActual()
  const [movimientos, setMovimientos] = useState<Movimiento[]>(() => obtenerMovimientos())
  const [errorImport, setErrorImport] = useState<string | null>(null)
  const [importandoTipo, setImportandoTipo] = useState<TipoMovimiento | null>(null)

  // La misma lista que usa el Dashboard para su franja de hoy — ver movimientosDelNegocio.ts.
  const todosMovimientos = useMemo(
    () => armarMovimientos({ manuales: movimientos, facturas, cheques, pagosSueldos, pagos: pagosDeFacturas }),
    [movimientos, facturas, cheques, pagosSueldos, pagosDeFacturas],
  )

  const [nubeLista, setNubeLista] = useState(false)
  const cargaNubeHecha = useRef(false)

  function refrescar() {
    setMovimientos(obtenerMovimientos())
  }

  useEffect(() => {
    if (!uid) {
      setNubeLista(false)
      cargaNubeHecha.current = false
      return
    }
    if (cargaNubeHecha.current) return
    cargaNubeHecha.current = true
    // Solo el bloque de la semana: los demás no los necesita esta pantalla, y un empleado que no
    // los tenga asignados recibiría un rechazo de las reglas por nada.
    cargarDatosUsuario(uid, ['semana'])
      .then((datos) => {
        if (datos?.movimientosSemana) {
          reemplazarMovimientos(datos.movimientosSemana)
          refrescar()
        }
      })
      .catch(() => {
        // Firestore puede no estar disponible todavía — seguimos con lo local.
      })
      .finally(() => setNubeLista(true))
  }, [uid])

  useEffect(() => {
    if (!uid || !nubeLista) return
    const timeout = setTimeout(() => {
      guardarDatosUsuario(uid, { movimientosSemana: movimientos }, ['semana']).catch(() => {})
    }, 800)
    return () => clearTimeout(timeout)
  }, [uid, nubeLista, movimientos])

  function handleAgregar(tipo: TipoMovimiento) {
    return (concepto: string, monto: number, fecha: string) => {
      agregarMovimiento(tipo, concepto, monto, fecha)
      refrescar()
    }
  }

  function handleToggle(id: string) {
    if (id.startsWith(PREFIJO_FACTURA)) {
      const facturaId = id.slice(PREFIJO_FACTURA.length)
      const actual = todosMovimientos.find((m) => m.id === id)
      onCambiarFactura?.(facturaId, { cumplido: !actual?.cumplido })
      return
    }
    if (id.startsWith(PREFIJO_CHEQUE)) {
      const chequeId = id.slice(PREFIJO_CHEQUE.length)
      const actual = todosMovimientos.find((m) => m.id === id)
      onCambiarEstadoCheque?.(chequeId, actual?.cumplido ? 'cartera' : 'cobrado')
      return
    }
    alternarCumplido(id)
    refrescar()
  }

  function handleEditar(id: string, cambios: { concepto: string; monto: number; fecha: string }) {
    editarMovimiento(id, cambios)
    refrescar()
  }

  function handleEliminar(id: string) {
    eliminarMovimiento(id)
    refrescar()
  }

  function handleMarcarVarios(ids: string[], cumplido: boolean) {
    const idsFactura = ids.filter((id) => id.startsWith(PREFIJO_FACTURA))
    const idsCheque = ids.filter((id) => id.startsWith(PREFIJO_CHEQUE))
    const idsManual = ids.filter((id) => !id.startsWith(PREFIJO_FACTURA) && !id.startsWith(PREFIJO_CHEQUE))
    for (const id of idsFactura) {
      onCambiarFactura?.(id.slice(PREFIJO_FACTURA.length), { cumplido })
    }
    for (const id of idsCheque) {
      onCambiarEstadoCheque?.(id.slice(PREFIJO_CHEQUE.length), cumplido ? 'cobrado' : 'cartera')
    }
    if (idsManual.length > 0) {
      marcarCumplidoVarios(idsManual, cumplido)
      refrescar()
    }
  }

  function handleCambiarMedioPago(id: string, medioPago: MedioPago | undefined) {
    if (id.startsWith(PREFIJO_FACTURA)) {
      onCambiarFactura?.(id.slice(PREFIJO_FACTURA.length), { medioPago })
      return
    }
    cambiarMedioPago(id, medioPago)
    refrescar()
  }

  function handleCambiarCuentaFactura(id: string, cuentaId: string) {
    if (id.startsWith(PREFIJO_FACTURA)) {
      onCambiarFactura?.(id.slice(PREFIJO_FACTURA.length), { cuentaId })
    }
  }

  function handleVaciar() {
    if (movimientos.length === 0) return
    if (!window.confirm('¿Vaciar todos los movimientos cargados? No se puede deshacer.')) return
    vaciarSemana()
    refrescar()
  }

  function handleImportarExcel(tipo: TipoMovimiento) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const inputEl = e.target
      if (!file) return
      setErrorImport(null)
      setImportandoTipo(tipo)
      try {
        const filas = await importarMovimientosDesdeExcel(file)
        if (filas.length === 0) {
          setErrorImport('No se encontraron filas válidas en el archivo.')
        } else {
          agregarMovimientos(tipo, filas)
          refrescar()
        }
      } catch (err) {
        setErrorImport(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
      } finally {
        setImportandoTipo(null)
        inputEl.value = ''
      }
    }
  }

  // La posición sale de la misma lista que muestra la pantalla, que ya resolvió el solapamiento
  // entre facturas y cheques: una factura abonada con cheque figura una sola vez.
  const posicion = useMemo(
    () => calcularPosicionFinanciera(calcularSaldoTotalBancos(cuentas ?? []), todosMovimientos),
    [cuentas, todosMovimientos],
  )

  const cobros = todosMovimientos.filter((m) => m.tipo === 'cobro')
  const pagos = todosMovimientos.filter((m) => m.tipo === 'pago')

  // El acumulado arranca en la caja de hoy más lo vencido que sigue pendiente, así cada semana
  // dice con cuánta plata se termina y no cuánto se movió. Lo vencido ya cumplido no entra: esa
  // plata ya entró o salió y por lo tanto ya está dentro del saldo de las cuentas.
  const arrastreVencido = useMemo(
    () =>
      agruparPorSemana(todosMovimientos, 4, hoy)
        .vencidos.filter((m) => !m.cumplido)
        .reduce((s, m) => s + (m.tipo === 'cobro' ? m.monto : -m.monto), 0),
    [todosMovimientos, hoy],
  )
  const saldoInicialSemanal = posicion.caja + arrastreVencido
  const agrupacion = useMemo(
    () => agruparPorSemana(todosMovimientos, 4, hoy, saldoInicialSemanal),
    [todosMovimientos, hoy, saldoInicialSemanal],
  )
  const totalVencidos = agrupacion.vencidos.reduce(
    (s, m) => s + (m.tipo === 'cobro' ? m.monto : -m.monto),
    0,
  )
  const totalAFuturo = agrupacion.aFuturo.reduce((s, m) => s + m.monto, 0)

  return (
    <>
      <section
        className="mb-6 rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Posición financiera
        </h2>
        <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          Lo que tenés hoy más lo que falta cobrar, menos lo que falta pagar. Solo entra lo
          pendiente: lo ya cobrado o pagado se movió y está en el saldo de tus cuentas.
        </p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Tenés y vas a cobrar
            </p>
            <div className="space-y-1 text-sm">
              <LineaPosicion etiqueta="Caja y bancos" monto={posicion.caja} />
              <LineaPosicion etiqueta="Cheques a cobrar" monto={posicion.aCobrar.cheques} movimientos={posicion.aCobrar.detalle.cheque} />
              <LineaPosicion etiqueta="Clientes (comprobantes)" monto={posicion.aCobrar.facturas} movimientos={posicion.aCobrar.detalle.factura} />
              <LineaPosicion etiqueta="Otras cobranzas cargadas" monto={posicion.aCobrar.otros} movimientos={posicion.aCobrar.detalle.manual} />
              <div className="flex items-center justify-between border-t pt-1" style={{ borderColor: 'var(--gridline)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Total disponible
                </span>
                <span className="tabular font-semibold" style={{ color: 'var(--status-good-text)' }}>
                  {formatoMoneda(posicion.disponibleProyectado)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Vas a pagar
            </p>
            <div className="space-y-1 text-sm">
              <LineaPosicion etiqueta="Cheques a pagar" monto={posicion.aPagar.cheques} movimientos={posicion.aPagar.detalle.cheque} />
              <LineaPosicion etiqueta="Proveedores (comprobantes)" monto={posicion.aPagar.facturas} movimientos={posicion.aPagar.detalle.factura} />
              <LineaPosicion etiqueta="Sueldos y cargas" monto={posicion.aPagar.sueldos} movimientos={posicion.aPagar.detalle.sueldo} />
              <LineaPosicion etiqueta="Otros pagos cargados" monto={posicion.aPagar.otros} movimientos={posicion.aPagar.detalle.manual} />
              <div className="flex items-center justify-between border-t pt-1" style={{ borderColor: 'var(--gridline)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Total a pagar
                </span>
                <span className="tabular font-semibold" style={{ color: 'var(--status-critical)' }}>
                  {formatoMoneda(posicion.aPagar.total)}
                </span>
              </div>
            </div>
          </div>

          <div
            className="flex flex-col justify-center rounded-lg border p-3"
            style={{ borderColor: posicion.posicionNeta >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
          >
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Te queda
            </p>
            <p
              className="text-3xl font-semibold"
              style={{ color: posicion.posicionNeta >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
            >
              {formatoMoneda(posicion.posicionNeta)}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {posicion.posicionNeta >= 0
                ? 'Si entra y sale todo lo pendiente, terminás con esto.'
                : 'Con lo pendiente no alcanza: falta conseguir esta diferencia.'}
            </p>
          </div>
        </div>
      </section>

      <section
        className="mb-6 rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Resumen semanal — ingresos y gastos por semana
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              La caja proyectada arranca en {formatoMoneda(posicion.caja)} de caja y bancos
              {arrastreVencido !== 0 && ` más ${formatoMoneda(arrastreVencido)} de vencido sin cobrar ni pagar`} y
              arrastra el saldo de cada semana: es con cuánta plata terminás cada domingo, no cómo le fue a esa
              semana sola.
            </p>
            {user && (
              <p className="inline-flex items-center gap-1 text-xs" style={{ color: nubeLista ? 'var(--status-good-text)' : 'var(--text-muted)' }}>
                {nubeLista ? (<><Cloud size={12} aria-hidden="true" /> Guardado en tu cuenta</>) : 'Sincronizando con tu cuenta…'}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => descargarPdfCobranzasSemanal(agrupacion, todosMovimientos)}
              className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
            >
              <FileDown size={14} aria-hidden="true" /> Descargar / Imprimir PDF
            </button>
            <button
              onClick={handleVaciar}
              className="rounded-full border px-4 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Vaciar todo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agrupacion.semanas.map((semana, i) => {
            const t = agrupacion.totalesPorSemana[i]
            return (
              <div key={semana.labelCorto} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {semana.label}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Cobros</span>
                    <span className="tabular font-medium" style={{ color: 'var(--status-good-text)' }}>
                      {formatoMoneda(t.cobros)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'var(--text-secondary)' }}>Pagos</span>
                    <span className="tabular font-medium" style={{ color: 'var(--status-critical)' }}>
                      {formatoMoneda(t.pagos)}
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-between border-t pt-1"
                    style={{ borderColor: 'var(--gridline)' }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>Saldo de la semana</span>
                    <span
                      className="tabular font-medium"
                      style={{ color: t.saldo >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
                    >
                      {formatoMoneda(t.saldo)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Caja proyectada
                    </span>
                    <span
                      className="tabular font-semibold"
                      style={{ color: t.saldoAcumulado >= 0 ? 'var(--status-good-text)' : 'var(--status-critical)' }}
                    >
                      {formatoMoneda(t.saldoAcumulado)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {(agrupacion.vencidos.length > 0 || agrupacion.aFuturo.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {agrupacion.vencidos.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle size={12} aria-hidden="true" /> Vencido (antes de esta semana):{' '}
                <span className="tabular font-semibold" style={{ color: 'var(--status-critical)' }}>
                  {formatoMoneda(totalVencidos)}
                </span>{' '}
                netos en {agrupacion.vencidos.length} movimiento(s)
              </span>
            )}
            {agrupacion.aFuturo.length > 0 && (
              <span>
                Más allá de 4 semanas:{' '}
                <span className="tabular font-semibold">{formatoMoneda(totalAFuturo)}</span> en{' '}
                {agrupacion.aFuturo.length} movimiento(s)
              </span>
            )}
          </div>
        )}
      </section>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ColumnaMovimientos
          titulo="Cuentas a cobrar"
          tituloCumplido="cobradas"
          movimientos={cobros}
          semanas={agrupacion.semanas}
          onAgregar={handleAgregar('cobro')}
          onToggle={handleToggle}
          onEliminar={handleEliminar}
          onEditar={handleEditar}
          onIrAlOrigen={onIrAlOrigen ?? (() => {})}
          onMarcarVarios={handleMarcarVarios}
          onCambiarMedioPago={handleCambiarMedioPago}
          cuentas={cuentas}
          onCambiarCuentaFactura={handleCambiarCuentaFactura}
          extra={
            <div className="flex flex-col items-end gap-1">
              <ImportarExcelButton activo={importandoTipo === 'cobro'} onImportar={handleImportarExcel('cobro')} />
              <button
                onClick={() => descargarPlantillaMovimientos('cobro')}
                className="inline-flex items-center gap-1 text-[11px] font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                <Download size={11} aria-hidden="true" /> Descargar plantilla
              </button>
            </div>
          }
        />
        <ColumnaMovimientos
          titulo="Gastos a pagar"
          tituloCumplido="pagadas"
          movimientos={pagos}
          semanas={agrupacion.semanas}
          onAgregar={handleAgregar('pago')}
          onToggle={handleToggle}
          onEliminar={handleEliminar}
          onEditar={handleEditar}
          onIrAlOrigen={onIrAlOrigen ?? (() => {})}
          onMarcarVarios={handleMarcarVarios}
          onCambiarMedioPago={handleCambiarMedioPago}
          cuentas={cuentas}
          onCambiarCuentaFactura={handleCambiarCuentaFactura}
          extra={
            <div className="flex flex-col items-end gap-1">
              <ImportarExcelButton activo={importandoTipo === 'pago'} onImportar={handleImportarExcel('pago')} />
              <button
                onClick={() => descargarPlantillaMovimientos('pago')}
                className="inline-flex items-center gap-1 text-[11px] font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                <Download size={11} aria-hidden="true" /> Descargar plantilla
              </button>
            </div>
          }
        />
      </div>

      {errorImport && (
        <p
          className="mb-6 rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--status-critical)', color: 'var(--status-critical)' }}
        >
          {errorImport}
        </p>
      )}

      <p className="border-t pt-6 pb-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        Las semanas se arman según la fecha que le pusiste a cada cobro o pago (lunes a domingo), empezando por
        la semana actual. El Excel a importar (tanto en cobros como en pagos) debe tener una fila de
        encabezados con columnas como "Cliente" o "Proveedor", "Monto" y, opcionalmente, "Fecha".
        {facturas.length > 0 && (
          <>
            {' '}
            Los ítems marcados con <Receipt size={12} className="inline align-text-bottom" aria-hidden="true" /> vienen de tus facturas cargadas en "Comprobantes" — tildarlos acá
            marca la factura como cobrada/pagada, y no se pueden borrar desde acá (se gestionan desde esa
            pestaña).
          </>
        )}
        {cheques.length > 0 && (
          <>
            {' '}
            Los ítems marcados con <Landmark size={12} className="inline align-text-bottom" aria-hidden="true" /> vienen de tus cheques cargados en "Cheques" — tildarlos acá lo marca
            como cobrado/pagado. Si un cheque tiene facturas asociadas, esas facturas no se listan por
            separado (el cheque las representa a todas juntas).
          </>
        )}
      </p>
    </>
  )
}
