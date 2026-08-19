import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import api from '../api'
import logoImg from '../assets/medallon_final.png'

const NAV_ITEMS = [
  { to: '/', icon: '📊', label: 'Dashboard', exact: true, roles: ['ADMIN', 'DEPOSITO'] },
  { to: '/ventas', icon: '🛒', label: 'Ventas' },
  { to: '/compras', icon: '📥', label: 'Compras', roles: ['ADMIN', 'DEPOSITO'] },
  { to: '/stock', icon: '📦', label: 'Stock', roles: ['ADMIN', 'DEPOSITO'] },
  { to: '/caja', icon: '💰', label: 'Caja' },
  { to: '/clientes', icon: '👥', label: 'Clientes / Prov.' },
  { to: '/productos', icon: '🌿', label: 'Productos', roles: ['ADMIN', 'DEPOSITO'] },
  { to: '/reportes', icon: '📈', label: 'Reportes', roles: ['ADMIN'] },
  { to: '/usuarios', icon: '🔐', label: 'Usuarios', roles: ['ADMIN'] },
]

const VET_ITEMS = [
  { to: '/veterinaria/mascotas', icon: '🐾', label: 'CRM Mascotas' },
  { to: '/veterinaria/agenda', icon: '📅', label: 'Agenda' },
  { to: '/veterinaria/clinica', icon: '🏥', label: 'Clínica' },
]

export default function Layout() {
  const { user, logout, isAdmin, setModoInterfaz } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [alertas, setAlertas] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    api.alertasVto().then(d => setAlertas(d?.length || 0)).catch(() => {})
  }, [])

  // Cerrar sidebar al cambiar de ruta en móviles
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userRole = (user?.perfil || '').toUpperCase()
  const filteredNav = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.map(r => r.toUpperCase()).includes(userRole)
  )

  return (
    <div className="app-layout">
      {/* Backdrop para cerrar sidebar en móvil */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop active"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Menú Lateral / Drawer Móvil */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logoImg} alt="Logo" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'contain' }} />
            <div>
              <div className="logo-name" style={{ fontSize: 17, fontWeight: 800 }}>Agro Salto</div>
              <div className="logo-sub" style={{ fontSize: 10, opacity: 0.7 }}>Consultorio & ERP</div>
            </div>
          </div>
          <button 
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            title="Cerrar menú"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Botón rápido a Modo Móvil Simplificado */}
        <div style={{ padding: '4px 12px 10px 12px' }}>
          <button
            onClick={() => {
              setModoInterfaz('SIMPLE')
              navigate('/operador')
            }}
            style={{
              width: '100%',
              background: 'rgba(77, 182, 135, 0.15)',
              color: '#6ed1a7',
              border: '1px solid #4db687',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            📱 Modo App Simplificado
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Menú Principal</div>
          {filteredNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
              {item.label === 'Stock' && alertas > 0 && (
                <span className="nav-badge">{alertas}</span>
              )}
            </NavLink>
          ))}

          <div className="nav-section-title" style={{ marginTop: 14 }}>🐾 Veterinaria</div>
          {VET_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">
              {user?.nombre_completo?.[0]?.toUpperCase() || user?.usuario?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.nombre_completo || user?.usuario || 'Usuario'}
              </div>
              <div className="user-role">{user?.perfil || 'Operador'}</div>
            </div>
            <button 
              className="btn-logout" 
              onClick={handleLogout} 
              title="Cerrar sesión"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ff6b6b',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ⏻ Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
              title="Abrir menú de navegación"
            >
              ☰
            </button>
            <div className="header-title">Agro Salto</div>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {alertas > 0 && (
              <div className="alert-badge" onClick={() => navigate('/stock')} style={{ cursor: 'pointer' }}>
                ⚠️ {alertas}
              </div>
            )}

            {/* Botón directo de Logout en la cabecera */}
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ff8585',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Cerrar sesión"
            >
              <span>⏻</span>
              <span className="hide-on-very-small">Salir</span>
            </button>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>

        {/* Barra de Navegación Inferior en Móviles (Bottom Nav) */}
        <nav className="mobile-bottom-nav">
          <NavLink to="/ventas" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bottom-nav-icon">🛒</span>
            <span className="bottom-nav-label">Ventas</span>
          </NavLink>
          <NavLink to="/caja" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bottom-nav-icon">💰</span>
            <span className="bottom-nav-label">Caja</span>
          </NavLink>
          <NavLink to="/clientes" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bottom-nav-icon">👥</span>
            <span className="bottom-nav-label">Clientes</span>
          </NavLink>
          <NavLink to="/veterinaria/mascotas" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bottom-nav-icon">🐾</span>
            <span className="bottom-nav-label">Mascotas</span>
          </NavLink>
          <button 
            type="button" 
            className="bottom-nav-item"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="bottom-nav-icon">☰</span>
            <span className="bottom-nav-label">Más</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
