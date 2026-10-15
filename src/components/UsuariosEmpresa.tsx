import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Clock, Copy, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import {
  cambiarModulos,
  invitarUsuario,
  listarUsuarios,
  quitarUsuario,
  type InvitacionPendiente,
  type MiembroEmpresa,
} from '../lib/empresa'
import { useAuth } from '../lib/AuthContext'
import { BLOQUE_LABEL, MODULOS_EN_ORDEN, MODULO_LABEL, bloquesDe, modulosQueExponen, type Modulo } from '../lib/permisos'
import { Card } from './Card'

// Los usuarios de la empresa, desde el lado del dueño.
//
// Lo que esta pantalla tiene que lograr, más allá de funcionar: que el dueño entienda qué está
// dando cuando tilda un módulo. "Márgenes por sector" incluye el costo de la nómina, así que
// darlo es dar los sueldos — y eso hay que decirlo ACÁ, al tildarlo, no en un manual que nadie
// lee. De eso se encarga el aviso de abajo del formulario.

/** Los bloques sobre los que vale la pena avisar. No es todo: que Comprobantes dé acceso a las
 * facturas es obvio y avisarlo sería ruido. Que Márgenes dé acceso a los sueldos, no. */
const BLOQUES_SENSIBLES = ['sueldos', 'impuestos', 'tesoreria'] as const

/** Cómo se agrupan los módulos en la lista, para que elegir no sea leer 23 casillas seguidas. */
const GRUPOS: { label: string; modulos: Modulo[] }[] = [
  { label: 'Ventas y compras', modulos: ['facturas', 'lectorFacturas', 'puntoDeVenta', 'facturacionElectronica', 'ingresosGastos', 'remitos', 'clientes', 'proveedores'] },
  { label: 'Cobranzas y tesorería', modulos: ['cobranzas', 'cuentasCorrientes', 'tesoreria', 'cheques'] },
  { label: 'Stock y costos', modulos: ['stock', 'margenes'] },
  { label: 'Sueldos', modulos: ['sueldos'] },
  { label: 'Impuestos', modulos: ['iva', 'iibb', 'monotributo'] },
  { label: 'Dirección', modulos: ['dashboard', 'presupuesto', 'patrimonio', 'inversiones', 'backup'] },
]

function fecha(ms: number | undefined): string {
  return ms ? new Date(ms).toLocaleDateString('es-AR') : ''
}

