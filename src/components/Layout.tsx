import { NavLink, Outlet } from 'react-router-dom'
import { FinkoLogo } from './FinkoLogo'
import { BrandHeader } from './BrandHeader'
import { WhatsAppFloatingButton } from './WhatsAppContact'

const SECCIONES: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Préstamos', end: true },
  { to: '/empresas', label: 'Para empresas' },
]

export function Layout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FinkoLogo />
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
