import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { FinkoLogo } from './FinkoLogo'
import { BrandHeader } from './BrandHeader'
import { WhatsAppFloatingButton } from './WhatsAppContact'
import { LoginModal } from './LoginModal'
import { useAuth } from '../lib/AuthContext'

const SECCIONES: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Préstamos', end: true },
  { to: '/empresas', label: 'Para empresas' },
]

function SesionUsuario() {
  const { habilitado, user, cerrarSesion } = useAuth()
  const [mostrarLogin, setMostrarLogin] = useState(false)

  if (!habilitado) return null

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="hidden max-w-[140px] truncate sm:inline" style={{ color: 'var(--text-secondary)' }}>
          {user.displayName || user.email}
        </span>
        <button
          onClick={() => cerrarSesion()}
          className="rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setMostrarLogin(true)}
        className="rounded-full border px-4 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--series-blue)', color: 'var(--series-blue)' }}
      >
        Iniciar sesión
      </button>
      {mostrarLogin && <LoginModal onCerrar={() => setMostrarLogin(false)} />}
    </>
  )
}

export function Layout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FinkoLogo />
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-2" role="tablist">
              {SECCIONES.map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={s.end}
                  className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  style={({ isActive }) =>
                    isActive
                      ? { background: 'var(--series-blue)', borderColor: 'var(--series-blue)', color: 'white' }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface-1)' }
                  }
                >
                  {s.label}
                </NavLink>
              ))}
            </nav>
            <SesionUsuario />
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="mt-4 border-t pt-6 pb-10 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <p className="mb-3 text-center text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
          Creado por
        </p>
        <div className="flex justify-center">
          <BrandHeader />
        </div>
      </footer>

      <WhatsAppFloatingButton />
    </div>
  )
}
