import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export default function InventarioOperador() {
  const navigate = useNavigate()

  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchInventario('')
  }, [])

  const fetchInventario = async (q) => {
    setLoading(true)
    try {
      const data = await api.productos(q ? `?q=${encodeURIComponent(q)}` : '')
      const list = Array.isArray(data) ? data : (data.productos || [])
      setProductos(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = (e) => {
    const txt = e.target.value
    setBusqueda(txt)
    fetchInventario(txt)
  }

  const getStockBadge = (p) => {
    const qty = Number(p.stock_actual ?? p.stock ?? 0)
    const min = Number(p.stock_minimo ?? 5)

    if (qty <= 0) {
      return { label: 'Agotado 🔴', bg: '#3d1e24', border: '#9e3646', color: '#ff9ebb' }
    } else if (qty <= min) {
      return { label: `Stock Bajo (${qty}) 🟡`, bg: '#332b18', border: '#997a29', color: '#ffe082' }
    } else {
      return { label: `En Stock (${qty}) 🟢`, bg: '#1b382b', border: '#2e7d58', color: '#73e6b2' }
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
            color: '#ffe082',
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
        <div style={{ fontWeight: '900', fontSize: '17px', color: '#ffe082' }}>
          📦 INVENTARIO Y PRECIOS
        </div>
        <div style={{ width: '40px' }} />
      </header>

      {/* Main Container */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Buscador de Producto */}
        <div>
          <input
            type="text"
            placeholder="🔍 Buscar por nombre, código o lote..."
            value={busqueda}
            onChange={handleBuscar}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: '#1a2225',
              border: '2px solid #997a29',
              borderRadius: '14px',
              color: '#fff',
              fontSize: '15px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        {/* Lista de Productos y Existencias */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>Cargando inventario...</div>
          ) : productos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>No se encontraron productos</div>
          ) : (
            productos.map(p => {
              const badge = getStockBadge(p)
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#1b2326',
                    border: '1px solid #283438',
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
                        {p.nombre}
                      </div>
                      {p.codigo_lote && (
                        <div style={{ fontSize: '11px', color: '#9ba1a2', marginTop: '2px' }}>
                          Lote/Código: {p.codigo_lote}
                        </div>
                      )}
                    </div>

                    <div style={{
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '800',
                      whiteSpace: 'nowrap'
                    }}>
                      {badge.label}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    marginTop: '4px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #283438'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#9ba1a2' }}>PRECIO VENTA:</span>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: '#ffe082' }}>
                        ₲ {Number(p.precio_venta || 0).toLocaleString('es-PY')}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#9ba1a2' }}>UNIDAD:</span>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>
                        {p.unidad_medida || 'UN'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
