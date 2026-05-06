import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

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

export default function Ventas() {
  const { user } = useAuth()
  const filial_id = user?.filial_id || 1

  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [buscar, setBuscar] = useState('')
  const [cart, setCart] = useState([])
  const [tipo, setTipo] = useState('MINORISTA')
  const [clienteId, setClienteId] = useState('')
  const [tipoPago, setTipoPago] = useState('CONTADO')
  const [montoPagado, setMontoPagado] = useState('')
  const [obs, setObs] = useState('')
  const [msg, setMsg] = useState(null)
  const [historial, setHistorial] = useState([])
  const [preVentas, setPreVentas] = useState([])
  const [tab, setTab] = useState('pos')
  const [loading, setLoading] = useState(false)
  const [detalleVenta, setDetalleVenta] = useState(null)
  const [preVentaCobroActiva, setPreVentaCobroActiva] = useState(null)
  const [apertura, setApertura] = useState(null)
  const [monedaPago, setMonedaPago] = useState('GS')
  const [comprobantePago, setComprobantePago] = useState('')

  useEffect(() => {
    api.productos(`?activo=1`).then(setProductos)
    api.personas('?tipo=CLIENTE').then(setClientes)
    loadHistorial()
    loadPreVentas()
    loadApertura()
  }, [])

  const loadApertura = async () => {
    // Buscamos cajas de la filial y luego la apertura activa de la primera caja que encontremos
    try {
      const cajas = await api.cajas(user?.filial_id)
      if (cajas.length > 0) {
        const a = await api.aperturaActiva(cajas[0].id)
        setApertura(a)
      }
    } catch (e) { console.error("Error loading apertura", e) }
  }

  const loadHistorial = () => api.ventas().then(setHistorial)
  const loadPreVentas = () => api.preVentasPendientes().then(setPreVentas)

  const prodFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    p.codigo.toLowerCase().includes(buscar.toLowerCase())
  )

  const addToCart = (p, lote_id = null, lote_codigo = null) => {
    if (p.stock_total <= 0 && !lote_id) return
    setCart(prev => {
      // Si hay lote, agrupamos por lote. Si no, agrupamos por producto.
      const ex = prev.find(i => lote_id ? i.lote_id === lote_id : i.producto_id === p.id)
      if (ex) return prev.map(i => (lote_id ? i.lote_id === lote_id : i.producto_id === p.id) ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, {
        producto_id: p.id || p.producto_id, 
        nombre: p.nombre, 
        codigo: p.codigo,
        lote_id: lote_id,
        lote_codigo: lote_codigo,
        cantidad: 1, 
        iva_tipo: p.iva_tipo,
        precio_unit: tipo === 'MAYORISTA' ? p.precio_venta_mayor : p.precio_venta_menor,
        stock_max: lote_id ? p.cantidad_act : p.stock_total
      }]
    })
  }

  const handleScanner = async (e) => {
    if (e.key === 'Enter' && buscar.trim() !== '') {
      e.preventDefault();
      const code = buscar.trim().toUpperCase();
      setBuscar(''); // limpiar input rápido
      
      // Si parece código de lote (L-XXXX-XX)
      if (code.startsWith('L-')) {
        try {
          const lote = await api.buscarPorCodigoLote(code);
          addToCart(lote, lote.id, lote.codigo_lote);
          setMsg({ type: 'success', text: `✅ ${lote.nombre} (Lote: ${code}) agregado` });
        } catch (error) {
          setMsg({ type: 'error', text: `❌ ${error.message}` });
        }
      } else {
        // Buscar producto normal
        const p = productos.find(x => x.codigo.toUpperCase() === code);
        if (p) {
          addToCart(p);
          setMsg({ type: 'success', text: `✅ ${p.nombre} agregado` });
        } else {
          setMsg({ type: 'error', text: `❌ Código no encontrado: ${code}` });
        }
      }
    }
  }

  const updateCantidad = (idx, delta) => {
    setCart(prev => prev.map((i, currentIdx) => {
      if (currentIdx !== idx) return i
      const nueva = i.cantidad + delta
      if (nueva <= 0) return null
      if (nueva > i.stock_max) return i
      return { ...i, cantidad: nueva }
    }).filter(Boolean))
  }

  const removeItem = (idx) => setCart(prev => prev.filter((_, i) => i !== idx))

  const subtotal = cart.reduce((s, i) => s + i.cantidad * i.precio_unit, 0)
  const total = subtotal

  const getMontoRecibidoGS = () => {
    if (!montoPagado) return 0
    if (monedaPago === 'GS') return parseFloat(montoPagado)
    const rate = monedaPago === 'USD' ? apertura?.cambio_usd :
                 monedaPago === 'BRL' ? apertura?.cambio_brl :
                 monedaPago === 'ARS' ? apertura?.cambio_ars : 1
    return parseFloat(montoPagado) * (rate || 1)
  }

  const vuelto = tipoPago === 'CONTADO' && montoPagado ? Math.max(0, getMontoRecibidoGS() - total) : 0

  const handleVenta = async (esPresupuesto = false) => {
    if (!cart.length) return
    setLoading(true); setMsg(null)
    try {
      const result = await api.createVenta({
        tipo: esPresupuesto ? 'PRESUPUESTO' : tipo,
        cliente_id: clienteId || null,
        filial_id: user.filial_id,
        items: cart,
        tipo_pago: tipoPago,
        monto_pagado: parseFloat(montoPagado) || total,
        descuento_global: 0,
        observacion: obs,
        comprobante_pago: comprobantePago,
        moneda_pago: monedaPago
      })
      setMsg({ type: 'success', text: `✅ ${esPresupuesto ? 'Presupuesto' : 'Venta'} #${result.id} registrada. Vuelto: ₲ ${fmt(result.vuelto)}` })
      setCart([]); setMontoPagado(''); setObs('')
      loadHistorial()
      api.productos('?activo=1').then(setProductos)
    } catch (e) {
      setMsg({ type: 'error', text: `❌ ${e.message}` })
    } finally { setLoading(false) }
  }

  const handleCobroPreVenta = async () => {
    setLoading(true); setMsg(null)
    try {
      const result = await api.cobrarPreVenta(preVentaCobroActiva.id, {
        tipo_pago: tipoPago,
        monto_pagado: parseFloat(montoPagado) || preVentaCobroActiva.total,
        observacion: obs,
        comprobante_pago: comprobantePago,
        moneda_pago: monedaPago
      })
      setMsg({ type: 'success', text: `✅ Pre-Venta #${result.id} cobrada. Vuelto: ₲ ${fmt(result.vuelto)}` })
      setPreVentaCobroActiva(null); setMontoPagado(''); setObs(''); setComprobantePago(''); setMonedaPago('GS')
      loadHistorial(); loadPreVentas()
    } catch (e) {
      setMsg({ type: 'error', text: `❌ ${e.message}` })
    } finally { setLoading(false) }
  }

  const anularVenta = async (id) => {
    if (!confirm('¿Anular esta venta?')) return
    try { await api.anularVenta(id); loadHistorial() } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🛒 Ventas & Caja Médica</div>
          <div className="page-subtitle">Punto de venta y cobro de pre-ventas</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'pos' ? 'active' : ''}`} onClick={() => setTab('pos')}>Punto de Venta</button>
        <button className={`tab ${tab === 'pre-ventas' ? 'active' : ''}`} onClick={() => { setTab('pre-ventas'); loadPreVentas() }}>
          Pre-Ventas Pendientes {preVentas.length > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{preVentas.length}</span>}
        </button>
        <button className={`tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => { setTab('historial'); loadHistorial() }}>Historial</button>
      </div>

      {tab === 'pos' && (
        <div className="pos-layout">
          {/* Productos */}
          <div className="pos-products">
            <div className="search-bar">
              <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: 160 }}>
                <option value="MINORISTA">Minorista</option>
                <option value="MAYORISTA">Mayorista</option>
              </select>
              <div className="search-input-wrap" style={{ flex: 1 }}>
                <span className="search-icon">🔍</span>
                <input 
                  placeholder="Escanea etiqueta de Lote o busca..." 
                  value={buscar} 
                  onChange={e => setBuscar(e.target.value)} 
                  onKeyDown={handleScanner}
                  style={{ paddingLeft: 36 }} 
                  autoFocus
                />
              </div>
            </div>
            {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
            <div className="product-grid">
              {prodFiltrados.map(p => (
                <div key={p.id} className={`product-tile ${p.stock_total <= 0 ? 'no-stock' : ''}`} onClick={() => addToCart(p)}>
                  <div className="ptile-name">{p.nombre}</div>
                  <div className="ptile-price">₲ {fmt(tipo === 'MAYORISTA' ? p.precio_venta_mayor : p.precio_venta_menor)}</div>
                  <div className="ptile-stock">Stock: {p.stock_total} {p.unidad_medida}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge badge-${p.iva_tipo === 'EXENTO' ? 'gray' : 'green'}`} style={{ fontSize: 10 }}>IVA {p.iva_tipo}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Carrito */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🛍️ Carrito ({cart.length})</div>

            <div className="pos-cart-items" style={{ maxHeight: 300 }}>
              {cart.length === 0 && <div className="empty-state" style={{ padding: 30 }}><div>Sin productos</div></div>}
              {cart.map((item, idx) => (
                <div key={item.lote_id ? `lote-${item.lote_id}-${idx}` : `prod-${item.producto_id}-${idx}`} className="cart-item">
                  <div className="cart-item-name">
                    <div style={{ fontSize: 12 }}>{item.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.codigo} {item.lote_codigo && <span style={{ color: 'var(--gold)', fontWeight: 700, marginLeft: 4 }}>[{item.lote_codigo}]</span>} — ₲ {fmt(item.precio_unit)} c/u
                    </div>
                  </div>
                  <div className="cart-qty-ctrl">
                    <button onClick={() => updateCantidad(idx, -1)}>−</button>
                    <span>{item.cantidad}</span>
                    <button onClick={() => updateCantidad(idx, 1)}>+</button>
                  </div>
                  <div style={{ minWidth: 80, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>₲ {fmt(item.cantidad * item.precio_unit)}</div>
                  <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>🗑</button>
                </div>
              ))}
            </div>

            <div className="pos-totals">
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Cliente</label>
                <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
                  <option value="">Consumidor Final</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Forma de Pago</label>
                <select value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
                  <option value="CONTADO">Efectivo</option>
                  <option value="TARJETA">Tarjeta (Débito/Crédito)</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CREDITO">Crédito</option>
                  <option value="MIXTO">Mixto</option>
                </select>
              </div>
              
              {tipoPago === 'TARJETA' && (
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>N° Comprobante / Voucher</label>
                  <input className="form-input" value={comprobantePago} onChange={e => setComprobantePago(e.target.value)} placeholder="Ej: 456789" />
                </div>
              )}

              {tipoPago === 'CONTADO' && (
                <div className="form-row" style={{ gap: 8, marginBottom: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Moneda</label>
                    <select value={monedaPago} onChange={e => setMonedaPago(e.target.value)}>
                      <option value="GS">₲ Guaraníes</option>
                      <option value="USD">$ Dólares</option>
                      <option value="BRL">R$ Reales</option>
                      <option value="ARS">$ Pesos</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Monto Recibido</label>
                    <input type="number" value={montoPagado} onChange={e => setMontoPagado(e.target.value)} placeholder={fmt(total)} />
                  </div>
                </div>
              )}
              <div className="pos-totals-v2">
                <div className="currency-grid">
                  <div className="currency-box py">
                    <span className="cur-label">Total Gs:</span>
                    <div className="cur-val">🇵🇾 {fmt(total)}</div>
                  </div>
                  {apertura && (
                    <>
                      <div className="currency-box br">
                        <span className="cur-label">Total Rs:</span>
                        <div className="cur-val">🇧🇷 {((total / (apertura.cambio_brl || 1)).toFixed(2))}</div>
                      </div>
                      <div className="currency-box us">
                        <span className="cur-label">Total Us:</span>
                        <div className="cur-val">🇺🇸 {((total / (apertura.cambio_usd || 1)).toFixed(2))}</div>
                      </div>
                      <div className="currency-box ar">
                        <span className="cur-label">Total Ps:</span>
                        <div className="cur-val">🇦🇷 {((total / (apertura.cambio_ars || 1)).toFixed(0))}</div>
                      </div>
                    </>
                  )}
                </div>
                {vuelto > 0 && (
                   <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 6, border: '1px solid var(--gold)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: 13, fontWeight: 600 }}>Vuelto:</span>
                     <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gold)' }}>₲ {fmt(vuelto)}</span>
                   </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleVenta(true)} disabled={!cart.length || loading}>📋 Presupuesto</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleVenta(false)} disabled={!cart.length || loading}>
                  {loading ? '...' : '✓ Confirmar Venta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'pre-ventas' && (
        <div>
          {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th># Venta</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Observación</th><th>Estado</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {preVentas.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: 30 }}>Sin pre-ventas pendientes</td></tr>}
                {preVentas.map(v => (
                  <tr key={v.id}>
                    <td>#{v.id}</td>
                    <td>{new Date(v.fecha).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{v.cliente_nombre || 'Consumidor Final'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green-primary)' }}>₲ {fmt(v.total)}</td>
                    <td style={{ fontSize: 12 }}>{v.observacion}</td>
                    <td><span className="estado-badge estado-en_curso">PENDIENTE COBRO</span></td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={async () => { const d = await api.getVenta(v.id); setPreVentaCobroActiva(d) }}>💸 Cobrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Pago</th><th>Total</th><th>Estado</th><th>Usuario</th><th></th>
                </tr>
              </thead>
              <tbody>
                {historial.map(v => (
                  <tr key={v.id}>
                    <td style={{ color: 'var(--text-muted)' }}>#{v.id}</td>
                    <td>{new Date(v.fecha).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{v.cliente_nombre || 'Consumidor Final'}</td>
                    <td><span className={`badge badge-${v.tipo === 'MAYORISTA' ? 'blue' : 'green'}`}>{v.tipo}</span></td>
                    <td>{v.tipo_pago}</td>
                    <td style={{ fontWeight: 700 }}>₲ {fmt(v.total)}</td>
                    <td><span className={`badge badge-${v.estado === 'COMPLETADA' ? 'green' : v.estado === 'ANULADA' ? 'red' : 'gold'}`}>{v.estado}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.usuario_nombre}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={async () => { const d = await api.getVenta(v.id); setDetalleVenta(d) }}>Ver</button>
                        {v.estado === 'COMPLETADA' && <button className="btn btn-danger btn-sm" onClick={() => anularVenta(v.id)}>Anular</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!detalleVenta} onClose={() => setDetalleVenta(null)} title={`Venta #${detalleVenta?.id}`} size="modal-lg">
        {detalleVenta && (
          <div className="modal-body">
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div><strong>Cliente:</strong> {detalleVenta.cliente_nombre || 'Consumidor Final'}</div>
              <div><strong>Fecha:</strong> {new Date(detalleVenta.fecha).toLocaleString('es-PY')}</div>
              <div><strong>Estado:</strong> <span className={`badge badge-${detalleVenta.estado === 'COMPLETADA' ? 'green' : 'red'}`}>{detalleVenta.estado}</span></div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Producto</th><th>Cant.</th><th>Precio Unit.</th><th>IVA</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {detalleVenta.detalle?.map((d, i) => (
                    <tr key={i}>
                      <td>{d.producto_nombre}</td>
                      <td>{d.cantidad}</td>
                      <td>₲ {fmt(d.precio_unit)}</td>
                      <td>{d.iva_tipo}%</td>
                      <td>₲ {fmt(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16, fontSize: 18, fontWeight: 800, color: 'var(--green-primary)' }}>
              TOTAL: ₲ {fmt(detalleVenta.total)}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Cobrar Pre-Venta */}
      <Modal open={!!preVentaCobroActiva} onClose={() => setPreVentaCobroActiva(null)} title="💸 Procesar Cobro de Pre-Venta">
        {preVentaCobroActiva && (
          <div className="modal-body">
            <div style={{ background: 'var(--bg-hover)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <div><strong>Pre-Venta:</strong> #{preVentaCobroActiva.id}</div>
              <div><strong>Cliente:</strong> {preVentaCobroActiva.cliente_nombre || 'Consumidor Final'}</div>
              <div className="currency-grid" style={{ marginBottom: 12 }}>
                <div className="currency-box py">
                  <span className="cur-label">Total Gs:</span>
                  <div className="cur-val">🇵🇾 {fmt(preVentaCobroActiva.total)}</div>
                </div>
                {apertura && (
                  <>
                    <div className="currency-box br">
                      <span className="cur-label">Total Rs:</span>
                      <div className="cur-val">🇧🇷 {((preVentaCobroActiva.total / (apertura.cambio_brl || 1)).toFixed(2))}</div>
                    </div>
                    <div className="currency-box us">
                      <span className="cur-label">Total Us:</span>
                      <div className="cur-val">🇺🇸 {((preVentaCobroActiva.total / (apertura.cambio_usd || 1)).toFixed(2))}</div>
                    </div>
                    <div className="currency-box ar">
                      <span className="cur-label">Total Ps:</span>
                      <div className="cur-val">🇦🇷 {((preVentaCobroActiva.total / (apertura.cambio_ars || 1)).toFixed(0))}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Forma de Pago</label>
              <select className="form-input" value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
                <option value="CONTADO">Efectivo</option>
                <option value="TARJETA">Tarjeta (Débito/Crédito)</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </div>

            {tipoPago === 'TARJETA' && (
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>N° Comprobante / Voucher</label>
                <input className="form-input" value={comprobantePago} onChange={e => setComprobantePago(e.target.value)} placeholder="Ej: 456789" />
              </div>
            )}
            
            {tipoPago === 'CONTADO' && (
              <div className="form-row" style={{ gap: 8, marginBottom: 10 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Moneda</label>
                  <select className="form-input" value={monedaPago} onChange={e => setMonedaPago(e.target.value)}>
                    <option value="GS">₲ Guaraníes</option>
                    <option value="USD">$ Dólares</option>
                    <option value="BRL">R$ Reales</option>
                    <option value="ARS">$ Pesos</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Monto Recibido</label>
                  <input type="number" className="form-input" value={montoPagado} onChange={e => setMontoPagado(e.target.value)} placeholder={fmt(preVentaCobroActiva.total)} />
                </div>
              </div>
            )}
            
            {tipoPago === 'CONTADO' && parseFloat(montoPagado) > 0 && (
              <div style={{ marginBottom: 10 }}>
                {monedaPago === 'GS' ? (
                  parseFloat(montoPagado) > preVentaCobroActiva.total && (
                    <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13 }}>
                      Vuelto a entregar: ₲ {fmt(parseFloat(montoPagado) - preVentaCobroActiva.total)}
                    </div>
                  )
                ) : (
                  <div style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 12 }}>
                    Equivalente en ₲: {fmt(parseFloat(montoPagado) * (monedaPago === 'USD' ? apertura.cambio_usd : monedaPago === 'BRL' ? apertura.cambio_brl : apertura.cambio_ars))}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Observación (Opcional)</label>
              <input className="form-input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ej: Pago con 100 USD" />
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setPreVentaCobroActiva(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCobroPreVenta} disabled={loading}>
                {loading ? 'Procesando...' : '💰 Confirmar Cobro'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
