import { FlujoDeCaja } from '../components/FlujoDeCaja'

export function EmpresasPage() {
  return (
    <>
      <div className="mb-8">
        <p className="mt-1 text-sm font-semibold tracking-wide" style={{ color: 'var(--series-blue)' }}>
          🧮 Finko para empresas
        </p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--text-primary)' }}>
          Gestioná las finanzas de tu negocio, sin ser financista
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Herramientas simples para tomar decisiones financieras del día a día — empezá cargando tu flujo de
          caja estimado.
        </p>
      </div>

      <FlujoDeCaja />
    </>
  )
}
