import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

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
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modoPreferido, setModoPreferidoState] = useState(() => {
    return localStorage.getItem('modo_interfaz') || null
  })

  useEffect(() => {
    // Usamos sessionStorage para que al cerrar el aplicativo se borre la sesión y pida login de nuevo
    const token = sessionStorage.getItem('token')
    const saved = sessionStorage.getItem('user')
    if (token && saved && tokenEsValido(token)) {
      setUser(JSON.parse(saved))
    } else {
      // Limpiar datos obsoletos de sesión
      sessionStorage.clear()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    setLoading(false)
  }, [])

  const login = async (usuario, password) => {
    const data = await api.login(usuario, password)
    // Guardar en sessionStorage (se destruye al cerrar la app)
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))
    // Limpiar localStorage por seguridad
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    sessionStorage.clear()
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
