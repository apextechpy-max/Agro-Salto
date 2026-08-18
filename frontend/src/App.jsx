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

// App Operador Móvil (Simplificada)
import DashboardOperador from './pages/AppOperador/DashboardOperador'
import VentasOperador from './pages/AppOperador/VentasOperador'
import EgresosOperador from './pages/AppOperador/EgresosOperador'
import ClientesOperador from './pages/AppOperador/ClientesOperador'
import InventarioOperador from './pages/AppOperador/InventarioOperador'

// Roles sin acceso a ciertas rutas completas
const CAJERO_ROLES = ['CAJERO_1', 'CAJERO_2', 'CAJERO', 'OPERADOR']

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  return user ? children : <Navigate to="/login" replace />
}

// Ruta protegida por rol: si el usuario tiene uno de los roles bloqueados, redirige al fallback
function RoleRoute({ children, blockedRoles = [], fallback = '/operador' }) {
  const { user, isSimpleMode } = useAuth()
  if (isSimpleMode() || blockedRoles.includes(user?.perfil)) return <Navigate to={fallback} replace />
  return children
}

function SmartIndexRoute() {
  const { isSimpleMode } = useAuth()
  if (isSimpleMode()) {
    return <Navigate to="/operador" replace />
  }
  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Rutas App Operador (Pantalla Completa Móvil sin sidebar) */}
          <Route path="/operador" element={<PrivateRoute><DashboardOperador /></PrivateRoute>} />
          <Route path="/operador/ventas" element={<PrivateRoute><VentasOperador /></PrivateRoute>} />
          <Route path="/operador/egresos" element={<PrivateRoute><EgresosOperador /></PrivateRoute>} />
          <Route path="/operador/clientes" element={<PrivateRoute><ClientesOperador /></PrivateRoute>} />
          <Route path="/operador/inventario" element={<PrivateRoute><InventarioOperador /></PrivateRoute>} />

          {/* Rutas Sistema Completo (Layout con Menú Lateral) */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={
              <RoleRoute blockedRoles={CAJERO_ROLES} fallback="/operador">
                <SmartIndexRoute />
              </RoleRoute>
            } />
            <Route path="ventas" element={<Ventas />} />
            <Route path="compras" element={<Compras />} />
            <Route path="stock" element={
              <RoleRoute blockedRoles={CAJERO_ROLES} fallback="/operador">
                <Stock />
              </RoleRoute>
            } />
            <Route path="caja" element={<Caja />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="productos" element={
              <RoleRoute blockedRoles={CAJERO_ROLES} fallback="/operador">
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
