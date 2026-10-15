import { useState } from 'react'
import { Check, UserCheck } from 'lucide-react'
import { aceptarInvitacion } from '../lib/empresa'
import { MODULO_LABEL, type Modulo } from '../lib/permisos'

// La pantalla que ve alguien que entró con el link del mail.
//
// Aparece después de iniciar sesión y antes que todo lo demás, porque hasta que no acepta, su
// cuenta es una cuenta nueva y vacía: si lo dejáramos pasar al sistema primero, vería un negocio
// en blanco y pensaría que algo se rompió.
//
// El mail con el que entró tiene que ser el mismo de la invitación. Eso lo decide el servidor, no
// esta pantalla: acá solo se muestra el mensaje que devuelve.

interface Props {
  codigo: string
  /** El mail de la sesión actual, para que el error de "entraste con otra dirección" se entienda. */
  email: string | null
  /** Se llama cuando quedó aceptada, con el token ya renovado. */
  onAceptada: () => void
  /** Para salir sin aceptar, por si entró al link de otra persona desde su propia cuenta. */
  onCancelar: () => void
}

export function AceptarInvitacion({ codigo, email, onAceptada, onCancelar }: Props) {
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'listo'>('inicial')
  const [error, setError] = useState<string | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])

  async function aceptar() {
    setEstado('enviando')
    setError(null)
    try {
      const acceso = await aceptarInvitacion(codigo)
      setModulos(acceso.modulos ?? [])
      setEstado('listo')
      // Un respiro para que alcance a leer qué le asignaron antes de que cambie la pantalla.
      setTimeout(onAceptada, 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar la invitación.')
      setEstado('inicial')
    }
  }

  if (estado === 'listo') {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--series-blue)' }}>
          <Check size={16} /> Listo
        </p>
        <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Ya tenés acceso
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Entrás a: {modulos.map((m) => MODULO_LABEL[m]).join(', ')}.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--series-blue)' }}>
        <UserCheck size={16} /> Invitación
      </p>
      <h1 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Te invitaron a una empresa
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Al aceptar vas a ver las pantallas que te asignaron, con los datos de esa empresa. Estás
        entrando como <strong>{email ?? 'tu cuenta'}</strong>: tiene que ser la misma dirección a
        la que llegó el mail.
      </p>

      {error && (
        <p className="mt-4 text-sm" style={{ color: 'var(--status-critical)' }}>
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          disabled={estado === 'enviando'}
          onClick={() => void aceptar()}
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--series-blue)' }}
        >
          {estado === 'enviando' ? 'Aceptando…' : 'Aceptar la invitación'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full px-6 py-2.5 text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
