import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function VentasOperador() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [loadingProds, setLoadingProds] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [clientes, setClientes] = useState([])
  const [clienteSel, setClienteSel] = useState(null) // null = Cliente Ocasional
  const [formaPago, setFormaPago] = useState('EFECTIVO')
  const [tipoComprobante, setTipoComprobante] = useState('TICKET')
  
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(null)
  const [mostrarCarritoModal, setMostrarCarritoModal] = useState(false)

  // Modal Recibo / Comprobante
  const [mostrarReciboModal, setMostrarReciboModal] = useState(false)
  const [imagenVisorUrl, setImagenVisorUrl] = useState(null)
  const [imagenVisorBlob, setImagenVisorBlob] = useState(null)

  // Modal Selector de Cantidad con Control de Stock
  const [prodParaAgregar, setProdParaAgregar] = useState(null)
  const [cantParaAgregar, setCantParaAgregar] = useState(1)
  const [errorCantidad, setErrorCantidad] = useState('')

  // Modal Selector y Creación de Clientes
  const [mostrarModalClientes, setMostrarModalClientes] = useState(false)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarFormNuevoCliente, setMostrarFormNuevoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({ razon_social: '', ruc: '', telefono: '' })
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [errorCliente, setErrorCliente] = useState('')

  // Cargar lista inicial de productos y clientes
  useEffect(() => {
    fetchProductos('')
    fetchClientes()
  }, [])

  const fetchProductos = async (q) => {
    setLoadingProds(true)
    try {
      const data = await api.productos(q ? `?buscar=${encodeURIComponent(q)}` : '')
      const list = Array.isArray(data) ? data : (data.productos || [])
      setProductos(list)
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
    } catch (err) {
      console.error(err)
    }
  }

  const handleBuscar = (e) => {
    const text = e.target.value
    setBusqueda(text)
    fetchProductos(text)
  }

  // Al hacer clic en "+ Agregar"
  const abrirModalCantidad = (prod) => {
    const stockDisp = Number(prod.stock_actual ?? prod.stock ?? prod.stock_total ?? 0)
    if (stockDisp <= 0) {
      alert(`⚠️ El producto "${prod.nombre}" no tiene stock disponible actualmente.`)
      return
    }

    const yaEnCarrito = carrito.find(item => item.id === prod.id)?.cantidad || 0
    const disponibleReal = stockDisp - yaEnCarrito

    if (disponibleReal <= 0) {
      alert(`⚠️ Ya has agregado todo el stock disponible (${stockDisp} unidades) de este producto al carrito.`)
      return
    }

    setProdParaAgregar({ ...prod, stockDisp, disponibleReal })
    setCantParaAgregar(1)
    setErrorCantidad('')
  }

  const confirmarAgregarCantidad = () => {
    if (!prodParaAgregar) return
    const cantNum = Number(cantParaAgregar) || 0
    if (cantNum <= 0) {
      setErrorCantidad('Ingresa una cantidad mayor a 0')
      return
    }
    if (cantNum > prodParaAgregar.disponibleReal) {
      setErrorCantidad(`Solo puedes agregar hasta ${prodParaAgregar.disponibleReal} unidad(es)`)
      return
    }

    setCarrito(prev => {
      const idx = prev.findIndex(item => item.id === prodParaAgregar.id)
      const precio = Number(prodParaAgregar.precio_venta_menor || prodParaAgregar.precio_venta) || 0
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx].cantidad += cantNum
        return copy
      } else {
        return [...prev, {
          id: prodParaAgregar.id,
          nombre: prodParaAgregar.nombre,
          precio,
          cantidad: cantNum,
          stockTotal: prodParaAgregar.stockDisp,
          unidad_medida: prodParaAgregar.unidad_medida || 'UN',
          iva_tipo: prodParaAgregar.iva_tipo || '10'
        }]
      }
    })

    setProdParaAgregar(null)
  }

  const modificarCantidadCarrito = (id, delta) => {
    setCarrito(prev => prev.map(item => {
      if (item.id === id) {
        const nuevaCant = item.cantidad + delta
        if (nuevaCant <= 0) return null
        if (delta > 0 && item.stockTotal && nuevaCant > item.stockTotal) {
          alert(`⚠️ No puedes agregar más. El stock máximo disponible es ${item.stockTotal} unidades.`)
          return item
        }
        return { ...item, cantidad: nuevaCant }
      }
      return item
    }).filter(Boolean))
  }

  const totalVenta = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)

  const handleCrearNuevoCliente = async (e) => {
    e.preventDefault()
    if (!nuevoCliente.razon_social.trim()) {
      setErrorCliente('Ingresa el nombre del cliente')
      return
    }
    setGuardandoCliente(true)
    setErrorCliente('')

    try {
      const res = await api.createPersona({
        tipo: 'CLIENTE',
        razon_social: nuevoCliente.razon_social.trim().toUpperCase(),
        ruc: nuevoCliente.ruc.trim(),
        telefono: nuevoCliente.telefono.trim(),
        condicion_iva: 'CONTRIBUYENTE',
        condicion_pago: 'CONTADO'
      })

      const nuevoObj = {
        id: res.id,
        razon_social: nuevoCliente.razon_social.trim().toUpperCase(),
        ruc: nuevoCliente.ruc.trim(),
        telefono: nuevoCliente.telefono.trim()
      }

      setClientes(prev => [nuevoObj, ...prev])
      setClienteSel(nuevoObj)
      setMostrarFormNuevoCliente(false)
      setMostrarModalClientes(false)
      setNuevoCliente({ razon_social: '', ruc: '', telefono: '' })
    } catch (err) {
      setErrorCliente(err.message || 'Error al registrar cliente')
    } finally {
      setGuardandoCliente(false)
    }
  }

  const handleConfirmarVenta = async () => {
    if (carrito.length === 0) return
    setProcesando(true)
    setError('')

    try {
      const payload = {
        cliente_id: clienteSel?.id || null,
        filial_id: user?.filial_id || 1,
        tipo: 'MINORISTA',
        tipo_pago: formaPago,
        tipo_comprobante: tipoComprobante,
        monto_pagado: totalVenta,
        moneda_pago: 'GS',
        items: carrito.map(item => ({
          producto_id: item.id,
          cantidad: item.cantidad,
          precio_unit: item.precio,
          descuento: 0,
          iva_tipo: item.iva_tipo || '10'
        }))
      }

      const res = await api.createVenta(payload)
      setExito({
        ...res,
        id: res.id || res.venta_id || Date.now().toString().slice(-6),
        totalCobrado: totalVenta,
        itemsComprados: [...carrito],
        clienteNombre: clienteSel?.razon_social || clienteSel?.nombre || 'Cliente Ocasional',
        clienteRuc: clienteSel?.ruc || clienteSel?.documento || '',
        clienteTel: clienteSel?.telefono || '',
        formaPago,
        tipoComprobante,
        fecha: new Date()
      })
      setCarrito([])
      setMostrarCarritoModal(false)
    } catch (err) {
      setError(err.message || 'Error al procesar la venta')
    } finally {
      setProcesando(false)
    }
  }

  const [generandoImg, setGenerandoImg] = useState(false)

  const abrirImagenRecibo = async () => {
    const elemento = document.getElementById('recibo-ticket-imprimible')
    if (!elemento) {
      alert('No se encontró el elemento del recibo')
      return
    }

    try {
      setGenerandoImg(true)
      const canvas = await html2canvas(elemento, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      })

      canvas.toBlob((blob) => {
        if (!blob) {
          const imgData = canvas.toDataURL('image/png')
          setImagenVisorUrl(imgData)
          setImagenVisorBlob(null)
          return
        }
        const url = URL.createObjectURL(blob)
        setImagenVisorUrl(url)
        setImagenVisorBlob(blob)
      }, 'image/png')
    } catch (err) {
      alert('Error al generar imagen del recibo: ' + (err.message || err))
    } finally {
      setGenerandoImg(false)
    }
  }

  const compartirImagenVisor = async () => {
    if (!imagenVisorBlob && !imagenVisorUrl) return
    try {
      if (imagenVisorBlob) {
        const file = new File([imagenVisorBlob], `Recibo_AgroSalto_${exito?.id || 'ticket'}.png`, { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Recibo #${exito?.id} - Agro Salto`,
            text: `Comprobante de compra #${exito?.id} - Agro Salto`
          })
          return
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return
    }

    // Fallback: descargar imagen directamente
    descargarImagenVisor()
  }

  const descargarImagenVisor = () => {
    if (!imagenVisorUrl) return
    const a = document.createElement('a')
    a.href = imagenVisorUrl
    a.download = `Recibo_AgroSalto_${exito?.id || 'ticket'}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Filtrado de clientes para el modal
  const clientesFiltrados = clientes.filter(c => {
    if (!busquedaCliente.trim()) return true
    const q = busquedaCliente.toLowerCase()
    return (
      c.razon_social?.toLowerCase().includes(q) ||
      c.nombre?.toLowerCase().includes(q) ||
      c.ruc?.toLowerCase().includes(q) ||
      c.telefono?.toLowerCase().includes(q)
    )
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

      {/* Exito Banner/Modal */}
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
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', margin: '0 0 8px 0' }}>
            Total: ₲ {Number(exito.totalCobrado || exito.total || 0).toLocaleString('es-PY')}
          </div>
          <div style={{ fontSize: '13px', color: '#a2e8c6', marginBottom: '16px' }}>
            Cliente: <strong>{exito.clienteNombre || 'Cliente Ocasional'}</strong> • Pago: <strong>{exito.formaPago || 'EFECTIVO'}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            <button
              onClick={() => {
                setTelefonoWhatsappRecibo(exito.clienteTel || '')
                setMostrarReciboModal(true)
              }}
              style={{
                background: 'linear-gradient(135deg, #d4af37, #f39c12)',
                color: '#000',
                fontWeight: '900',
                border: 'none',
                padding: '14px 20px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)'
              }}
            >
              <span>🧾</span> Generar / Enviar Recibo al Cliente
            </button>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setExito(null)}
                style={{
                  flex: 1,
                  background: '#4db687',
                  color: '#000',
                  fontWeight: '800',
                  border: 'none',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Nueva Venta 🛒
              </button>
              <button
                onClick={() => navigate('/operador')}
                style={{
                  flex: 1,
                  background: '#283438',
                  color: '#fff',
                  fontWeight: '700',
                  border: 'none',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Menú Principal 🏠
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Body */}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Barra de Cliente Seleccionado (Toca para cambiar) */}
        <div
          onClick={() => {
            setBusquedaCliente('')
            setMostrarFormNuevoCliente(false)
            setMostrarModalClientes(true)
          }}
          style={{
            background: '#18241e',
            border: '1px solid #2e7d58',
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>👤</span>
            <div>
              <div style={{ fontSize: '11px', color: '#9ba1a2', textTransform: 'uppercase', fontWeight: '700' }}>
                Cliente de la Venta
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#73e6b2' }}>
                {clienteSel ? (clienteSel.razon_social || clienteSel.nombre) : 'Cliente Ocasional'}
              </div>
              {clienteSel?.ruc && (
                <div style={{ fontSize: '11px', color: '#9ba1a2' }}>RUC/CI: {clienteSel.ruc}</div>
              )}
            </div>
          </div>
          <span style={{ fontSize: '12px', background: '#243a2c', color: '#6ed1a7', padding: '4px 10px', borderRadius: '8px', fontWeight: '700' }}>
            Cambiar ▾
          </span>
        </div>

        {/* Buscador de productos */}
        <div>
          <label style={{ fontSize: '13px', color: '#9ba1a2', fontWeight: '600', marginBottom: '6px', display: 'block' }}>
            🔍 BUSCAR PRODUCTO
          </label>
          <input
            type="text"
            placeholder="Escribe el nombre o código..."
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
            productos.map(p => {
              const stock = Number(p.stock_actual ?? p.stock ?? p.stock_total ?? 0)
              const sinStock = stock <= 0
              const precio = Number(p.precio_venta_menor || p.precio_venta || 0)

              return (
                <div
                  key={p.id}
                  style={{
                    background: sinStock ? '#181c1e' : '#1b2326',
                    border: `1px solid ${sinStock ? '#332426' : '#283438'}`,
                    borderRadius: '14px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    opacity: sinStock ? 0.65 : 1
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: '14px', color: '#73e6b2', fontWeight: '800', marginTop: '2px' }}>
                      ₲ {precio.toLocaleString('es-PY')}
                    </div>
                    <div style={{ fontSize: '11px', color: sinStock ? '#ff8787' : '#9ba1a2', fontWeight: sinStock ? '700' : '500' }}>
                      {sinStock ? '❌ Sin stock disponible' : `Stock: ${stock} ${p.unidad_medida || 'UN'}`}
                    </div>
                  </div>

                  <button
                    onClick={() => abrirModalCantidad(p)}
                    disabled={sinStock}
                    style={{
                      background: sinStock ? '#2d2426' : '#2e7d58',
                      color: sinStock ? '#7a6064' : '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontWeight: '800',
                      fontSize: '14px',
                      cursor: sinStock ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Agregar
                  </button>
                </div>
              )
            })
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#9ba1a2' }}>Carrito ({carrito.length} items):</span>
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
                Ver Detalle ({carrito.reduce((a, b) => a + b.cantidad, 0)}) 📋
              </button>
            </div>

            {/* Selector de Forma de Pago */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: '#9ba1a2', display: 'block', marginBottom: '4px', fontWeight: '700' }}>Forma de Pago</label>
              <select
                value={formaPago}
                onChange={e => setFormaPago(e.target.value)}
                style={{
                  width: '100%',
                  background: '#121719',
                  color: '#fff',
                  border: '1px solid #3a4a50',
                  borderRadius: '10px',
                  padding: '10px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <option value="EFECTIVO">💵 Efectivo</option>
                <option value="TARJETA">💳 Tarjeta (POS)</option>
                <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
                <option value="CREDITO">📝 Cuenta Corriente (Crédito)</option>
              </select>
            </div>

            {error && (
              <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '10px', textAlign: 'center', fontWeight: '700' }}>
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

      {/* MODAL 1: PREGUNTAR CANTIDAD CON CONTROL DE STOCK */}
      {prodParaAgregar && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#1a2225',
            width: '100%',
            maxWidth: '500px',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            padding: '24px 20px',
            borderTop: '3px solid #4db687'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '17px', fontWeight: '800' }}>
                  {prodParaAgregar.nombre}
                </h3>
                <div style={{ fontSize: '13px', color: '#73e6b2', fontWeight: '700', marginTop: '2px' }}>
                  ₲ {Number(prodParaAgregar.precio_venta_menor || prodParaAgregar.precio_venta || 0).toLocaleString('es-PY')} / {prodParaAgregar.unidad_medida || 'UN'}
                </div>
              </div>
              <button
                onClick={() => setProdParaAgregar(null)}
                style={{ background: '#243035', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#121719', borderRadius: '12px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#9ba1a2' }}>Stock Disponible:</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#a7f3d0' }}>
                {prodParaAgregar.disponibleReal} {prodParaAgregar.unidad_medida || 'UN'}
              </span>
            </div>

            {errorCantidad && (
              <div style={{ color: '#ff8787', fontSize: '13px', marginBottom: '12px', textAlign: 'center', fontWeight: '700' }}>
                ⚠️ {errorCantidad}
              </div>
            )}

            {/* Stepper interactivo de cantidad */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setCantParaAgregar(prev => Math.max(1, Number(prev) - 1))}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#2a1a1f',
                  color: '#ff8787',
                  border: '1px solid #5a242c',
                  fontSize: '24px',
                  fontWeight: '900',
                  cursor: 'pointer'
                }}
              >
                -
              </button>

              <input
                type="number"
                min="1"
                max={prodParaAgregar.disponibleReal}
                value={cantParaAgregar}
                onChange={e => {
                  const val = Number(e.target.value) || 1
                  setCantParaAgregar(val)
                }}
                style={{
                  width: '100px',
                  height: '48px',
                  background: '#0d1214',
                  border: '2px solid #2e7d58',
                  borderRadius: '12px',
                  color: '#73e6b2',
                  fontSize: '22px',
                  fontWeight: '900',
                  textAlign: 'center'
                }}
              />

              <button
                type="button"
                onClick={() => setCantParaAgregar(prev => Math.min(prodParaAgregar.disponibleReal, Number(prev) + 1))}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#1b382b',
                  color: '#73e6b2',
                  border: '1px solid #2e7d58',
                  fontSize: '24px',
                  fontWeight: '900',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
            </div>

            {/* Botón de Todo el Stock */}
            {prodParaAgregar.disponibleReal > 1 && (
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setCantParaAgregar(prodParaAgregar.disponibleReal)}
                  style={{
                    background: '#1d2a24',
                    border: '1px dashed #4db687',
                    color: '#a7f3d0',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Todo el stock disponible ({prodParaAgregar.disponibleReal})
                </button>
              </div>
            )}

            <button
              onClick={confirmarAgregarCantidad}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              Agregar al Carrito ₲ {(Number(prodParaAgregar.precio_venta_menor || prodParaAgregar.precio_venta || 0) * (Number(cantParaAgregar) || 1)).toLocaleString('es-PY')}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: SELECTOR Y CREACIÓN DE CLIENTES */}
      {mostrarModalClientes && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#1a2225',
            width: '100%',
            maxWidth: '500px',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            padding: '20px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#73e6b2', fontSize: '18px', fontWeight: '800' }}>
                Seleccionar Cliente
              </h3>
              <button
                onClick={() => setMostrarModalClientes(false)}
                style={{ background: '#243035', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* Opción rápida: Cliente Ocasional */}
            <div
              onClick={() => {
                setClienteSel(null)
                setMostrarModalClientes(false)
              }}
              style={{
                background: !clienteSel ? '#1d382b' : '#141c1f',
                border: `2px solid ${!clienteSel ? '#4db687' : '#283438'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                  👤 Cliente Ocasional (Predeterminado)
                </div>
                <div style={{ fontSize: '12px', color: '#9ba1a2' }}>Sin comprobante nominativo</div>
              </div>
              {!clienteSel && <span style={{ color: '#73e6b2', fontSize: '18px' }}>✓</span>}
            </div>

            {/* Buscador de clientes */}
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, RUC o CI..."
              value={busquedaCliente}
              onChange={e => setBusquedaCliente(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#121719',
                border: '1px solid #3a4a50',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />

            {/* Formulario nuevo cliente inline */}
            {mostrarFormNuevoCliente ? (
              <form onSubmit={handleCrearNuevoCliente} style={{ background: '#121719', padding: '14px', borderRadius: '12px', border: '1px solid #2e7d58', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#73e6b2' }}>➕ Nuevo Cliente Rápido</div>
                {errorCliente && <div style={{ color: '#ff8787', fontSize: '12px' }}>⚠️ {errorCliente}</div>}
                <input
                  type="text"
                  placeholder="Nombre / Razón Social *"
                  value={nuevoCliente.razon_social}
                  onChange={e => setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#1a2225', border: '1px solid #334', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="RUC o CI"
                    value={nuevoCliente.ruc}
                    onChange={e => setNuevoCliente({ ...nuevoCliente, ruc: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: '#1a2225', border: '1px solid #334', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                  />
                  <input
                    type="text"
                    placeholder="Teléfono"
                    value={nuevoCliente.telefono}
                    onChange={e => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: '#1a2225', border: '1px solid #334', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    disabled={guardandoCliente}
                    style={{ flex: 1, background: '#2e7d58', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {guardandoCliente ? 'Guardando...' : 'Guardar y Seleccionar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarFormNuevoCliente(false)}
                    style={{ background: '#2d373b', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarFormNuevoCliente(true)}
                style={{
                  background: '#1d262a',
                  border: '1px dashed #3a4a50',
                  color: '#6ed1a7',
                  borderRadius: '10px',
                  padding: '10px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ➕ Registrar Nuevo Cliente
              </button>
            )}

            {/* Lista scrolleable de clientes */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '35vh' }}>
              {clientesFiltrados.map(c => {
                const nombre = c.razon_social || c.nombre
                const esSel = clienteSel?.id === c.id

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setClienteSel(c)
                      setMostrarModalClientes(false)
                    }}
                    style={{
                      background: esSel ? '#1b382b' : '#141c1f',
                      border: `1px solid ${esSel ? '#2e7d58' : '#243035'}`,
                      borderRadius: '10px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{nombre}</div>
                      <div style={{ fontSize: '11px', color: '#9ba1a2' }}>
                        {c.ruc ? `RUC/CI: ${c.ruc}` : ''} {c.telefono ? `• Tel: ${c.telefono}` : ''}
                      </div>
                    </div>
                    {esSel && <span style={{ color: '#73e6b2', fontWeight: '900' }}>✓</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DETALLE DEL CARRITO */}
      {mostrarCarritoModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'flex-end',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
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
                      onClick={() => modificarCantidadCarrito(item.id, -1)}
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
                    <span style={{ fontWeight: '800', fontSize: '15px', width: '24px', textAlign: 'center' }}>
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => modificarCantidadCarrito(item.id, 1)}
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
              Listo / Volver a Productos
            </button>
          </div>
        </div>
      )}

      {/* MODAL RECIBO DIGITAL Y ENVÍO POR WHATSAPP */}
      {mostrarReciboModal && exito && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#1a2225',
            border: '2px solid #d4af37',
            borderRadius: '24px',
            padding: '20px',
            width: '100%',
            maxWidth: '430px',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🧾</span>
                <h3 style={{ margin: 0, color: '#ffe082', fontSize: '18px', fontWeight: '800' }}>
                  Comprobante de Venta
                </h3>
              </div>
              <button
                onClick={() => setMostrarReciboModal(false)}
                style={{ background: '#283438', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* Ticket Impreso / Recibo Preview */}
            <div 
              id="recibo-ticket-imprimible"
              style={{
                background: '#ffffff',
                color: '#000000',
                borderRadius: '14px',
                padding: '18px 16px',
                fontFamily: 'monospace',
                fontSize: '13px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                lineHeight: '1.4'
              }}
            >
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #333', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>AGRO SALTO</div>
                <div style={{ fontSize: '11px', color: '#555' }}>Veterinaria & Agroganadera</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>Salto del Guairá, Paraguay</div>
                <div style={{ fontSize: '12px', fontWeight: '800', marginTop: '6px' }}>RECIBO DE VENTA #{exito.id}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{new Date(exito.fecha || Date.now()).toLocaleString('es-PY')}</div>
              </div>

              <div style={{ fontSize: '12px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                <div><strong>Cliente:</strong> {exito.clienteNombre || 'Cliente Ocasional'}</div>
                {exito.clienteRuc && <div><strong>RUC/CI:</strong> {exito.clienteRuc}</div>}
                <div><strong>Pago:</strong> {exito.formaPago || 'EFECTIVO'}</div>
              </div>

              {/* Items */}
              <div style={{ borderBottom: '2px dashed #333', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '6px' }}>
                  <span>CANT / DESCRIPCIÓN</span>
                  <span>TOTAL</span>
                </div>
                {(exito.itemsComprados || []).map((it, idx) => (
                  <div key={idx} style={{ marginBottom: '6px' }}>
                    <div style={{ fontWeight: '700' }}>{it.nombre}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#444' }}>
                      <span>{it.cantidad} {it.unidad_medida || 'UN'} × ₲ {(it.precio || 0).toLocaleString('es-PY')}</span>
                      <strong style={{ color: '#000' }}>₲ {(it.cantidad * it.precio).toLocaleString('es-PY')}</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Final */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: '900', padding: '4px 0' }}>
                <span>TOTAL A PAGAR:</span>
                <span style={{ fontSize: '18px' }}>₲ {Number(exito.totalCobrado || 0).toLocaleString('es-PY')}</span>
              </div>

              <div style={{ textAlign: 'center', fontSize: '10px', color: '#666', marginTop: '12px', borderTop: '1px dashed #ccc', paddingTop: '8px' }}>
                ¡Gracias por su preferencia! 🐾🌾
              </div>
            </div>

            {/* Acciones: Abrir Imagen y Cerrar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={abrirImagenRecibo}
                disabled={generandoImg}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '15px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                  opacity: generandoImg ? 0.7 : 1
                }}
              >
                <span>🖼️</span> {generandoImg ? 'Generando Imagen...' : 'Abrir Imagen del Comprobante'}
              </button>

              <button
                onClick={() => setMostrarReciboModal(false)}
                style={{
                  background: '#242f33',
                  color: '#e2e8f0',
                  border: '1px solid #3a4a50',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ✓ Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISOR DE IMAGEN ADAPTABLE CON COMPARTIR */}
      {imagenVisorUrl && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '14px',
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            background: '#121719',
            border: '2px solid #10b981',
            borderRadius: '24px',
            padding: '16px',
            width: '100%',
            maxWidth: '390px',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
            overflowY: 'auto'
          }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📸</span>
                <h3 style={{ margin: 0, color: '#6ed1a7', fontSize: '17px', fontWeight: '800' }}>
                  Comprobante Listo
                </h3>
              </div>
              <button
                onClick={() => setImagenVisorUrl(null)}
                style={{ background: '#283438', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* Contenedor de la Imagen Adaptada a la pantalla del móvil */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#0d1214',
              borderRadius: '16px',
              padding: '10px',
              border: '1px solid #233035',
              overflow: 'hidden'
            }}>
              <img
                src={imagenVisorUrl}
                alt="Comprobante Agro Salto"
                style={{
                  width: '100%',
                  maxWidth: '320px',
                  maxHeight: '52vh',
                  objectFit: 'contain',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}
              />
            </div>

            <div style={{ fontSize: '11px', color: '#9ba1a2', textAlign: 'center', lineHeight: '1.4' }}>
              💡 Toca el botón verde para enviarlo a WhatsApp, o mantén presionada la imagen para guardarla.
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={compartirImagenVisor}
                style={{
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(37, 211, 102, 0.4)'
                }}
              >
                <span>📲</span> Compartir por WhatsApp
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  onClick={descargarImagenVisor}
                  style={{
                    background: '#1d262a',
                    color: '#ffe082',
                    border: '1px solid #4a3b1a',
                    borderRadius: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>⬇️</span> Guardar
                </button>

                <button
                  onClick={() => setImagenVisorUrl(null)}
                  style={{
                    background: '#283438',
                    color: '#cbd5e1',
                    border: '1px solid #3e4f55',
                    borderRadius: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
