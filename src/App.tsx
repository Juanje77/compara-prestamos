import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { PrestamosPage } from './pages/PrestamosPage'
import { EmpresasPage } from './pages/EmpresasPage'
import { AuthProvider } from './lib/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="prestamos" element={<PrestamosPage />} />
            <Route path="empresas" element={<EmpresasPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
