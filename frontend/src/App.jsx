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

// Roles sin acceso a ciertas rutas
const CAJERO_ROLES = ['CAJERO_1', 'CAJERO_2', 'CAJERO']

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  return user ? children : <Navigate to="/login" replace />
}

// Ruta protegida por rol: si el usuario tiene uno de los roles bloqueados, redirige al fallback
function RoleRoute({ children, blockedRoles = [], fallback = '/ventas' }) {
  const { user } = useAuth()
  if (blockedRoles.includes(user?.perfil)) return <Navigate to={fallback} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={
              <RoleRoute blockedRoles={CAJERO_ROLES} fallback="/ventas">
                <Dashboard />
              </RoleRoute>
            } />
            <Route path="ventas" element={<Ventas />} />
            <Route path="compras" element={<Compras />} />
            <Route path="stock" element={
              <RoleRoute blockedRoles={CAJERO_ROLES} fallback="/ventas">
                <Stock />
              </RoleRoute>
            } />
            <Route path="caja" element={<Caja />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="productos" element={
              <RoleRoute blockedRoles={CAJERO_ROLES} fallback="/ventas">
                <Productos />
              </RoleRoute>
            } />
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
