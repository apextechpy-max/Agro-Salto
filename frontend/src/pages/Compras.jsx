import { useState, useEffect, useRef } from 'react'
import api from '../api'
import Barcode from 'react-barcode'

const fmt = (n) => new Intl.NumberFormat('es-PY').format(Math.round(n || 0))

function Modal({ open, onClose, children, title, size = '' }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const IVA_OPCIONES = ['10', '5', 'EXENTO']
const UNIDADES = ['UNIDAD', 'KG', 'GR', 'LT', 'ML', 'CAJA', 'BOLSA', 'SACO', 'FRASCO', 'AMPOLLA', 'DOSIS']

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [filiales, setFiliales] = useState([])
  const [productos, setProductos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [detalleCompra, setDetalleCompra] = useState(null)
  const [lotesImprimir, setLotesImprimir] = useState(null) // lotes recién generados para imprimir
  const printRef = useRef()

  const [form, setForm] = useState({ proveedor_id: '', filial_id: '1', numero_factura: '', fecha: new Date().toISOString().split('T')[0], observacion: '' })
  const [items, setItems] = useState([{ producto_id: '', cantidad: 1, costo_unit: 0, iva_tipo: '10', subtotal: 0, fecha_vto: '' }])

  // Estados para creación express de producto
  const [showNewProductModal, setShowNewProductModal] = useState(false)
  const [activeItemIdx, setActiveItemIdx] = useState(null)
  const [newProductForm, setNewProductForm] = useState({
    tipo_inventario: 'FARMACIA', nombre: '', descripcion: '',
    unidad_medida: 'UNIDAD', precio_costo: 0, precio_venta_menor: 0,
    precio_venta_mayor: 0, iva_tipo: '10', stock_minimo: 0, requiere_receta: false
  })

  useEffect(() => {
    api.compras().then(setCompras)
    api.personas('?tipo=PROVEEDOR').then(setProveedores)
    api.filiales().then(setFiliales)
    api.productos('?activo=1').then(setProductos)
  }, [])

  const updateItem = (idx, field, value) => {
    if (field === 'producto_id' && value === 'NEW_PRODUCT') {
      setActiveItemIdx(idx)
      const currentItem = items[idx]
      setNewProductForm({
        tipo_inventario: 'FARMACIA',
        nombre: '',
        descripcion: '',
        unidad_medida: 'UNIDAD',
        precio_costo: parseFloat(currentItem?.costo_unit) || 0,
        precio_venta_menor: (parseFloat(currentItem?.costo_unit) || 0) * 1.30, // sugerencia rápida
        precio_venta_mayor: (parseFloat(currentItem?.costo_unit) || 0) * 1.25,
        iva_tipo: currentItem?.iva_tipo || '10',
        stock_minimo: 0,
        requiere_receta: false
      })
      setShowNewProductModal(true)
      return
    }

    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: value }
      if (field === 'producto_id') {
        const p = productos.find(p => p.id === parseInt(value))
        if (p) { updated.costo_unit = p.precio_costo; updated.iva_tipo = p.iva_tipo }
      }
      updated.subtotal = (parseFloat(updated.cantidad) || 0) * (parseFloat(updated.costo_unit) || 0)
      return updated
    }))
  }

  const handleCreateNewProduct = async () => {
    if (!newProductForm.nombre) return
    setLoading(true)
    try {
      const formData = new FormData()
      Object.entries(newProductForm).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, v)
      })

      const result = await api.createProducto(formData)
      const newProdId = result.id
      const newCode = result.codigo

      // Recargar la lista de productos
      const updatedProds = await api.productos('?activo=1')
      setProductos(updatedProds)

      // Seleccionar el nuevo producto en la fila de compras
      setItems(prev => prev.map((it, i) => {
        if (i !== activeItemIdx) return it
        return {
          ...it,
          producto_id: String(newProdId),
          costo_unit: parseFloat(newProductForm.precio_costo) || 0,
          iva_tipo: newProductForm.iva_tipo,
          subtotal: (parseFloat(it.cantidad) || 0) * (parseFloat(newProductForm.precio_costo) || 0)
        }
      }))

      setShowNewProductModal(false)
    } catch (e) {
      alert(`Error al crear el producto: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCloseNewProductModal = () => {
    setShowNewProductModal(false)
    // Deshacer la selección en el item correspondiente
    setItems(prev => prev.map((it, i) => {
      if (i !== activeItemIdx) return it
      return { ...it, producto_id: '' }
    }))
  }

  const addItem = () => setItems(prev => [...prev, { producto_id: '', cantidad: 1, costo_unit: 0, iva_tipo: '10', subtotal: 0, fecha_vto: '' }])
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const total = items.reduce((s, i) => s + i.subtotal, 0)

  const handleSave = async () => {
    if (!items[0].producto_id) return
    setLoading(true); setMsg(null)
    try {
      const result = await api.createCompra({ ...form, items })
      setMsg({ type: 'success', text: '✅ Compra registrada correctamente' })
      api.compras().then(setCompras)
      setShowModal(false)
      setItems([{ producto_id: '', cantidad: 1, costo_unit: 0, iva_tipo: '10', subtotal: 0, fecha_vto: '' }])
      setForm(f => ({ ...f, numero_factura: '', observacion: '' }))

      // Si hay lotes generados, enriquecer con nombre de producto y mostrar modal de impresión
      if (result.lotes && result.lotes.length > 0) {
        const lotesEnriquecidos = result.lotes.map(l => {
          const prod = productos.find(p => p.id === l.productoId)
          return { ...l, productoNombre: prod?.nombre || `Prod. #${l.productoId}` }
        })
        setLotesImprimir(lotesEnriquecidos)
      }
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
    finally { setLoading(false) }
  }

  const handlePrint = () => {
    const printContent = printRef.current
    const w = window.open('', '_blank')
    w.document.write(`
      <html>
        <head>
          <title>Etiquetas de Lote</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 10px; background: #fff; }
            .etiquetas { display: flex; flex-wrap: wrap; gap: 12px; }
            .etiqueta { border: 1px solid #333; padding: 8px 12px; border-radius: 4px; width: 200px; text-align: center; page-break-inside: avoid; }
            .etiqueta .nombre { font-weight: 700; font-size: 10px; margin-bottom: 4px; line-height: 1.2; }
            .etiqueta .cod-lote { font-size: 11px; font-weight: 900; color: #1a1a1a; margin: 2px 0; }
            .etiqueta .vto { font-size: 9px; color: #666; margin-top: 4px; }
            svg { max-width: 100%; }
            @media print { body { margin: 0; } .etiquetas { gap: 8px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 500)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📥 Compras</div>
          <div className="page-subtitle">Registro de compras a proveedores</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nueva Compra</button>
      </div>

      {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>#</th><th>Proveedor</th><th>Factura</th><th>Fecha</th><th>Total</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {compras.map(c => (
              <tr key={c.id}>
                <td style={{ color: 'var(--text-muted)' }}>#{c.id}</td>
                <td>{c.proveedor_nombre || '—'}</td>
                <td>{c.numero_factura || '—'}</td>
                <td>{c.fecha}</td>
                <td style={{ fontWeight: 700 }}>₲ {fmt(c.total)}</td>
                <td><span className={`badge badge-${c.estado === 'PAGADA' ? 'green' : c.estado === 'ANULADA' ? 'red' : 'gold'}`}>{c.estado}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={async () => { const d = await api.getCompra(c.id); setDetalleCompra(d) }}>Ver</button>
                    {c.estado === 'PENDIENTE' && (
                      <button className="btn btn-primary btn-sm" onClick={async () => { await api.estadoCompra(c.id, 'PAGADA'); api.compras().then(setCompras) }}>Pagar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {compras.length === 0 && <div className="empty-state"><div className="empty-icon">📥</div><p>Sin compras registradas</p></div>}
      </div>

      {/* Modal Nueva Compra */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Compra" size="modal-xl">
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Proveedor</label>
              <select value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                <option value="">Sin proveedor</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sucursal</label>
              <select value={form.filial_id} onChange={e => setForm(f => ({ ...f, filial_id: e.target.value }))}>
                {filiales.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nro. Factura</label>
              <input value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} placeholder="001-001-0000001" />
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 12, fontWeight: 700 }}>Ítems de Compra
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
              — Se generará un Código de Lote automático por cada ítem
            </span>
          </div>

          {/* Header de columnas */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 1fr auto', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Producto</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Cantidad</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Costo Unit. (₲)</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>IVA</span>
            <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>📅 Vto. (opcional)</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Subtotal</span>
            <span></span>
          </div>

          {items.map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <select value={it.producto_id} onChange={e => updateItem(idx, 'producto_id', e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="NEW_PRODUCT" style={{ fontWeight: 'bold', color: 'var(--green-primary)' }}>+ CREAR NUEVO PRODUCTO...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input type="number" value={it.cantidad} min="0" step="0.01" onChange={e => updateItem(idx, 'cantidad', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input type="number" value={it.costo_unit} min="0" onChange={e => updateItem(idx, 'costo_unit', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <select value={it.iva_tipo} onChange={e => updateItem(idx, 'iva_tipo', e.target.value)}>
                  {IVA_OPCIONES.map(o => <option key={o} value={o}>{o}%</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  type="date"
                  value={it.fecha_vto}
                  onChange={e => updateItem(idx, 'fecha_vto', e.target.value)}
                  style={{ borderColor: it.fecha_vto ? 'var(--gold)' : undefined }}
                />
              </div>
              <div style={{ padding: '9px 0', fontWeight: 700, color: 'var(--green-primary)' }}>₲ {fmt(it.subtotal)}</div>
              <button className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>🗑</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Agregar ítem</button>

          <div style={{ textAlign: 'right', marginTop: 16, fontSize: 18, fontWeight: 800, color: 'var(--green-primary)' }}>
            TOTAL: ₲ {fmt(total)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Guardando...' : '✓ Registrar Compra'}</button>
        </div>
      </Modal>

      {/* Modal Ver Detalle */}
      <Modal open={!!detalleCompra} onClose={() => setDetalleCompra(null)} title={`Compra #${detalleCompra?.id}`} size="modal-lg">
        {detalleCompra && (
          <div className="modal-body">
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div><strong>Proveedor:</strong> {detalleCompra.proveedor_nombre}</div>
              <div><strong>Factura:</strong> {detalleCompra.numero_factura || '—'}</div>
              <div><strong>Fecha:</strong> {detalleCompra.fecha}</div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>Costo Unit.</th><th>IVA</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {detalleCompra.detalle?.map((d, i) => (
                    <tr key={i}>
                      <td>{d.producto_nombre}</td>
                      <td>{d.cantidad}</td>
                      <td>₲ {fmt(d.costo_unit)}</td>
                      <td>{d.iva_tipo}%</td>
                      <td>₲ {fmt(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16, fontSize: 18, fontWeight: 800 }}>TOTAL: ₲ {fmt(detalleCompra.total)}</div>
          </div>
        )}
      </Modal>

      {/* Modal Imprimir Etiquetas de Lote */}
      <Modal open={!!lotesImprimir} onClose={() => setLotesImprimir(null)} title="🖨 Etiquetas de Lote Generadas" size="modal-lg">
        {lotesImprimir && (
          <div className="modal-body">
            <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              Los siguientes lotes fueron creados. Imprime las etiquetas y pégalas en los productos.
            </div>

            {/* Área de impresión oculta */}
            <div ref={printRef} style={{ display: 'none' }}>
              <div className="etiquetas">
                {lotesImprimir.map(l => (
                  <div key={l.loteId} className="etiqueta">
                    <div className="nombre">{l.productoNombre}</div>
                    <svg id={`barcode-print-${l.loteId}`}></svg>
                    <div className="cod-lote">{l.codigoLote}</div>
                    {l.fechaVto && <div className="vto">VTO: {l.fechaVto}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Vista previa visible */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
              {lotesImprimir.map(l => (
                <div key={l.loteId} style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  textAlign: 'center',
                  minWidth: 200,
                  background: 'var(--bg-card)'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, color: 'var(--text-primary)' }}>
                    {l.productoNombre}
                  </div>
                  <Barcode
                    value={l.codigoLote}
                    width={1.5}
                    height={50}
                    fontSize={11}
                    background="transparent"
                    lineColor="#ffffff"
                  />
                  <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--green-primary)', marginTop: 4 }}>
                    {l.codigoLote}
                  </div>
                  {l.fechaVto && (
                    <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>
                      VTO: {l.fechaVto}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    Cantidad: {l.cantidad} unid.
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setLotesImprimir(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={handlePrint}>🖨 Imprimir Etiquetas</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Crear Producto Express desde Compra */}
      <Modal open={showNewProductModal} onClose={handleCloseNewProductModal} title="Crear Nuevo Producto">
        <div className="modal-body">
          <div className="form-group">
            <label>Nombre *</label>
            <input 
              value={newProductForm.nombre} 
              onChange={e => setNewProductForm(f => ({ ...f, nombre: e.target.value.toUpperCase() }))} 
              placeholder="Ej: BALANCEADO CANINO 15KG" 
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Categoría</label>
              <select value={newProductForm.tipo_inventario} onChange={e => setNewProductForm(f => ({ ...f, tipo_inventario: e.target.value }))}>
                <option value="FARMACIA">Farmacia (FAR)</option>
                <option value="CLINICA">Clínica (CLI)</option>
                <option value="PETSHOP">Petshop (PET)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Unidad de Medida</label>
              <select value={newProductForm.unidad_medida} onChange={e => setNewProductForm(f => ({ ...f, unidad_medida: e.target.value }))}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>IVA</label>
              <select value={newProductForm.iva_tipo} onChange={e => setNewProductForm(f => ({ ...f, iva_tipo: e.target.value }))}>
                <option value="10">10%</option>
                <option value="5">5%</option>
                <option value="EXENTO">Exento</option>
              </select>
            </div>
            <div className="form-group">
              <label>Stock Mínimo</label>
              <input type="number" value={newProductForm.stock_minimo} onChange={e => setNewProductForm(f => ({ ...f, stock_minimo: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label>Precio Costo (₲) *</label>
              <input type="number" value={newProductForm.precio_costo} onChange={e => setNewProductForm(f => ({ ...f, precio_costo: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label>Precio Minorista (₲) *</label>
              <input type="number" value={newProductForm.precio_venta_menor} onChange={e => setNewProductForm(f => ({ ...f, precio_venta_menor: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label>Precio Mayorista (₲) *</label>
              <input type="number" value={newProductForm.precio_venta_mayor} onChange={e => setNewProductForm(f => ({ ...f, precio_venta_mayor: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={newProductForm.requiere_receta} onChange={e => setNewProductForm(f => ({ ...f, requiere_receta: e.target.checked }))} style={{ width: 'auto' }} />
              Requiere receta médica
            </label>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCloseNewProductModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleCreateNewProduct} disabled={!newProductForm.nombre || loading}>
            {loading ? 'Creando...' : '✓ Crear y Seleccionar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
