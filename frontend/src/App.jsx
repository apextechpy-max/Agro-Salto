import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Ventas from './pages/Ventas'
import Compras from './pages/Compras'
import Stock from './pages/Stock'
import Caja from './pages/Caja'
import Clientes from './pages/Clientes'
import Productos from './pages/Productos'
import Usuarios from './pages/Usuarios'
import Reportes from './pages/Reportes'
// Módulo Veterinario
import CRMMascotas from './pages/Veterinaria/CRMMascotas'
import AgendaInteligente from './pages/Veterinaria/AgendaInteligente'
import ClinicaPanel from './pages/Veterinaria/ClinicaPanel'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="compras" element={<Compras />} />
            <Route path="stock" element={<Stock />} />
            <Route path="caja" element={<Caja />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="productos" element={<Productos />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="reportes" element={<Reportes />} />
            {/* Módulo Veterinario */}
            <Route path="veterinaria/mascotas" element={<CRMMascotas />} />
            <Route path="veterinaria/agenda" element={<AgendaInteligente />} />
            <Route path="veterinaria/clinica" element={<ClinicaPanel />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
