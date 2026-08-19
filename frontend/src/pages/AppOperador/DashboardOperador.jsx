import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'
import medallonImg from '../../assets/medallon_final.png'

export default function DashboardOperador() {
  const { user, logout, setModoInterfaz, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [cajaEstado, setCajaEstado] = useState({ abierta: false, loading: true })

  useEffect(() => {
    // Verificamos si hay una caja abierta para el operador
    api.aperturaActiva(user?.filial_id || 1)
      .then(data => {
        if (data && data.id) {
          setCajaEstado({ abierta: true, loading: false, data })
        } else {
          setCajaEstado({ abierta: false, loading: false })
        }
      })
      .catch(() => setCajaEstado({ abierta: false, loading: false }))
  }, [user?.filial_id])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#121719',
      color: '#f0f3f4',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '500px',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,0.5)'
    }}>
      {/* Header Móvil */}
      <header style={{
        background: '#1a2225',
        padding: '16px 20px',
        borderBottom: '2px solid #283438',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            overflow: 'hidden', border: '2px solid #4db687', background: '#0d1214'
          }}>
            <img src={medallonImg} alt="Agro Salto" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: '#6ed1a7', letterSpacing: '-0.3px' }}>
              AGRO SALTO
            </div>
            <div style={{ fontSize: '12px', color: '#9ba1a2', fontWeight: '600' }}>
              👤 {user?.nombre || user?.usuario || 'Operador'} ({user?.perfil || 'Cajero'})
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            background: '#2a1a1f',
            color: '#ff6b6b',
            border: '1px solid #5a242c',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          Salir 🚪
        </button>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Banner Estado de Caja */}
        <div style={{
          background: cajaEstado.abierta ? 'rgba(77, 182, 135, 0.12)' : 'rgba(255, 107, 107, 0.12)',
          border: `1px solid ${cajaEstado.abierta ? '#4db687' : '#ff6b6b'}`,
          borderRadius: '14px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{cajaEstado.abierta ? '🟢' : '🔴'}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: cajaEstado.abierta ? '#6ed1a7' : '#ff8787' }}>
                {cajaEstado.abierta ? 'Caja Abierta' : 'Caja Cerrada'}
              </div>
              <div style={{ fontSize: '11px', color: '#9ba1a2' }}>
                {cajaEstado.abierta ? `Monto Inicial: ₲ ${cajaEstado.data?.monto_inicial?.toLocaleString('es-PY') || '0'}` : 'Requiere apertura para cobrar'}
              </div>
            </div>
          </div>
        </div>

        {/* Título Operador */}
        <div style={{ textAlign: 'center', margin: '4px 0 0 0' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>
            Panel Principal
          </h2>
          <p style={{ fontSize: '13px', color: '#9ba1a2', margin: '4px 0 0 0' }}>
            Selecciona una opción para operar
          </p>
        </div>

        {/* GRID DE 4 BOTONES GIGANTES */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          flex: 1
        }}>
          {/* BOTÓN 1: VENTAS */}
          <button
            onClick={() => navigate('/operador/ventas')}
            style={{
              background: 'linear-gradient(145deg, #1b382b, #12281d)',
              border: '2px solid #2e7d58',
              borderRadius: '20px',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(46, 125, 88, 0.25)',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              minHeight: '160px'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#2e7d58',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              🛒
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#73e6b2', letterSpacing: '-0.3px' }}>
                VENTAS
              </div>
              <div style={{ fontSize: '12px', color: '#a2e8c6', marginTop: '2px', fontWeight: '500' }}>
                Cobrar / Facturar
              </div>
            </div>
          </button>

          {/* BOTÓN 2: EGRESOS */}
          <button
            onClick={() => navigate('/operador/egresos')}
            style={{
              background: 'linear-gradient(145deg, #3d1e24, #281216)',
              border: '2px solid #9e3646',
              borderRadius: '20px',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(158, 54, 70, 0.25)',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              minHeight: '160px'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#9e3646',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              💸
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#ff9ebb', letterSpacing: '-0.3px' }}>
                EGRESOS
              </div>
              <div style={{ fontSize: '12px', color: '#ffc2d2', marginTop: '2px', fontWeight: '500' }}>
                Registrar Gasto
              </div>
            </div>
          </button>

          {/* BOTÓN 3: CLIENTES */}
          <button
            onClick={() => navigate('/operador/clientes')}
            style={{
              background: 'linear-gradient(145deg, #1d2b38, #111a24)',
              border: '2px solid #336699',
              borderRadius: '20px',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(51, 102, 153, 0.25)',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              minHeight: '160px'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#336699',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              👥
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#90caf9', letterSpacing: '-0.3px' }}>
                CLIENTES
              </div>
              <div style={{ fontSize: '12px', color: '#bbdefb', marginTop: '2px', fontWeight: '500' }}>
                Buscar / Nuevo
              </div>
            </div>
          </button>

          {/* BOTÓN 4: INVENTARIO */}
          <button
            onClick={() => navigate('/operador/inventario')}
            style={{
              background: 'linear-gradient(145deg, #332b18, #211b0e)',
              border: '2px solid #997a29',
              borderRadius: '20px',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(153, 122, 41, 0.25)',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              minHeight: '160px'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#997a29',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              📦
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#ffe082', letterSpacing: '-0.3px' }}>
                INVENTARIO
              </div>
              <div style={{ fontSize: '12px', color: '#fff1c1', marginTop: '2px', fontWeight: '500' }}>
                Precios y Stock
              </div>
            </div>
          </button>
        </div>

        {/* Footer / Opción de cambio a Modo Completo (Admin) */}
        {isAdmin() && (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button
              onClick={() => {
                setModoInterfaz('COMPLETO')
                navigate('/')
              }}
              style={{
                background: '#1d262a',
                color: '#6ed1a7',
                border: '1px dashed #3a4a50',
                borderRadius: '12px',
                padding: '12px 18px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              🔄 Cambiar a Modo Administrador Completo
            </button>
          </div>
        )}

      </main>

      <footer style={{
        padding: '16px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#656d70',
        borderTop: '1px solid #1a2225'
      }}>
        Agro Salto Mobile v1.0 • Conectado a Vercel
      </footer>
    </div>
  )
}
