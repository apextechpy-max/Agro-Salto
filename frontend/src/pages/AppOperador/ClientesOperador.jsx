import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export default function ClientesOperador() {
  const navigate = useNavigate()

  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(false)
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false)

  // Formulario Nuevo Cliente
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
    fetchClientes('')
  }, [])

  const fetchClientes = async (q) => {
    setLoading(true)
    try {
      const data = await api.personas(`?tipo=CLIENTE${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      const list = Array.isArray(data) ? data : (data.personas || [])
      setClientes(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = (e) => {
    const txt = e.target.value
    setBusqueda(txt)
    fetchClientes(txt)
  }

  const handleCrearCliente = async (e) => {
    e.preventDefault()
    if (!nuevo.nombre.trim()) {
      setErrorModal('Ingresa el nombre del cliente')
      return
    }
    setGuardando(true)
    setErrorModal('')

    try {
      await api.createPersona({
        ...nuevo,
        razon_social: nuevo.nombre,
        tipo_persona: 'CLIENTE'
      })
      setMostrarModalNuevo(false)
      setNuevo({ nombre: '', documento: '', telefono: '', direccion: '', tipo_persona: 'CLIENTE' })
      fetchClientes(busqueda)
    } catch (err) {
      setErrorModal(err.message || 'Error al guardar cliente')
    } finally {
      setGuardando(false)
    }
  }

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
        <div style={{ fontWeight: '900', fontSize: '17px', color: '#90caf9' }}>
          👥 CLIENTES
        </div>
        <button
          onClick={() => setMostrarModalNuevo(true)}
          style={{
            background: '#336699',
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

        {/* Lista de Clientes */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>Cargando clientes...</div>
          ) : clientes.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>No se encontraron clientes</div>
          ) : (
            clientes.map(c => (
              <div
                key={c.id}
                style={{
                  background: '#1b2326',
                  border: '1px solid #283438',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
                    {c.nombre || c.razon_social}
                  </div>
                  <div style={{ fontSize: '12px', color: '#90caf9', marginTop: '2px' }}>
                    📄 {c.documento || c.ruc_ci || 'Sin Doc'}
                  </div>
                  {c.telefono && (
                    <div style={{ fontSize: '12px', color: '#9ba1a2', marginTop: '2px' }}>
                      📞 {c.telefono}
                    </div>
                  )}
                </div>

                {c.telefono && (
                  <a
                    href={`https://wa.me/${c.telefono.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#1f382b',
                      color: '#6ed1a7',
                      border: '1px solid #2e7d58',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '700',
                      textDecoration: 'none'
                    }}
                  >
                    💬 WhatsApp
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Agregar Nuevo Cliente */}
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
            maxWidth: '420px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#90caf9', fontSize: '18px' }}>👤 Registrar Nuevo Cliente</h3>
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

            <form onSubmit={handleCrearCliente} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9ba1a2', display: 'block', marginBottom: '4px' }}>
                  Nombre Completo / Razón Social *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
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
                  background: '#336699',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontWeight: '800',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                {guardando ? 'Guardando...' : 'GUARDAR CLIENTE 👤'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
