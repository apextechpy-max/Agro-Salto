import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

export default function InventarioOperador() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(false)
  const [proveedores, setProveedores] = useState([])

  // Modal 1: Nuevo Producto / Entrada de Stock
  const [mostrarModalEntrada, setMostrarModalEntrada] = useState(false)
  const [modoModal, setModoModal] = useState('EXISTENTE')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')
  const [exitoModal, setExitoModal] = useState(false)

  // Formulario Entrada Producto Existente
  const [productoSelId, setProductoSelId] = useState('')
  const [cantidadEntrada, setCantidadEntrada] = useState('1')
  const [precioCosto, setPrecioCosto] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [proveedorSel, setProveedorSel] = useState('')
  const [medioPagoEntrada, setMedioPagoEntrada] = useState('EFECTIVO') // 'EFECTIVO' | 'TRANSFERENCIA' | 'CREDITO'

  // Formulario Nuevo Producto
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('FARMACIA')
  const [nuevoUnidad, setNuevoUnidad] = useState('UN')
  const [nuevoCantidad, setNuevoCantidad] = useState('1')
  const [nuevoCosto, setNuevoCosto] = useState('')
  const [nuevoVenta, setNuevoVenta] = useState('')
  const [nuevoProveedor, setNuevoProveedor] = useState('')
  const [nuevoMedioPago, setNuevoMedioPago] = useState('EFECTIVO')

  // Modal 2: Editar Información de un Producto Existente
  const [productoParaEditar, setProductoParaEditar] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [editVenta, setEditVenta] = useState('')
  const [editCosto, setEditCosto] = useState('')
  const [editUnidad, setEditUnidad] = useState('UN')
  const [editTipo, setEditTipo] = useState('FARMACIA')
  const [editStockMin, setEditStockMin] = useState('3')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState('')
  const [exitoEdit, setExitoEdit] = useState(false)

  useEffect(() => {
    fetchInventario('')
    fetchProveedores()
  }, [])

  const fetchInventario = async (q) => {
    setLoading(true)
    try {
      const data = await api.productos(q ? `?buscar=${encodeURIComponent(q)}` : '')
      const list = Array.isArray(data) ? data : (data.productos || [])
      setProductos(list)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProveedores = async () => {
    try {
      const data = await api.personas('?tipo=PROVEEDOR')
      const list = Array.isArray(data) ? data : (data.personas || [])
      setProveedores(list)
    } catch (err) {
      console.error(err)
    }
  }

  const handleBuscar = (e) => {
    const txt = e.target.value
    setBusqueda(txt)
    fetchInventario(txt)
  }

  const getStockBadge = (p) => {
    const qty = Number(p.stock_actual ?? p.stock ?? p.stock_total ?? 0)
    const min = Number(p.stock_minimo ?? 5)

    if (qty <= 0) {
      return { label: 'Agotado 🔴', bg: '#3d1e24', border: '#9e3646', color: '#ff9ebb' }
    } else if (qty <= min) {
      return { label: `Stock Bajo (${qty}) 🟡`, bg: '#332b18', border: '#997a29', color: '#ffe082' }
    } else {
      return { label: `En Stock (${qty}) 🟢`, bg: '#1b382b', border: '#2e7d58', color: '#73e6b2' }
    }
  }

  const handleSeleccionarProductoExistente = (id) => {
    setProductoSelId(id)
    const p = productos.find(item => String(item.id) === String(id))
    if (p) {
      setPrecioCosto(p.precio_costo ? String(p.precio_costo) : '')
      setPrecioVenta(p.precio_venta_menor || p.precio_venta ? String(p.precio_venta_menor || p.precio_venta) : '')
    }
  }

  // Abrir Modal de Edición al hacer clic en cualquier producto
  const abrirModalEditar = (prod) => {
    setProductoParaEditar(prod)
    setEditNombre(prod.nombre || '')
    setEditVenta(String(prod.precio_venta_menor || prod.precio_venta || ''))
    setEditCosto(String(prod.precio_costo || ''))
    setEditUnidad(prod.unidad_medida || 'UN')
    setEditTipo(prod.tipo_inventario || 'FARMACIA')
    setEditStockMin(String(prod.stock_minimo || 3))
    setErrorEdit('')
    setExitoEdit(false)
  }

  // Guardar Edición Directa de Producto
  const handleGuardarEdicionProducto = async (e) => {
    e.preventDefault()
    if (!productoParaEditar) return
    setGuardandoEdit(true)
    setErrorEdit('')

    try {
      const vtaNum = Number(String(editVenta).replace(/\D/g, '')) || 0
      const costNum = Number(String(editCosto).replace(/\D/g, '')) || 0
      const minNum = Number(String(editStockMin).replace(/\D/g, '')) || 0

      if (!editNombre.trim()) throw new Error('El nombre no puede estar vacío')
      if (vtaNum <= 0) throw new Error('El precio de venta debe ser mayor a 0')

      await api.updateProducto(productoParaEditar.id, {
        nombre: editNombre.trim().toUpperCase(),
        precio_venta_menor: vtaNum,
        precio_venta_mayor: vtaNum,
        precio_costo: costNum,
        unidad_medida: editUnidad,
        tipo_inventario: editTipo,
        stock_minimo: minNum
      })

      setExitoEdit(true)
      await fetchInventario(busqueda)
      setTimeout(() => {
        setExitoEdit(false)
        setProductoParaEditar(null)
      }, 1000)
    } catch (err) {
      setErrorEdit(err.message || 'Error al actualizar el producto')
    } finally {
      setGuardandoEdit(false)
    }
  }

  // Función auxiliar para registrar egreso automático en caja si se utilizó dinero
  const registrarEgresoAutomaticoSiAplica = async (filialId, montoTotal, conceptoTexto, medioPago) => {
    if (montoTotal <= 0 || medioPago === 'CREDITO') return
    try {
      const cajas = await api.cajas(filialId)
      const list = Array.isArray(cajas) ? cajas : []
      let apActiva = null
      for (const c of list) {
        try {
          const ap = await api.aperturaActiva(c.id)
          if (ap && ap.id) {
            apActiva = ap
            break
          }
        } catch {
          // continuar
        }
      }
      if (apActiva && apActiva.id) {
        await api.addMovCaja(apActiva.id, {
          tipo: 'EGRESO',
          monto: montoTotal,
          concepto: conceptoTexto,
          medio_pago: medioPago
        })
      }
    } catch (err) {
      console.warn('Aviso: no se pudo asentar el egreso automático en caja:', err)
    }
  }

  // Guardar Entrada de Stock o Nuevo Producto (con Egreso automático en caja)
  const handleGuardarEntradaOProducto = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setErrorModal('')

    try {
      const filialId = user?.filial_id || 1

      if (modoModal === 'EXISTENTE') {
        if (!productoSelId) throw new Error('Selecciona un producto')
        const cant = Number(String(cantidadEntrada).replace(/\D/g, '')) || 0
        const costo = Number(String(precioCosto).replace(/\D/g, '')) || 0
        const venta = Number(String(precioVenta).replace(/\D/g, '')) || 0

        if (cant <= 0) throw new Error('La cantidad debe ser mayor a 0')
        if (venta <= 0) throw new Error('El precio de venta debe ser mayor a 0')

        const prodActual = productos.find(p => String(p.id) === String(productoSelId))
        const prodNombre = prodActual?.nombre || 'Producto'
        const totalCosto = cant * costo

        // 1. Registrar compra para ingresar el stock con su lote
        await api.createCompra({
          proveedor_id: proveedorSel || null,
          filial_id: filialId,
          numero_factura: 'ENTRADA-MOVIL',
          items: [{
            producto_id: productoSelId,
            cantidad: cant,
            costo_unit: costo,
            subtotal: totalCosto,
            iva_tipo: '10'
          }]
        })

        // 2. Actualizar precio de venta y costo
        if (venta > 0) {
          await api.updateProducto(productoSelId, {
            precio_venta_menor: venta,
            precio_venta_mayor: venta,
            precio_costo: costo
          })
        }

        // 3. Registrar EGRESO AUTOMÁTICO de caja
        if (totalCosto > 0) {
          await registrarEgresoAutomaticoSiAplica(
            filialId,
            totalCosto,
            `ENTRADA STOCK: ${prodNombre} (${cant} ${prodActual?.unidad_medida || 'UN'})`,
            medioPagoEntrada
          )
        }

      } else {
        // MODO NUEVO PRODUCTO
        if (!nuevoNombre.trim()) throw new Error('Ingresa el nombre del nuevo producto')
        const cant = Number(String(nuevoCantidad).replace(/\D/g, '')) || 0
        const costo = Number(String(nuevoCosto).replace(/\D/g, '')) || 0
        const venta = Number(String(nuevoVenta).replace(/\D/g, '')) || 0

        if (venta <= 0) throw new Error('El precio de venta debe ser mayor a 0')

        const prodRes = await api.createProducto({
          nombre: nuevoNombre.trim().toUpperCase(),
          tipo_inventario: nuevoTipo,
          unidad_medida: nuevoUnidad,
          precio_costo: costo,
          precio_venta_menor: venta,
          precio_venta_mayor: venta,
          stock_minimo: 3,
          iva_tipo: '10'
        })

        const nuevoId = prodRes.id
        const totalCosto = cant * costo

        if (cant > 0) {
          await api.createCompra({
            proveedor_id: nuevoProveedor || null,
            filial_id: filialId,
            numero_factura: 'STOCK-INICIAL',
            items: [{
              producto_id: nuevoId,
              cantidad: cant,
              costo_unit: costo,
              subtotal: totalCosto,
              iva_tipo: '10'
            }]
          })

          // Registrar EGRESO AUTOMÁTICO de caja
          if (totalCosto > 0) {
            await registrarEgresoAutomaticoSiAplica(
              filialId,
              totalCosto,
              `COMPRA NUEVO PRODUCTO: ${nuevoNombre.trim().toUpperCase()} (${cant} ${nuevoUnidad})`,
              nuevoMedioPago
            )
          }
        }
      }

      setExitoModal(true)
      await fetchInventario(busqueda)
      setTimeout(() => {
        setExitoModal(false)
        setMostrarModalEntrada(false)
        // Reset form
        setProductoSelId('')
        setCantidadEntrada('1')
        setPrecioCosto('')
        setPrecioVenta('')
        setNuevoNombre('')
        setNuevoCantidad('1')
        setNuevoCosto('')
        setNuevoVenta('')
      }, 1200)

    } catch (err) {
      setErrorModal(err.message || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const productoSeleccionadoObj = productos.find(p => String(p.id) === String(productoSelId))

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

      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Botón Principal: Entrada / Nuevo Producto */}
        <button
          onClick={() => {
            setErrorModal('')
            setExitoModal(false)
            setMostrarModalEntrada(true)
          }}
          style={{
            background: 'linear-gradient(135deg, #997a29, #d4af37)',
            color: '#000',
            border: 'none',
            borderRadius: '14px',
            padding: '14px 18px',
            fontSize: '15px',
            fontWeight: '900',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(212, 175, 55, 0.35)'
          }}
        >
          <span>➕</span> Nuevo Producto / Entrada de Stock
        </button>

        {/* Buscador de Producto */}
        <div>
          <input
            type="text"
            placeholder="🔍 Buscar por nombre o código..."
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

        <div style={{ fontSize: '12px', color: '#9ba1a2', fontWeight: '600' }}>
          💡 Toca cualquier producto de la lista para ver o editar sus datos
        </div>

        {/* Lista Táctil de Productos (Clic para editar) */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>Cargando inventario...</div>
          ) : productos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>No se encontraron productos</div>
          ) : (
            productos.map(p => {
              const badge = getStockBadge(p)
              const precioVentaVal = Number(p.precio_venta_menor || p.precio_venta || 0)
              const precioCostoVal = Number(p.precio_costo || 0)

              return (
                <div
                  key={p.id}
                  onClick={() => abrirModalEditar(p)}
                  style={{
                    background: '#1b2326',
                    border: '1px solid #283438',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.nombre}
                        <span style={{ fontSize: '11px', color: '#ffe082', opacity: 0.8 }}>✏️</span>
                      </div>
                      {p.codigo && (
                        <div style={{ fontSize: '11px', color: '#9ba1a2', marginTop: '2px' }}>
                          Código: {p.codigo}
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
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '4px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #283438'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#9ba1a2' }}>PRECIO VENTA:</span>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: '#ffe082' }}>
                        ₲ {precioVentaVal.toLocaleString('es-PY')}
                      </div>
                    </div>

                    {precioCostoVal > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#9ba1a2' }}>COSTO:</span>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#cbd5e1' }}>
                          ₲ {precioCostoVal.toLocaleString('es-PY')}
                        </div>
                      </div>
                    )}

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

      {/* MODAL 1: NUEVO PRODUCTO / ENTRADA DE STOCK (CON EGRESO AUTOMÁTICO EN CAJA) */}
      {mostrarModalEntrada && (
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
            maxHeight: '90vh',
            overflowY: 'auto',
            borderTop: '3px solid #d4af37'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#ffe082', fontSize: '18px', fontWeight: '800' }}>
                Entrada de Stock / Compras
              </h3>
              <button
                onClick={() => setMostrarModalEntrada(false)}
                style={{ background: '#243035', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* Pestañas: EXISTENTE vs NUEVO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setModoModal('EXISTENTE')}
                style={{
                  background: modoModal === 'EXISTENTE' ? '#997a29' : '#141c1f',
                  color: modoModal === 'EXISTENTE' ? '#000' : '#ffe082',
                  border: `1px solid ${modoModal === 'EXISTENTE' ? '#d4af37' : '#283438'}`,
                  borderRadius: '10px',
                  padding: '10px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📦 Entrada a Existente
              </button>
              <button
                type="button"
                onClick={() => setModoModal('NUEVO')}
                style={{
                  background: modoModal === 'NUEVO' ? '#997a29' : '#141c1f',
                  color: modoModal === 'NUEVO' ? '#000' : '#ffe082',
                  border: `1px solid ${modoModal === 'NUEVO' ? '#d4af37' : '#283438'}`,
                  borderRadius: '10px',
                  padding: '10px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ✨ Crear Nuevo Producto
              </button>
            </div>

            {errorModal && (
              <div style={{ color: '#ff8787', fontSize: '13px', marginBottom: '12px', textAlign: 'center', fontWeight: '700' }}>
                ⚠️ {errorModal}
              </div>
            )}

            {exitoModal ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#73e6b2', fontSize: '18px', fontWeight: '800' }}>
                ✅ ¡Guardado y Egreso registrado en Caja!
              </div>
            ) : (
              <form onSubmit={handleGuardarEntradaOProducto} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* MODO 1: ENTRADA A PRODUCTO EXISTENTE */}
                {modoModal === 'EXISTENTE' ? (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                        Selecciona el Producto *
                      </label>
                      <select
                        value={productoSelId}
                        onChange={e => handleSeleccionarProductoExistente(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#121719',
                          border: '1px solid #3a4a50',
                          borderRadius: '10px',
                          padding: '12px',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}
                        required
                      >
                        <option value="">-- Elige un producto --</option>
                        {productos.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} (Stock: {p.stock_actual ?? p.stock ?? p.stock_total ?? 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    {productoSeleccionadoObj && (
                      <div style={{ background: '#121719', padding: '10px 14px', borderRadius: '10px', border: '1px solid #283438', fontSize: '12px', color: '#9ba1a2' }}>
                        Stock actual: <strong style={{ color: '#73e6b2' }}>{productoSeleccionadoObj.stock_actual ?? productoSeleccionadoObj.stock ?? 0} {productoSeleccionadoObj.unidad_medida || 'UN'}</strong>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Cantidad a Ingresar (+) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={cantidadEntrada}
                          onChange={e => setCantidadEntrada(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '16px', fontWeight: '700', boxSizing: 'border-box' }}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Proveedor
                        </label>
                        <select
                          value={proveedorSel}
                          onChange={e => setProveedorSel(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          <option value="">Proveedor Ocasional</option>
                          {proveedores.map(prov => (
                            <option key={prov.id} value={prov.id}>{prov.razon_social || prov.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Precio de Compra (Costo ₲)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={precioCosto}
                          onChange={e => {
                            const num = Number(e.target.value.replace(/\D/g, '')) || 0
                            setPrecioCosto(num ? num.toLocaleString('es-PY') : '')
                          }}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#ffe082', marginBottom: '6px' }}>
                          Precio de Venta (₲) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={precioVenta}
                          onChange={e => {
                            const num = Number(e.target.value.replace(/\D/g, '')) || 0
                            setPrecioVenta(num ? num.toLocaleString('es-PY') : '')
                          }}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '2px solid #997a29', borderRadius: '10px', color: '#ffe082', fontSize: '16px', fontWeight: '900', boxSizing: 'border-box' }}
                          required
                        />
                      </div>
                    </div>

                    {/* Selector de Pago / Egreso de Caja */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#ff9ebb', marginBottom: '6px' }}>
                        💸 Pago de la Compra (Generar Egreso en Caja)
                      </label>
                      <select
                        value={medioPagoEntrada}
                        onChange={e => setMedioPagoEntrada(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#1a1f22',
                          border: '1px solid #9e3646',
                          borderRadius: '10px',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: '700'
                        }}
                      >
                        <option value="EFECTIVO">💵 Efectivo (Descontar de Caja Abierta)</option>
                        <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
                        <option value="CREDITO">📝 A Crédito (No descontar de caja hoy)</option>
                      </select>
                      {medioPagoEntrada !== 'CREDITO' && (
                        <div style={{ fontSize: '11px', color: '#ff9ebb', marginTop: '4px' }}>
                          ℹ️ Se registrará un egreso de ₲ {((Number(String(precioCosto).replace(/\D/g, '')) || 0) * (Number(cantidadEntrada) || 1)).toLocaleString('es-PY')} en la caja del día.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* MODO 2: CREAR NUEVO PRODUCTO */
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                        Nombre del Nuevo Producto *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Antiparasitario NexGard 10-20kg"
                        value={nuevoNombre}
                        onChange={e => setNuevoNombre(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '700', boxSizing: 'border-box' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Categoría / Rubro
                        </label>
                        <select
                          value={nuevoTipo}
                          onChange={e => setNuevoTipo(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          <option value="FARMACIA">💊 Farmacia / Medicamentos</option>
                          <option value="PETSHOP">🐾 Petshop / Alimentos / Accesorios</option>
                          <option value="CLINICA">🩺 Insumos Clínicos</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Unidad de Medida
                        </label>
                        <select
                          value={nuevoUnidad}
                          onChange={e => setNuevoUnidad(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          <option value="UN">Unidad (UN)</option>
                          <option value="KG">Kilogramos (KG)</option>
                          <option value="FRASCO">Frasco</option>
                          <option value="CAJA">Caja</option>
                          <option value="BLISTER">Blister</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Stock Inicial a Ingresar
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="1"
                          value={nuevoCantidad}
                          onChange={e => setNuevoCantidad(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '16px', fontWeight: '700', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Proveedor
                        </label>
                        <select
                          value={nuevoProveedor}
                          onChange={e => setNuevoProveedor(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                        >
                          <option value="">Proveedor Ocasional</option>
                          {proveedores.map(prov => (
                            <option key={prov.id} value={prov.id}>{prov.razon_social || prov.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                          Precio de Compra (Costo ₲)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={nuevoCosto}
                          onChange={e => {
                            const num = Number(e.target.value.replace(/\D/g, '')) || 0
                            setNuevoCosto(num ? num.toLocaleString('es-PY') : '')
                          }}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#ffe082', marginBottom: '6px' }}>
                          Precio de Venta (₲) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={nuevoVenta}
                          onChange={e => {
                            const num = Number(e.target.value.replace(/\D/g, '')) || 0
                            setNuevoVenta(num ? num.toLocaleString('es-PY') : '')
                          }}
                          style={{ width: '100%', padding: '12px', background: '#121719', border: '2px solid #997a29', borderRadius: '10px', color: '#ffe082', fontSize: '16px', fontWeight: '900', boxSizing: 'border-box' }}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#ff9ebb', marginBottom: '6px' }}>
                        💸 Pago de la Compra Inicial (Egreso de Caja)
                      </label>
                      <select
                        value={nuevoMedioPago}
                        onChange={e => setNuevoMedioPago(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#1a1f22',
                          border: '1px solid #9e3646',
                          borderRadius: '10px',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: '700'
                        }}
                      >
                        <option value="EFECTIVO">💵 Efectivo (Descontar de Caja Abierta)</option>
                        <option value="TRANSFERENCIA">🏦 Transferencia Bancaria</option>
                        <option value="CREDITO">📝 A Crédito (No descontar de caja hoy)</option>
                      </select>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    background: 'linear-gradient(135deg, #997a29, #d4af37)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)'
                  }}
                >
                  {guardando ? 'Guardando en Base de Datos...' : '💾 Guardar en Catálogo y Stock'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR INFORMACIÓN DE CUALQUIER PRODUCTO */}
      {productoParaEditar && (
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
            maxHeight: '90vh',
            overflowY: 'auto',
            borderTop: '3px solid #6ed1a7'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#6ed1a7', fontSize: '18px', fontWeight: '800' }}>
                  ✏️ Editar Información de Producto
                </h3>
                <div style={{ fontSize: '12px', color: '#9ba1a2', marginTop: '2px' }}>
                  Stock actual: {productoParaEditar.stock_actual ?? productoParaEditar.stock ?? productoParaEditar.stock_total ?? 0} {productoParaEditar.unidad_medida || 'UN'}
                </div>
              </div>
              <button
                onClick={() => setProductoParaEditar(null)}
                style={{ background: '#243035', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {errorEdit && (
              <div style={{ color: '#ff8787', fontSize: '13px', marginBottom: '12px', textAlign: 'center', fontWeight: '700' }}>
                ⚠️ {errorEdit}
              </div>
            )}

            {exitoEdit ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#73e6b2', fontSize: '18px', fontWeight: '800' }}>
                ✅ ¡Producto actualizado con éxito!
              </div>
            ) : (
              <form onSubmit={handleGuardarEdicionProducto} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#ffe082', marginBottom: '6px' }}>
                      Precio de Venta (₲) *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={Number(String(editVenta).replace(/\D/g, '')) ? Number(String(editVenta).replace(/\D/g, '')).toLocaleString('es-PY') : ''}
                      onChange={e => setEditVenta(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: '#121719', border: '2px solid #997a29', borderRadius: '10px', color: '#ffe082', fontSize: '16px', fontWeight: '900', boxSizing: 'border-box' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      Precio Costo (₲)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={Number(String(editCosto).replace(/\D/g, '')) ? Number(String(editCosto).replace(/\D/g, '')).toLocaleString('es-PY') : ''}
                      onChange={e => setEditCosto(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      Categoría / Rubro
                    </label>
                    <select
                      value={editTipo}
                      onChange={e => setEditTipo(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                    >
                      <option value="FARMACIA">💊 Farmacia</option>
                      <option value="PETSHOP">🐾 Petshop</option>
                      <option value="CLINICA">🩺 Clínica</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                      Unidad de Medida
                    </label>
                    <select
                      value={editUnidad}
                      onChange={e => setEditUnidad(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                    >
                      <option value="UN">Unidad (UN)</option>
                      <option value="KG">Kilogramos (KG)</option>
                      <option value="FRASCO">Frasco</option>
                      <option value="CAJA">Caja</option>
                      <option value="BLISTER">Blister</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                    Stock Mínimo (Alerta de reposición)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editStockMin}
                    onChange={e => setEditStockMin(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: '#121719', border: '1px solid #3a4a50', borderRadius: '10px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={guardandoEdit}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    background: 'linear-gradient(135deg, #2e7d58, #4db687)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(77, 182, 135, 0.4)'
                  }}
                >
                  {guardandoEdit ? 'Guardando...' : '💾 Guardar Cambios del Producto'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
