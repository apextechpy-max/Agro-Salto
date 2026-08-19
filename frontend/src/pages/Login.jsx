import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/logo.jpg'
import medallonImg from '../assets/medallon_final.png'

export default function Login() {
  const [form, setForm] = useState({ usuario: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const u = await login(form.usuario, form.password)
      const isOperador = ['CAJERO_1', 'CAJERO_2', 'CAJERO', 'OPERADOR'].includes(u?.perfil)
      if (isOperador) {
        navigate('/operador')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#1a2022',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo Section */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ 
            width: 150, height: 150, borderRadius: '50%', 
            margin: '0 auto 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <img 
              src={medallonImg} 
              alt="Agrosaltos" 
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.parentElement) {
                  e.target.parentElement.innerHTML = '<span style="font-size: 64px;">🌿</span>';
                }
              }}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
              }} 
            />
          </div>
          <h1 style={{ 
            fontSize: 42, fontWeight: 900, color: '#6ed1a7', 
            marginBottom: 5, letterSpacing: '-1px' 
          }}>
            Agrosaltos
          </h1>
          <p style={{ color: '#9ba1a2', fontSize: 16, fontWeight: 500 }}>
            Consultorio Veterinario
          </p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ 
          padding: 40, 
          background: '#151b1d', 
          border: '2px solid #6ed1a7', 
          borderRadius: 20,
          boxShadow: '0 0 30px rgba(110, 209, 167, 0.15)'
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 35, textAlign: 'center', color: '#f0f3f4' }}>
            Iniciar Sesión
          </h2>

          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 25 }}>
              <label style={{ color: '#9ba1a2', fontSize: 14, marginBottom: 10, display: 'block' }}>Usuario</label>
              <input
                id="usuario" type="text" placeholder="Tu usuario"
                style={{ 
                  background: '#0d1214', border: '1px solid #232c30', 
                  color: '#fff', borderRadius: 8, padding: '12px 15px' 
                }}
                value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))}
                autoComplete="username" autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 35 }}>
              <label style={{ color: '#9ba1a2', fontSize: 14, marginBottom: 10, display: 'block' }}>Contraseña</label>
              <input
                id="password" type="password" placeholder="••••••••"
                style={{ 
                  background: '#0d1214', border: '1px solid #232c30', 
                  color: '#fff', borderRadius: 8, padding: '12px 15px' 
                }}
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn" style={{ 
              width: '100%', background: '#4db687', color: '#fff', 
              fontWeight: 700, borderRadius: 8, padding: '14px', fontSize: 16,
              border: 'none', cursor: 'pointer', transition: 'all 0.3s ease'
            }} disabled={loading}>
              {loading ? 'Ingresando...' : '→ Ingresar al Sistema'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 30, color: '#656d70', fontSize: 13, fontWeight: 500 }}>
          Acceso restringido — Agro Salto © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
