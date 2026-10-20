import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { PrestamosPage } from './pages/PrestamosPage'
import { AccesoEmpresas } from './pages/AccesoEmpresas'
import { AdminPlanPage } from './pages/AdminPlanPage'
import { AuthProvider } from './lib/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="prestamos" element={<PrestamosPage />} />
            <Route path="empresas" element={<AccesoEmpresas />} />
            <Route path="admin-plan" element={<AdminPlanPage />} />
          </Route>
        </Routes>
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
