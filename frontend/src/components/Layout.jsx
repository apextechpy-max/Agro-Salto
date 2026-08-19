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
    api.alertasVto().then(d => setAlertas(d.length)).catch(() => {})
  }, [])

  // Cerrar sidebar al cambiar de ruta en móviles
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }

  const filteredNav = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(user?.perfil)
  )

  return (
    <div className="app-layout">
      {/* Backdrop para cerrar sidebar en móvil */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logoImg} alt="Logo" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'contain' }} />
            <div>
              <div className="logo-name" style={{ fontSize: 18, fontWeight: 800 }}>Agrosaltos</div>
              <div className="logo-sub" style={{ fontSize: 10, opacity: 0.7 }}>Consultorio Veterinario</div>
            </div>
          </div>
          <button 
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            title="Cerrar menú"
          >
            ✕
          </button>
        </div>

        {/* Botón rápido a Modo Móvil Simplificado */}
        <div style={{ padding: '0 12px 10px 12px' }}>
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
              {item.label}
              {item.label === 'Stock' && alertas > 0 && (
                <span className="nav-badge">{alertas}</span>
              )}
            </NavLink>
          ))}
          <div className="nav-section-title" style={{ marginTop: 16 }}>🐾 Veterinaria</div>
          {VET_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">
              {user?.nombre_completo?.[0]?.toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.nombre_completo?.split(' ')[0]}</div>
              <div className="user-role">{user?.perfil}</div>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">⏻</button>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <div className="header-title">Agrosaltos</div>
          </div>
          <div className="header-actions">
            {alertas > 0 && (
              <div className="alert-badge" onClick={() => navigate('/stock')}>
                ⚠️ {alertas} vencimiento{alertas > 1 ? 's' : ''}
              </div>
            )}
            <span className="header-date" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('es-PY', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