/** El aviso de lo que el dueño está dando sin haberlo tildado. */
function AvisoDeAlcance({ modulos }: { modulos: Modulo[] }) {
  const avisos = BLOQUES_SENSIBLES.map((bloque) => ({
    bloque,
    // Si tildó el módulo directo, no hay sorpresa que avisar: la sorpresa es el que lo arrastra.
    porQue: modulosQueExponen(modulos, bloque).filter((m) => m !== bloque),
  })).filter((a) => a.porQue.length > 0 && bloquesDe(modulos).includes(a.bloque))

  if (avisos.length === 0) return null

  return (
    <div
      className="mt-4 rounded-lg border p-3 text-sm"
      style={{ borderColor: 'var(--warning-border, #f0c36d)', background: 'var(--warning-bg, #fff8e6)' }}
    >
      <p className="flex items-center gap-2 font-medium" style={{ color: 'var(--text-primary)' }}>
        <AlertTriangle size={15} /> Con esos módulos también va a poder ver:
      </p>
      <ul className="mt-2 space-y-1" style={{ color: 'var(--text-secondary)' }}>
        {avisos.map((a) => (
          <li key={a.bloque}>
            <strong>{BLOQUE_LABEL[a.bloque]}</strong> — porque le diste{' '}
            {a.porQue.map((m) => MODULO_LABEL[m]).join(', ')}.
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        No es un error ni se puede evitar tildando menos: esas pantallas muestran números que se
        calculan con esos datos. Si no querés que los vea, sacale el módulo.
      </p>
    </div>
  )
}

function ListaDeModulos({
  seleccion,
  onCambiar,
  id,
}: {
  seleccion: Modulo[]
  onCambiar: (modulos: Modulo[]) => void
  id: string
}) {
  function alternar(m: Modulo) {
    onCambiar(seleccion.includes(m) ? seleccion.filter((x) => x !== m) : [...seleccion, m])
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {GRUPOS.map((g) => (
        <div key={g.label}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {g.label}
          </p>
          {g.modulos.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                name={`${id}-${m}`}
                checked={seleccion.includes(m)}
                onChange={() => alternar(m)}
              />
              {MODULO_LABEL[m]}
            </label>
          ))}
        </div>
      ))}
    </div>
  )
}

export function UsuariosEmpresa() {
  const { user } = useAuth()
  const [miembros, setMiembros] = useState<MiembroEmpresa[]>([])
  const [invitaciones, setInvitaciones] = useState<InvitacionPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [linkManual, setLinkManual] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [nuevos, setNuevos] = useState<Modulo[]>([])
  const [invitando, setInvitando] = useState(false)

  /** A quién se le están editando los módulos, y con qué selección provisoria. */
  const [editando, setEditando] = useState<{ uid: string; modulos: Modulo[] } | null>(null)

  async function refrescar() {
    try {
      const { miembros: m, invitaciones: i } = await listarUsuarios()
      setMiembros(m)
      setInvitaciones(i)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo traer la lista de usuarios.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    // Sin sesión no hay nada que traer, y pedirlo igual pintaría un error rojo a cualquiera que
    // esté mirando la demo sin cuenta. Se muestra la pantalla explicada y nada más.
    if (!user) {
      setCargando(false)
      return
    }
    void refrescar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const modulosRestantes = useMemo(() => MODULOS_EN_ORDEN.filter((m) => !nuevos.includes(m)).length, [nuevos])

  async function handleInvitar() {
    setInvitando(true)
    setError(null)
    setAviso(null)
    setLinkManual(null)
    try {
      const r = await invitarUsuario(email, nuevos)
      setEmail('')
      setNuevos([])
      // Si el mail no salió, el link igual sirve: la invitación quedó creada. Mostrarlo es mejor
      // que decirle "falló" y dejarlo sin salida.
      if (r.enviado) setAviso(`Listo, le mandamos la invitación por mail.`)
      else {
        setAviso('La invitación quedó creada, pero no se pudo mandar el mail. Pasale este link:')
        setLinkManual(r.url ?? null)
      }
      await refrescar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la invitación.')
    } finally {
      setInvitando(false)
    }
  }

  async function handleGuardarModulos() {
    if (!editando) return
    try {
      await cambiarModulos(editando.uid, editando.modulos)
      setEditando(null)
      setAviso('Módulos actualizados. Puede tardar hasta una hora en verlo, o al instante si recarga la página.')
      await refrescar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cambiar los módulos.')
    }
  }

  async function handleQuitar(m: MiembroEmpresa) {
    if (!confirm(`¿Dar de baja a ${m.email}? Pierde el acceso a todo.`)) return
    try {
      await quitarUsuario(m.uid)
      setAviso(`${m.email} ya no tiene acceso.`)
      await refrescar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar de baja al usuario.')
    }
  }

  return (
    <div className="space-y-6">
      <Card as="section">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Users size={18} /> Usuarios de la empresa
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Creá un usuario para cada persona de tu equipo y asignale solo las pantallas que necesita.
          No es un permiso de pantalla: lo que no le asignes, no lo puede ver aunque sepa programar.
          Vos seguís siendo el único que administra usuarios y el único que ve todo.
        </p>
      </Card>

      {error && (
        <Card as="section">
          <p className="text-sm" style={{ color: 'var(--danger, #b42318)' }}>{error}</p>
        </Card>
      )}

      {aviso && (
        <Card as="section">
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <Check size={15} /> {aviso}
          </p>
          {linkManual && (
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded px-2 py-1 text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                {linkManual}
              </code>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(linkManual)}
                className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Copy size={13} /> Copiar
              </button>
            </div>
          )}
        </Card>
      )}

      <Card as="section">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <UserPlus size={16} /> Invitar a alguien
        </h3>
        <label className="mb-4 block text-sm" style={{ color: 'var(--text-secondary)' }}>
          Mail de la persona
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="empleado@ejemplo.com"
            className="mt-1 w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
          />
          <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
            Le va a llegar un link para crear su contraseña. Tiene que entrar con esta misma
            dirección: si usa otra, el sistema no la deja aceptar la invitación.
          </span>
        </label>

        <ListaDeModulos id="nuevo" seleccion={nuevos} onCambiar={setNuevos} />
        <AvisoDeAlcance modulos={nuevos} />

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={!user || invitando || !email.trim() || nuevos.length === 0}
            onClick={() => void handleInvitar()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent, #0a1f44)', color: '#fff' }}
          >
            <Mail size={15} /> {invitando ? 'Enviando…' : 'Mandar invitación'}
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {nuevos.length} de {nuevos.length + modulosRestantes} módulos
          </span>
        </div>
      </Card>

      <Card as="section">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Con acceso hoy
        </h3>
        {cargando && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>}
        {!cargando && miembros.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {user
              ? 'Todavía no hay nadie más. Sos el único con acceso a la cuenta.'
              : 'Iniciá sesión para crear usuarios de tu empresa.'}
          </p>
        )}
        <ul className="space-y-3">
          {miembros.map((m) => (
            <li key={m.uid} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.email}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {m.modulos.map((x) => MODULO_LABEL[x]).join(' · ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditando(editando?.uid === m.uid ? null : { uid: m.uid, modulos: m.modulos })}
                    className="rounded-lg border px-3 py-1 text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    {editando?.uid === m.uid ? 'Cancelar' : 'Cambiar módulos'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuitar(m)}
                    className="flex items-center gap-1 rounded-lg border px-3 py-1 text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--danger, #b42318)' }}
                  >
                    <Trash2 size={13} /> Dar de baja
                  </button>
                </div>
              </div>

              {editando?.uid === m.uid && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <ListaDeModulos
                    id={m.uid}
                    seleccion={editando.modulos}
                    onCambiar={(modulos) => setEditando({ uid: m.uid, modulos })}
                  />
                  <AvisoDeAlcance modulos={editando.modulos} />
                  <button
                    type="button"
                    disabled={editando.modulos.length === 0}
                    onClick={() => void handleGuardarModulos()}
                    className="mt-4 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                    style={{ background: 'var(--accent, #0a1f44)', color: '#fff' }}
                  >
                    Guardar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {invitaciones.length > 0 && (
        <Card as="section">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Clock size={16} /> Invitaciones sin aceptar
          </h3>
          <ul className="space-y-2">
            {invitaciones.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>{i.email}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>vence el {fecha(i.vence)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card as="section">
        <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Dos cosas que conviene saber
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li>
            <strong>Los cambios de módulos tardan.</strong> El permiso viaja adentro de la sesión de
            la persona y se renueva hasta una hora después, o al instante si recarga la página.
            Dar de baja, en cambio, le corta la sesión en el momento.
          </li>
          <li>
            <strong>Backup da acceso a todo</strong>, porque es una copia del negocio entero. No se
            lo des a un empleado salvo que quieras que vea absolutamente todo.
          </li>
        </ul>
      </Card>
    </div>
  )
}
