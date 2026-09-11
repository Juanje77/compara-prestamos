import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { mensajeErrorAuth } from '../lib/authErrors'

interface Props {
  onCerrar: () => void
}

type Modo = 'login' | 'registro'

export function LoginModal({ onCerrar }: Props) {
  const { habilitado, iniciarSesion, iniciarSesionConGoogle, registrarse } = useAuth()
  const [modo, setModo] = useState<Modo>('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCerrar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      if (modo === 'registro') {
        await registrarse(email, password, nombre)
      } else {
        await iniciarSesion(email, password)
      }
      onCerrar()
    } catch (err) {
      setError(mensajeErrorAuth(err))
    } finally {
      setCargando(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setCargando(true)
    try {
      await iniciarSesionConGoogle()
      onCerrar()
    } catch (err) {
      setError(mensajeErrorAuth(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-6"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h3>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {!habilitado ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            El inicio de sesión todavía no está configurado en esta instancia de FinCorp.
          </p>
        ) : (
          <>
            <button
              onClick={handleGoogle}
              disabled={cargando}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.5 0 10.4-2.1 14.2-5.5l-6.6-5.6C29.6 34.7 27 35.7 24 35.7c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.6C41.9 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"
                />
              </svg>
              Continuar con Google
            </button>

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'var(--gridline)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                o con email
              </span>
              <div className="h-px flex-1" style={{ background: 'var(--gridline)' }} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {modo === 'registro' && (
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
              />

              {error && (
                <p className="text-sm" style={{ color: 'var(--status-critical)' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--series-blue)' }}
              >
                {cargando ? 'Un momento…' : modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {modo === 'login' ? (
                <>
                  ¿No tenés cuenta?{' '}
                  <button
                    onClick={() => {
                      setModo('registro')
                      setError(null)
                    }}
                    className="font-medium hover:underline"
                    style={{ color: 'var(--series-blue)' }}
                  >
                    Creá una
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tenés cuenta?{' '}
                  <button
                    onClick={() => {
                      setModo('login')
                      setError(null)
                    }}
                    className="font-medium hover:underline"
                    style={{ color: 'var(--series-blue)' }}
                  >
                    Iniciá sesión
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
