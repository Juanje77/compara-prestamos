import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, Lock, Menu, Search, X } from 'lucide-react'
import { FincorpLogo } from './FincorpLogo'
import { ThemeToggle } from './ThemeToggle'

// El marco de la aplicación: barra lateral en escritorio, y el mismo menú en un cajón lateral
// en celular.
//
// Hubo una barra inferior con cuatro accesos y quedó afuera: con cuatro nombres repartidos en
// 390 píxeles, cada uno entraba en letra tan chica que no se leía de un vistazo, que es lo único
// que justifica una barra así. El botón de menú del encabezado abre la lista completa, con los
// nombres enteros y el buscador.
//
// Antes la app vivía adentro de la página de ventas: arriba de todo estaban la barra del sitio
// público y el título "Gestioná las finanzas de tu negocio, sin ser financista" con su bajada.
// Eso es texto para convencer a alguien que todavía no compró, y se lo comía un tercio de la
// pantalla en escritorio y la mitad en celular — todos los días, a alguien que ya pagó.
//
// La navegación también era cara: veintitrés secciones metidas en ocho píldoras con desplegables,
// 214 píxeles de alto en celular, y dos clics para llegar a cualquier cosa que no fuera de las
// tres sueltas. Acá la lateral las muestra todas juntas, siempre, a un clic.

export interface ItemSeccion<T extends string> {
  key: T
  label: string
  /** True si el plan actual no la habilita: se muestra igual, con candado, porque esconderla
   * haría imposible enterarse de que existe. */
  bloqueada?: boolean
}

export interface GrupoSeccion<T extends string> {
  label: string
  items: ItemSeccion<T>[]
}

interface Props<T extends string> {
  grupos: GrupoSeccion<T>[]
  activa: T
  onElegir: (seccion: T) => void
  titulo: string
  /** Lo que se muestra arriba a la derecha: el nombre del negocio, el plan. */
  contexto?: ReactNode
  /** Estado de la sincronización, cuando hay sesión. */
  guardado?: 'guardado' | 'sincronizando' | null
  /** Acciones de la cuenta (cerrar sesión), que antes vivían en la barra del sitio. */
  sesion?: ReactNode
  children: ReactNode
}

function estiloItem(activo: boolean) {
  return activo
    ? { background: 'var(--series-blue)', color: '#fff' }
    : { color: 'var(--text-secondary)' }
}

export function AppShell<T extends string>({
  grupos,
  activa,
  onElegir,
  titulo,
  contexto,
  guardado,
  sesion,
  children,
}: Props<T>) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  // Cambiar de sección cierra el menú del celular: dejarlo abierto taparía justo la pantalla a
  // la que se acaba de entrar.
  useEffect(() => {
    setMenuAbierto(false)
    setBusqueda('')
  }, [activa])

  const todas = grupos.flatMap((g) => g.items)
  const filtro = busqueda.trim().toLowerCase()
  const encontradas = filtro ? todas.filter((i) => i.label.toLowerCase().includes(filtro)) : []

  function Item({ item, compacto = false }: { item: ItemSeccion<T>; compacto?: boolean }) {
    const activo = item.key === activa
    return (
      <button
        type="button"
        onClick={() => onElegir(item.key)}
        aria-current={activo ? 'page' : undefined}
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-medium transition-colors ${compacto ? 'py-1.5' : 'py-2'}`}
        style={estiloItem(activo)}
      >
        <span className="truncate">{item.label}</span>
        {item.bloqueada && <Lock size={12} aria-hidden="true" className="shrink-0 opacity-70" />}
      </button>
    )
  }

  const navegacion = (
    <nav className="space-y-5" aria-label="Secciones">
      <label className="relative block">
        <Search
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar sección"
          aria-label="Buscar sección"
          className="w-full rounded-lg border py-1.5 pr-3 pl-8 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-primary)' }}
        />
      </label>

      {/* Con veintitrés secciones, escribir tres letras es más rápido que recorrer la lista. */}
      {filtro ? (
        encontradas.length > 0 ? (
          <div className="space-y-0.5">
            {encontradas.map((i) => (
              <Item key={i.key} item={i} compacto />
            ))}
          </div>
        ) : (
          <p className="px-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            No hay ninguna sección que se llame así.
          </p>
        )
      ) : (
        grupos.map((g) => (
          <div key={g.label}>
            <p
              className="mb-1 px-3 text-[11px] font-semibold tracking-wide uppercase"
              style={{ color: 'var(--text-muted)' }}
            >
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <Item key={i.key} item={i} compacto />
              ))}
            </div>
          </div>
        ))
      )}
    </nav>
  )

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--surface-2)' }}>
      {/* Escritorio: la lateral queda fija y el contenido scrollea solo. */}
      <aside
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r px-3 py-4 lg:flex"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="mb-5 px-2">
          <FincorpLogo height={26} />
        </div>
        {navegacion}
        <div className="mt-auto px-3 pt-5">
          <Link to="/" className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ← Ir al sitio
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
        >
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir el menú de secciones"
            className="rounded-lg border p-1.5 lg:hidden"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <Menu size={18} aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {titulo}
            </h1>
            {contexto && (
              <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {contexto}
              </p>
            )}
          </div>

          {guardado && (
            <span
              className="hidden items-center gap-1 text-xs sm:inline-flex"
              style={{ color: guardado === 'guardado' ? 'var(--status-good-text)' : 'var(--text-muted)' }}
            >
              <Cloud size={12} aria-hidden="true" />
              {guardado === 'guardado' ? 'Guardado' : 'Sincronizando…'}
            </span>
          )}
          {sesion}
          <ThemeToggle />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-10 sm:px-6">{children}</main>
      </div>

      {/* Celular: el menú completo entra desde el costado. */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          />
          <div
            className="absolute inset-y-0 left-0 w-72 overflow-y-auto px-3 py-4"
            style={{ background: 'var(--surface-1)' }}
          >
            <div className="mb-4 flex items-center justify-between px-2">
              <FincorpLogo height={24} />
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar el menú"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {navegacion}
          </div>
        </div>
      )}

    </div>
  )
}
