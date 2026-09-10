import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PrestamosPage } from './pages/PrestamosPage'
import { EmpresasPage } from './pages/EmpresasPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PrestamosPage />} />
          <Route path="empresas" element={<EmpresasPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
