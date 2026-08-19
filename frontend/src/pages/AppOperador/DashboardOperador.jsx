import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'
import medallonImg from '../../assets/medallon_final.png'

export default function DashboardOperador() {
  const { user, logout, setModoInterfaz, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [cajaEstado, setCajaEstado] = useState({ abierta: false, loading: true })
  
  // Modal de Apertura Obligatoria
  const [mostrarModalApertura, setMostrarModalApertura] = useState(false)
  const [cajasDisponibles, setCajasDisponibles] = useState([])
  const [cajaSeleccionada, setCajaSeleccionada] = useState('')
  const [montoInicial, setMontoInicial] = useState('0')
  const [cambioUsd, setCambioUsd] = useState('7800')
  const [cambioBrl, setCambioBrl] = useState('1450')
  const [cambioArs, setCambioArs] = useState('8')
  const [abriendoCaja, setAbriendoCaja] = useState(false)
  const [errorApertura, setErrorApertura] = useState('')
  const [rutaDestinoPendiente, setRutaDestinoPendiente] = useState(null)

  const verificarCaja = async () => {
    try {
      const filialId = user?.filial_id || 1
      const cajas = await api.cajas(filialId)
      const listCajas = Array.isArray(cajas) ? cajas : []
      setCajasDisponibles(listCajas)
      if (listCajas.length > 0) {
        setCajaSeleccionada(listCajas[0].id)
      }

      // Verificamos si alguna caja de la filial está abierta
      let aperturaEncontrada = null
      for (const c of listCajas) {
        try {
          const ap = await api.aperturaActiva(c.id)
          if (ap && ap.id) {
            aperturaEncontrada = ap
            break
          }
        } catch {
          // continuar
        }
      }

      if (aperturaEncontrada) {
        setCajaEstado({ abierta: true, loading: false, data: aperturaEncontrada })
      } else {
        setCajaEstado({ abierta: false, loading: false })
      }
    } catch {
      setCajaEstado({ abierta: false, loading: false })
    }
  }

  useEffect(() => {
    verificarCaja()
  }, [user?.filial_id])

  const manejarNavegacion = (ruta) => {
    if (!cajaEstado.abierta) {
      setRutaDestinoPendiente(ruta)
      setMostrarModalApertura(true)
      return
    }
    navigate(ruta)
  }

  // Modal de Cierre de Caja
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false)
  const [montoCierreEfectivo, setMontoCierreEfectivo] = useState('')
  const [cerrandoCaja, setCerrandoCaja] = useState(false)
  const [errorCierre, setErrorCierre] = useState('')

  const handleConfirmarCierre = async (e) => {
    e.preventDefault()
    if (!cajaEstado.data?.id) return
    const montoNum = Number(String(montoCierreEfectivo).replace(/\D/g, '')) || 0
    setCerrandoCaja(true)
    setErrorCierre('')

    try {
      await api.cerrarCaja({
        apertura_id: cajaEstado.data.id,
        monto_declarado: montoNum
      })

      await verificarCaja()
      setMostrarModalCierre(false)
      setMontoCierreEfectivo('')
    } catch (err) {
      setErrorCierre(err.message || 'Error al cerrar la caja')
    } finally {
      setCerrandoCaja(false)
    }
  }

  const sumarMontoRapido = (valor) => {
    const act = Number(montoInicial.replace(/\D/g, '')) || 0
    const nuevo = act + valor
    setMontoInicial(nuevo.toLocaleString('es-PY'))
  }

  const handleConfirmarApertura = async (e) => {
    e.preventDefault()
    const montoNum = Number(String(montoInicial).replace(/\D/g, '')) || 0
    if (!cajaSeleccionada) {
      setErrorApertura('Selecciona una caja para abrir')
      return
    }

    setAbriendoCaja(true)
    setErrorApertura('')

    try {
      await api.abrirCaja({
        caja_id: cajaSeleccionada,
        monto_inicial: montoNum,
        cambio_usd: Number(cambioUsd) || 0,
        cambio_brl: Number(cambioBrl) || 0,
        cambio_ars: Number(cambioArs) || 0
      })

      // Actualizar estado de caja
      await verificarCaja()
      setMostrarModalApertura(false)

      // Si el usuario quería ir a una ruta en específico, navega automáticamente
      if (rutaDestinoPendiente) {
        const dest = rutaDestinoPendiente
        setRutaDestinoPendiente(null)
        navigate(dest)
      }
    } catch (err) {
      setErrorApertura(err.message || 'Error al abrir la caja')
    } finally {
      setAbriendoCaja(false)
    }
  }

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
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            flexShrink: 0
          }}>
            🌿
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: '#6ed1a7', letterSpacing: '-0.3px' }}>
              AGRO SALTO
            </div>
            <div style={{ fontSize: '12px', color: '#9ba1a2', fontWeight: '600' }}>
              👤 {user?.nombre_completo || user?.usuario || 'Operador'} ({user?.perfil || 'Cajero'})
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
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
        <div 
          onClick={() => {
            if (!cajaEstado.abierta) {
              setMostrarModalApertura(true)
            } else {
              setMontoCierreEfectivo('')
              setErrorCierre('')
              setMostrarModalCierre(true)
            }
          }}
          style={{
            background: cajaEstado.abierta ? 'rgba(77, 182, 135, 0.12)' : 'rgba(255, 107, 107, 0.16)',
            border: `1px solid ${cajaEstado.abierta ? '#4db687' : '#ff6b6b'}`,
            borderRadius: '14px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{cajaEstado.abierta ? '🟢' : '🔴'}</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: cajaEstado.abierta ? '#6ed1a7' : '#ff8787' }}>
                {cajaEstado.abierta ? `Caja Abierta (${cajaEstado.data?.caja_nombre || 'Caja Principal'})` : 'Caja Cerrada - ¡Toca para Abrir!'}
              </div>
              <div style={{ fontSize: '12px', color: '#9ba1a2', marginTop: '2px' }}>
                {cajaEstado.abierta 
                  ? `Monto Inicial: ₲ ${Number(cajaEstado.data?.monto_inicial || 0).toLocaleString('es-PY')} • Toca para Cerrar Caja` 
                  : '⚠️ Es obligatorio abrir caja antes de realizar operaciones'}
              </div>
            </div>
          </div>
          {cajaEstado.abierta ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMontoCierreEfectivo('')
                setErrorCierre('')
                setMostrarModalCierre(true)
              }}
              style={{
                background: '#3d1e24',
                color: '#ff9ebb',
                border: '1px solid #9e3646',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              🔒 Cerrar
            </button>
          ) : (
            <span style={{ fontSize: '18px', color: '#ff8787' }}>➔</span>
          )}
        </div>

        {/* Título Operador */}
        <div style={{ textAlign: 'center', margin: '2px 0 0 0' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>
            Panel Principal
          </h2>
          <p style={{ fontSize: '13px', color: '#9ba1a2', margin: '4px 0 0 0' }}>
            {!cajaEstado.abierta ? '🔒 Abre la caja para habilitar las funciones' : 'Selecciona una opción para operar'}
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
            onClick={() => manejarNavegacion('/operador/ventas')}
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
            onClick={() => manejarNavegacion('/operador/egresos')}
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

          {/* BOTÓN 3: CLIENTES Y PROVEEDORES */}
          <button
            onClick={() => manejarNavegacion('/operador/clientes')}
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
              <div style={{ fontSize: '17px', fontWeight: '900', color: '#90caf9', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
                CLIENTES Y PROVEEDORES
              </div>
              <div style={{ fontSize: '12px', color: '#bbdefb', marginTop: '4px', fontWeight: '500' }}>
                Buscar / Directorio
              </div>
            </div>
          </button>

          {/* BOTÓN 4: INVENTARIO */}
          <button
            onClick={() => manejarNavegacion('/operador/inventario')}
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

        {/* Botón para forzar actualización de la app */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button
            onClick={() => {
              if ('caches' in window) {
                caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).finally(() => {
                  window.location.href = window.location.origin + '/operador?v=' + Date.now()
                })
              } else {
                window.location.href = window.location.origin + '/operador?v=' + Date.now()
              }
            }}
            style={{
              background: '#151b1d',
              color: '#9ba1a2',
              border: '1px solid #283438',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🔄 Sincronizar / Recargar Versión
          </button>
        </div>

      </main>

      <footer style={{
        padding: '14px',
        textAlign: 'center',
        fontSize: '11px',
        color: '#656d70',
        borderTop: '1px solid #1a2225'
      }}>
        Agro Salto Mobile v1.0.4 • En línea con Vercel & Supabase
      </footer>

      {/* MODAL INTERACTIVO DE APERTURA OBLIGATORIA DE CAJA */}
      {mostrarModalApertura && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#161f18',
            borderTop: '3px solid #4db687',
            borderRadius: '24px 24px 0 0',
            width: '100%',
            maxWidth: '500px',
            padding: '24px 20px',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '28px' }}>🔓</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#6ed1a7' }}>
                    Apertura de Caja
                  </h3>
                  <div style={{ fontSize: '12px', color: '#9ba1a2' }}>
                    Requerida para registrar ventas y movimientos
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setMostrarModalApertura(false)}
                style={{
                  background: '#202b23',
                  border: '1px solid #2d4030',
                  color: '#9ba1a2',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {errorApertura && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#ff9999',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '16px',
                fontWeight: '600'
              }}>
                ⚠️ {errorApertura}
              </div>
            )}

            <form onSubmit={handleConfirmarApertura} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Selección de Caja */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                  Caja a Abrir
                </label>
                <select
                  value={cajaSeleccionada}
                  onChange={(e) => setCajaSeleccionada(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0e1610',
                    border: '1px solid #2d4030',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    color: '#f0fdf4',
                    fontSize: '15px',
                    fontWeight: '600'
                  }}
                >
                  {cajasDisponibles.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} - {c.filial_nombre || 'Filial Principal'}
                    </option>
                  ))}
                  {cajasDisponibles.length === 0 && (
                    <option value="1">Caja Principal 01</option>
                  )}
                </select>
              </div>

              {/* Monto Inicial en Guaraníes */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                  Monto Inicial en Efectivo (₲)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={montoInicial}
                  onChange={(e) => {
                    const num = Number(e.target.value.replace(/\D/g, '')) || 0
                    setMontoInicial(num.toLocaleString('es-PY'))
                  }}
                  placeholder="0"
                  style={{
                    width: '100%',
                    background: '#0e1610',
                    border: '2px solid #4db687',
                    borderRadius: '12px',
                    padding: '14px',
                    color: '#73e6b2',
                    fontSize: '22px',
                    fontWeight: '900',
                    textAlign: 'right'
                  }}
                />

                {/* Botones de suma rápida */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '8px' }}>
                  {[50000, 100000, 200000, 500000, 1000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => sumarMontoRapido(val)}
                      style={{
                        background: '#1f2e22',
                        border: '1px solid #2d4030',
                        color: '#6ed1a7',
                        borderRadius: '8px',
                        padding: '8px 2px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      +{(val / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Cotizaciones Opcionales */}
              <div style={{
                background: '#0d140f',
                border: '1px solid #1f2d22',
                borderRadius: '12px',
                padding: '12px 14px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#9ba1a2', marginBottom: '8px' }}>
                  💱 Cotizaciones del Día (Opcional)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#90caf9' }}>USD (₲)</label>
                    <input
                      type="number"
                      value={cambioUsd}
                      onChange={(e) => setCambioUsd(e.target.value)}
                      style={{ width: '100%', background: '#161f18', border: '1px solid #2d4030', borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '13px', fontWeight: '700' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#a7f3d0' }}>BRL (₲)</label>
                    <input
                      type="number"
                      value={cambioBrl}
                      onChange={(e) => setCambioBrl(e.target.value)}
                      style={{ width: '100%', background: '#161f18', border: '1px solid #2d4030', borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '13px', fontWeight: '700' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#fde68a' }}>ARS (₲)</label>
                    <input
                      type="number"
                      value={cambioArs}
                      onChange={(e) => setCambioArs(e.target.value)}
                      style={{ width: '100%', background: '#161f18', border: '1px solid #2d4030', borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '13px', fontWeight: '700' }}
                    />
                  </div>
                </div>
              </div>

              {/* Botón de Confirmación */}
              <button
                type="submit"
                disabled={abriendoCaja}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                {abriendoCaja ? 'Abriendo Caja...' : '🔓 Confirmar Apertura e Iniciar Turno'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CIERRE DE CAJA */}
      {mostrarModalCierre && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#1a1f22',
            border: '2px solid #9e3646',
            borderRadius: '24px',
            padding: '24px',
            width: '100%',
            maxWidth: '440px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🔒</span>
                <div>
                  <h3 style={{ margin: 0, color: '#ff9ebb', fontSize: '18px', fontWeight: '800' }}>
                    Cerrar Turno de Caja
                  </h3>
                  <div style={{ fontSize: '12px', color: '#9ba1a2' }}>
                    {cajaEstado.data?.caja_nombre || 'Caja Principal'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMostrarModalCierre(false)}
                style={{ background: '#283438', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {errorCierre && (
              <div style={{
                background: 'rgba(255, 107, 107, 0.15)',
                border: '1px solid #ff6b6b',
                color: '#ff8787',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '16px',
                textAlign: 'center',
                fontWeight: '600'
              }}>
                ⚠️ {errorCierre}
              </div>
            )}

            <div style={{
              background: '#121719',
              borderRadius: '14px',
              padding: '14px',
              marginBottom: '16px',
              border: '1px solid #283438',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', color: '#9ba1a2' }}>Monto de Apertura:</span>
              <strong style={{ fontSize: '15px', color: '#73e6b2' }}>
                ₲ {Number(cajaEstado.data?.monto_inicial || 0).toLocaleString('es-PY')}
              </strong>
            </div>

            <form onSubmit={handleConfirmarCierre} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#ffc2d2', marginBottom: '8px' }}>
                  💵 Efectivo Real en Caja al Cierre (₲) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={montoCierreEfectivo}
                  onChange={(e) => {
                    const num = Number(e.target.value.replace(/\D/g, '')) || 0
                    setMontoCierreEfectivo(num ? num.toLocaleString('es-PY') : '')
                  }}
                  placeholder="0"
                  style={{
                    width: '100%',
                    background: '#0d1214',
                    border: '2px solid #9e3646',
                    borderRadius: '12px',
                    padding: '14px',
                    color: '#ff9ebb',
                    fontSize: '22px',
                    fontWeight: '900',
                    textAlign: 'right',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <div style={{ fontSize: '11px', color: '#9ba1a2', marginTop: '6px' }}>
                  Cuenta todo el dinero físico en billetes y monedas que tienes en la caja.
                </div>
              </div>

              <button
                type="submit"
                disabled={cerrandoCaja}
                style={{
                  background: 'linear-gradient(135deg, #9e3646, #c92a2a)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(158, 54, 70, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px'
                }}
              >
                {cerrandoCaja ? 'Cerrando Caja...' : '🔒 Confirmar y Cerrar Caja'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

