import { createContext, useContext, useState, useEffect } from 'react'

function tokenEsValido(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [modoPreferido, setModoPreferidoState] = useState(() => {
    return localStorage.getItem('modo_interfaz') || null
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const saved = localStorage.getItem('user')
    if (token && saved && tokenEsValido(token)) {
      setUser(JSON.parse(saved))
    } else if (token || saved) {
      // Token vencido o inválido → limpiar y pedir re-login
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    setLoading(false)
  }, [])

  const login = async (usuario, password) => {
    const res = await fetch('/_/backend/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error de login')
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('modo_interfaz')
    setUser(null)
    setModoPreferidoState(null)
  }

  const setModoInterfaz = (modo) => {
    localStorage.setItem('modo_interfaz', modo)
    setModoPreferidoState(modo)
  }

  const isAdmin = () => user?.perfil === 'ADMIN'
  const canManageStock = () => ['ADMIN', 'DEPOSITO'].includes(user?.perfil)
  const canSell = () => ['ADMIN', 'CAJERO_1', 'CAJERO_2', 'OPERADOR'].includes(user?.perfil)

  // Determina si se debe mostrar el modo simplificado (4 botones)
  const isSimpleMode = () => {
    if (modoPreferido === 'SIMPLE') return true
    if (modoPreferido === 'COMPLETO') return false
    // Por defecto, perfiles de caja/operador usan modo simple
    return ['CAJERO_1', 'CAJERO_2', 'CAJERO', 'OPERADOR'].includes(user?.perfil)
  }

  const getHomePath = () => {
    return isSimpleMode() ? '/operador' : '/'
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      isAdmin,
      canManageStock,
      canSell,
      modoPreferido,
      setModoInterfaz,
      isSimpleMode,
      getHomePath
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
