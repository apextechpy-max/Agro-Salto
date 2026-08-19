import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export default function ClientesOperador() {
  const navigate = useNavigate()

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS') // 'TODOS' | 'CLIENTE' | 'PROVEEDOR'
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(false)
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false)

  // Formulario Nuevo Cliente / Proveedor
  const [nuevo, setNuevo] = useState({
    nombre: '',
    documento: '',
    telefono: '',
    direccion: '',
    tipo_persona: 'CLIENTE'
  })
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  useEffect(() => {
    fetchPersonas('')
  }, [])

  const fetchPersonas = async (q) => {
    setLoading(true)
    try {
      const data = await api.personas(q ? `?q=${encodeURIComponent(q)}` : '')
      const list = Array.isArray(data) ? data : (data.personas || [])
      setPersonas(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = (e) => {
    const txt = e.target.value
    setBusqueda(txt)
    fetchPersonas(txt)
  }

  const handleCrearPersona = async (e) => {
    e.preventDefault()
    if (!nuevo.nombre.trim()) {
      setErrorModal('Ingresa el nombre o razón social')
      return
    }
    setGuardando(true)
    setErrorModal('')

    try {
      await api.createPersona({
        ...nuevo,
        razon_social: nuevo.nombre.trim().toUpperCase(),
        nombre: nuevo.nombre.trim().toUpperCase(),
        ruc: nuevo.documento.trim(),
        tipo_persona: nuevo.tipo_persona
      })
      setMostrarModalNuevo(false)
      setNuevo({ nombre: '', documento: '', telefono: '', direccion: '', tipo_persona: 'CLIENTE' })
      fetchPersonas(busqueda)
    } catch (err) {
      setErrorModal(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // Filtrado local por pestaña
  const personasFiltradas = personas.filter(p => {
    const tipo = (p.tipo_persona || p.tipo || 'CLIENTE').toUpperCase()
    if (filtroTipo === 'CLIENTE') return tipo === 'CLIENTE'
    if (filtroTipo === 'PROVEEDOR') return tipo === 'PROVEEDOR'
    return true
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: '#121719',
      color: '#f0f3f4',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '500px',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,0.5)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: '#1a2225',
        padding: '14px 18px',
        borderBottom: '2px solid #283438',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={() => navigate('/operador')}
          style={{
            background: '#242f33',
            color: '#90caf9',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 14px',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Volver
        </button>
        <div style={{ fontWeight: '900', fontSize: '16px', color: '#90caf9' }}>
          👥 CLIENTES Y PROVEEDORES
        </div>
        <button
          onClick={() => {
            setErrorModal('')
            setMostrarModalNuevo(true)
          }}
          style={{
            background: 'linear-gradient(135deg, #336699, #4a90e2)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 12px',
            fontWeight: '800',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          + Nuevo
        </button>
      </header>

      {/* Main Area */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Pestañas de filtro */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          <button
            onClick={() => setFiltroTipo('TODOS')}
            style={{
              padding: '10px 6px',
              borderRadius: '10px',
              border: filtroTipo === 'TODOS' ? '2px solid #90caf9' : '1px solid #283438',
              background: filtroTipo === 'TODOS' ? '#1d2b38' : '#1a2225',
              color: filtroTipo === 'TODOS' ? '#90caf9' : '#9ba1a2',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Todos ({personas.length})
          </button>
          <button
            onClick={() => setFiltroTipo('CLIENTE')}
            style={{
              padding: '10px 6px',
              borderRadius: '10px',
              border: filtroTipo === 'CLIENTE' ? '2px solid #336699' : '1px solid #283438',
              background: filtroTipo === 'CLIENTE' ? '#1b2d3d' : '#1a2225',
              color: filtroTipo === 'CLIENTE' ? '#bbdefb' : '#9ba1a2',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            👤 Clientes
          </button>
          <button
            onClick={() => setFiltroTipo('PROVEEDOR')}
            style={{
              padding: '10px 6px',
              borderRadius: '10px',
              border: filtroTipo === 'PROVEEDOR' ? '2px solid #d4af37' : '1px solid #283438',
              background: filtroTipo === 'PROVEEDOR' ? '#332b18' : '#1a2225',
              color: filtroTipo === 'PROVEEDOR' ? '#ffe082' : '#9ba1a2',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🚚 Proveedores
          </button>
        </div>

        {/* Buscador */}
        <div>
          <input
            type="text"
            placeholder="🔍 Buscar por nombre, RUC o CI..."
            value={busqueda}
            onChange={handleBuscar}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: '#1a2225',
              border: '2px solid #336699',
              borderRadius: '14px',
              color: '#fff',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        {/* Lista de Clientes y Proveedores */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>Cargando registros...</div>
          ) : personasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>No se encontraron registros</div>
          ) : (
            personasFiltradas.map(p => {
              const esProveedor = (p.tipo_persona || p.tipo || '').toUpperCase() === 'PROVEEDOR'
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#1b2326',
                    border: `1px solid ${esProveedor ? '#4a3b1a' : '#283438'}`,
                    borderRadius: '14px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
                        {p.nombre || p.razon_social}
                      </div>
                      <div style={{ fontSize: '12px', color: esProveedor ? '#ffe082' : '#90caf9', marginTop: '2px' }}>
                        📄 {p.documento || p.ruc_ci || p.ruc || 'Sin Documento'}
                      </div>
                    </div>

                    <div style={{
                      background: esProveedor ? '#332b18' : '#1d2b38',
                      border: `1px solid ${esProveedor ? '#997a29' : '#336699'}`,
                      color: esProveedor ? '#ffe082' : '#90caf9',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {esProveedor ? '🚚 PROVEEDOR' : '👤 CLIENTE'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #283438' }}>
                    <div style={{ fontSize: '12px', color: '#9ba1a2' }}>
                      {p.telefono ? `📞 ${p.telefono}` : (p.direccion || 'Sin contacto')}
                    </div>

                    {p.telefono && (
                      <a
                        href={`https://wa.me/${p.telefono.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: '#1f382b',
                          color: '#6ed1a7',
                          border: '1px solid #2e7d58',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: '700',
                          textDecoration: 'none'
                        }}
                      >
                        💬 WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal Agregar Nuevo Cliente o Proveedor */}
      {mostrarModalNuevo && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#1a2225',
            border: '2px solid #336699',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#90caf9', fontSize: '18px' }}>
                {nuevo.tipo_persona === 'PROVEEDOR' ? '🚚 Registrar Proveedor' : '👤 Registrar Cliente'}
              </h3>
              <button
                onClick={() => setMostrarModalNuevo(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {errorModal && (
              <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
                ⚠️ {errorModal}
              </div>
            )}

            <form onSubmit={handleCrearPersona} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Selector de Tipo: Cliente vs Proveedor */}
              <div>
                <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px', fontWeight: '700' }}>
                  Tipo de Registro *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setNuevo(n => ({ ...n, tipo_persona: 'CLIENTE' }))}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: nuevo.tipo_persona === 'CLIENTE' ? '2px solid #336699' : '1px solid #283438',
                      background: nuevo.tipo_persona === 'CLIENTE' ? '#1d2b38' : '#121719',
                      color: nuevo.tipo_persona === 'CLIENTE' ? '#bbdefb' : '#9ba1a2',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    👤 Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setNuevo(n => ({ ...n, tipo_persona: 'PROVEEDOR' }))}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: nuevo.tipo_persona === 'PROVEEDOR' ? '2px solid #d4af37' : '1px solid #283438',
                      background: nuevo.tipo_persona === 'PROVEEDOR' ? '#332b18' : '#121719',
                      color: nuevo.tipo_persona === 'PROVEEDOR' ? '#ffe082' : '#9ba1a2',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🚚 Proveedor
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ba1a2', display: 'block', marginBottom: '4px' }}>
                  Nombre Completo / Razón Social *
                </label>
                <input
                  type="text"
                  placeholder={nuevo.tipo_persona === 'PROVEEDOR' ? 'Ej: Distribuidora Veterinaria S.A.' : 'Ej: Juan Pérez'}
                  value={nuevo.nombre}
                  onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#121719',
                    border: '1px solid #3a4a50',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ba1a2', display: 'block', marginBottom: '4px' }}>
                  RUC / CI
                </label>
                <input
                  type="text"
                  placeholder="Ej: 1234567-8"
                  value={nuevo.documento}
                  onChange={e => setNuevo(n => ({ ...n, documento: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#121719',
                    border: '1px solid #3a4a50',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ba1a2', display: 'block', marginBottom: '4px' }}>
                  Teléfono / Celular
                </label>
                <input
                  type="text"
                  placeholder="Ej: 0981 123456"
                  value={nuevo.telefono}
                  onChange={e => setNuevo(n => ({ ...n, telefono: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#121719',
                    border: '1px solid #3a4a50',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#9ba1a2', display: 'block', marginBottom: '4px' }}>
                  Dirección / Ciudad
                </label>
                <input
                  type="text"
                  placeholder="Ej: Salto del Guairá"
                  value={nuevo.direccion}
                  onChange={e => setNuevo(n => ({ ...n, direccion: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#121719',
                    border: '1px solid #3a4a50',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={guardando}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  background: nuevo.tipo_persona === 'PROVEEDOR' ? 'linear-gradient(135deg, #997a29, #d4af37)' : 'linear-gradient(135deg, #336699, #4a90e2)',
                  color: nuevo.tipo_persona === 'PROVEEDOR' ? '#000' : '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontWeight: '900',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                {guardando ? 'Guardando...' : (nuevo.tipo_persona === 'PROVEEDOR' ? 'GUARDAR PROVEEDOR 🚚' : 'GUARDAR CLIENTE 👤')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
