import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { AuthProvider } from './lib/AuthContext'

// La home se importa directo porque es la primera que se ve: cargarla en diferido agregaría una
// ida y vuelta justo en la pantalla que define la primera impresión.
//
// El resto va en diferido, y eso es lo que parte el JavaScript en archivos separados. Antes era
// uno solo de 1,7 MB: quien entraba a la home a mirar los precios se bajaba también las veintitrés
// pantallas del sistema de gestión, los gráficos, el generador de PDF, el de Excel y Firebase, sin
// usar nada de eso. Ahora cada ruta se baja lo suyo cuando se entra.
const PrestamosPage = lazy(() => import('./pages/PrestamosPage').then((m) => ({ default: m.PrestamosPage })))
const AccesoEmpresas = lazy(() => import('./pages/AccesoEmpresas').then((m) => ({ default: m.AccesoEmpresas })))
const AdminPlanPage = lazy(() => import('./pages/AdminPlanPage').then((m) => ({ default: m.AdminPlanPage })))

/** Lo que se ve mientras baja el código de una ruta. Es el mismo "Cargando…" que ya usan las
 * pantallas de adentro al esperar datos, para que la espera se vea igual venga de donde venga. */
function Cargando() {
  return (
    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
      Cargando…
    </p>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="prestamos" element={<PrestamosPage />} />
              <Route path="empresas" element={<AccesoEmpresas />} />
              <Route path="admin-plan" element={<AdminPlanPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      {/* Visitas por página. No lleva variable de entorno ni configuración: el script lo sirve
          el propio dominio, desde /_vercel/insights, y no usa cookies ni identifica a la
          persona, así que tampoco agrega obligaciones de consentimiento.
          Solo en el build de producción: en desarrollo esa ruta no existe y el pedido termina
          en un 404 que ensucia la consola cada vez que se recarga, escondiendo los errores que
          sí importan. No se pierde nada, porque las visitas que interesan son las de verdad. */}
      {import.meta.env.PROD && <Analytics />}
    </AuthProvider>
  )
}

export default App
