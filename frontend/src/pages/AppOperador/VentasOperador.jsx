import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

export default function VentasOperador() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [loadingProds, setLoadingProds] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [clientes, setClientes] = useState([])
  const [clienteSel, setClienteSel] = useState('')
  const [formaPago, setFormaPago] = useState('EFECTIVO')
  const [tipoComprobante, setTipoComprobante] = useState('TICKET')
  
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(null)
  const [mostrarCarritoModal, setMostrarCarritoModal] = useState(false)

  // Cargar lista inicial de productos y clientes
  useEffect(() => {
    fetchProductos('')
    fetchClientes()
  }, [])

  const fetchProductos = async (q) => {
    setLoadingProds(true)
    try {
      const data = await api.productos(q ? `?q=${encodeURIComponent(q)}` : '')
      setProductos(Array.isArray(data) ? data : (data.productos || []))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingProds(false)
    }
  }

  const fetchClientes = async () => {
    try {
      const data = await api.personas('?tipo=CLIENTE')
      const list = Array.isArray(data) ? data : (data.personas || [])
      setClientes(list)
      const cf = list.find(c => c.nombre?.toUpperCase().includes('CONSUMIDOR'))
      if (cf) setClienteSel(cf.id)
    } catch (err) {
      console.error(err)
    }
  }

  const handleBuscar = (e) => {
    const text = e.target.value
    setBusqueda(text)
    fetchProductos(text)
  }

  const agregarAlCarrito = (prod) => {
    setCarrito(prev => {
      const idx = prev.findIndex(item => item.id === prod.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx].cantidad += 1
        return copy
      } else {
        return [...prev, {
          id: prod.id,
          nombre: prod.nombre,
          precio: Number(prod.precio_venta) || 0,
          cantidad: 1,
          unidad_medida: prod.unidad_medida || 'UN'
        }]
      }
    })
  }

  const modificarCantidad = (id, delta) => {
    setCarrito(prev => prev.map(item => {
      if (item.id === id) {
        const n = item.cantidad + delta
        return n > 0 ? { ...item, cantidad: n } : null
      }
      return item
    }).filter(Boolean))
  }

  const totalVenta = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)

  const handleConfirmarVenta = async () => {
    if (carrito.length === 0) return
    setProcesando(true)
    setError('')

    try {
      const payload = {
        persona_id: clienteSel || null,
        forma_pago: formaPago,
        tipo_comprobante: tipoComprobante,
        detalles: carrito.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio
        }))
      }

      const res = await api.createVenta(payload)
      setExito(res)
      setCarrito([])
      setMostrarCarritoModal(false)
    } catch (err) {
      setError(err.message || 'Error al procesar la venta')
    } finally {
      setProcesando(false)
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
            color: '#6ed1a7',
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
        <div style={{ fontWeight: '900', fontSize: '17px', color: '#73e6b2' }}>
          🟢 REGISTRAR VENTA
        </div>
        <div style={{ width: '40px' }} />
      </header>

      {/* Exito Modal */}
      {exito && (
        <div style={{
          padding: '24px',
          background: '#18382b',
          borderBottom: '2px solid #4db687',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
          <h2 style={{ color: '#73e6b2', margin: '0 0 8px 0', fontSize: '22px' }}>Venta Cobrada con Éxito</h2>
          <p style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', margin: '0 0 16px 0' }}>
            Total: ₲ {totalVenta.toLocaleString('es-PY')}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => setExito(null)}
              style={{
                background: '#4db687',
                color: '#000',
                fontWeight: '800',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              Nueva Venta 🛒
            </button>
            <button
              onClick={() => navigate('/operador')}
              style={{
                background: '#283438',
                color: '#fff',
                fontWeight: '700',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              Menú Principal 🏠
            </button>
          </div>
        </div>
      )}

      {/* Main Body */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Buscador de productos */}
        <div>
          <label style={{ fontSize: '13px', color: '#9ba1a2', fontWeight: '600', marginBottom: '6px', display: 'block' }}>
            🔍 BUSCAR PRODUCTO
          </label>
          <input
            type="text"
            placeholder="Escribe el nombre o código de lote..."
            value={busqueda}
            onChange={handleBuscar}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: '#1a2225',
              border: '2px solid #2e7d58',
              borderRadius: '14px',
              color: '#fff',
              fontSize: '16px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        {/* Lista táctil de productos */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '42vh' }}>
          {loadingProds ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '20px' }}>Cargando productos...</div>
          ) : productos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '20px' }}>No se encontraron productos</div>
          ) : (
            productos.map(p => (
              <div
                key={p.id}
                style={{
                  background: '#1b2326',
                  border: '1px solid #283438',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                    {p.nombre}
                  </div>
                  <div style={{ fontSize: '13px', color: '#73e6b2', fontWeight: '800', marginTop: '2px' }}>
                    ₲ {Number(p.precio_venta).toLocaleString('es-PY')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ba1a2' }}>
                    Stock: {p.stock_actual ?? p.stock ?? 'S/D'} {p.unidad_medida || 'UN'}
                  </div>
                </div>

                <button
                  onClick={() => agregarAlCarrito(p)}
                  style={{
                    background: '#2e7d58',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + Agregar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Fijo con Resumen de Carrito */}
      <footer style={{
        background: '#1a2225',
        padding: '16px 20px',
        borderTop: '2px solid #283438',
        position: 'sticky',
        bottom: 0
      }}>
        {carrito.length > 0 ? (
          <div>
            {/* Vista previa de items */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '14px', color: '#9ba1a2' }}>Carrito ({carrito.length} items):</span>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#73e6b2' }}>
                  ₲ {totalVenta.toLocaleString('es-PY')}
                </div>
              </div>

              <button
                onClick={() => setMostrarCarritoModal(true)}
                style={{
                  background: '#283438',
                  color: '#6ed1a7',
                  border: '1px solid #4db687',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Ver Detalle 📋
              </button>
            </div>

            {/* Selección rápida de Cliente y Medio de Pago */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#9ba1a2', display: 'block', marginBottom: '4px' }}>Cliente</label>
                <select
                  value={clienteSel}
                  onChange={e => setClienteSel(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#121719',
                    color: '#fff',
                    border: '1px solid #3a4a50',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Consumidor Final</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#9ba1a2', display: 'block', marginBottom: '4px' }}>Forma de Pago</label>
                <select
                  value={formaPago}
                  onChange={e => setFormaPago(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#121719',
                    color: '#fff',
                    border: '1px solid #3a4a50',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '13px'
                  }}
                >
                  <option value="EFECTIVO">💵 Efectivo</option>
                  <option value="TARJETA">💳 Tarjeta</option>
                  <option value="TRANSFERENCIA">🏦 Transferencia</option>
                  <option value="CREDITO">📝 Crédito CC</option>
                </select>
              </div>
            </div>

            {error && (
              <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '10px', textAlign: 'center' }}>
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleConfirmarVenta}
              disabled={procesando}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2e7d58, #4db687)',
                color: '#000',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '18px',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(77, 182, 135, 0.4)'
              }}
            >
              {procesando ? 'Procesando Venta...' : `COBRAR ₲ ${totalVenta.toLocaleString('es-PY')}`}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '10px 0', fontSize: '14px' }}>
            🛒 Selecciona productos arriba para iniciar la venta
          </div>
        )}
      </footer>

      {/* Modal de Detalle de Carrito */}
      {mostrarCarritoModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'flex-end',
          zIndex: 100
        }}>
          <div style={{
            background: '#1a2225',
            width: '100%',
            maxWidth: '500px',
            margin: '0 auto',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '20px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#73e6b2', fontSize: '18px' }}>Detalle de Venta</h3>
              <button
                onClick={() => setMostrarCarritoModal(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {carrito.map(item => (
                <div
                  key={item.id}
                  style={{
                    background: '#121719',
                    padding: '12px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px' }}>{item.nombre}</div>
                    <div style={{ color: '#73e6b2', fontSize: '13px' }}>
                      ₲ {item.precio.toLocaleString('es-PY')} x {item.cantidad} = ₲ {(item.precio * item.cantidad).toLocaleString('es-PY')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => modificarCantidad(item.id, -1)}
                      style={{
                        background: '#3a2428',
                        color: '#ff6b6b',
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '16px',
                        cursor: 'pointer'
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontWeight: '800', fontSize: '15px', width: '20px', textAlign: 'center' }}>
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => modificarCantidad(item.id, 1)}
                      style={{
                        background: '#1b382b',
                        color: '#73e6b2',
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        fontWeight: '800',
                        fontSize: '16px',
                        cursor: 'pointer'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setMostrarCarritoModal(false)}
              style={{
                width: '100%',
                background: '#283438',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Listo / Volver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
