import { useState, useEffect } from 'react'
import api from '../api'

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

export default function Stock() {
  const [stock, setStock] = useState([])
  const [alertas, setAlertas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [filiales, setFiliales] = useState([])
  const [buscar, setBuscar] = useState('')
  const [tab, setTab] = useState('stock')
  const [modalBaja, setModalBaja] = useState(null)
  const [modalTransf, setModalTransf] = useState(false)
  const [transf, setTransf] = useState({ producto_id: '', filial_origen: '', filial_destino: '', cantidad: 1, observacion: '' })
  const [baja, setBaja] = useState({ cantidad: 1, motivo: 'DAÑADO', lote_id: '' })
  const [lotesProducto, setLotesProducto] = useState([])
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (modalBaja && modalBaja.producto_id) {
      api.getProducto(modalBaja.producto_id).then(p => {
        const lotesFilial = (p.lotes || []).filter(l => l.filial_id === modalBaja.filial_id && l.estado === 'ACTIVO' && Number(l.cantidad_act) > 0);
        setLotesProducto(lotesFilial);
        
        if (modalBaja.lote_id) {
          setBaja({ 
            cantidad: modalBaja.cantidad_lote || 1, 
            motivo: 'VENCIDO', 
            lote_id: modalBaja.lote_id 
          });
        } else {
          setBaja({ 
            cantidad: 1, 
            motivo: 'DAÑADO', 
            lote_id: lotesFilial.length > 0 ? lotesFilial[0].id : '' 
          });
        }
      }).catch(e => console.error('Error cargando lotes del producto:', e));
    } else {
      setLotesProducto([]);
    }
  }, [modalBaja])

  const load = () => {
    api.stock().then(setStock)
    api.alertasVto().then(setAlertas)
    api.filiales().then(setFiliales)
  }

  useEffect(() => { load(); api.movimientosStock().then(setMovimientos) }, [])

  const stockFiltrado = stock.filter(s =>
    s.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    s.codigo.toLowerCase().includes(buscar.toLowerCase())
  )

  const doTransf = async () => {
    try {
      await api.transferencia({ ...transf, filial_origen: parseInt(transf.filial_origen), filial_destino: parseInt(transf.filial_destino), cantidad: parseFloat(transf.cantidad) })
      setMsg({ type: 'success', text: '✅ Transferencia realizada' })
      setModalTransf(false); load()
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const doBaja = async () => {
    try {
      await api.bajaStock({ 
        producto_id: modalBaja.producto_id, 
        filial_id: modalBaja.filial_id, 
        cantidad: parseFloat(baja.cantidad), 
        motivo: baja.motivo,
        lote_id: baja.lote_id || null
      })
      setMsg({ type: 'success', text: '✅ Baja registrada' })
      setModalBaja(null); load()
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const estadoColor = (e) => ({ 'NORMAL': 'green', 'CRITICO': 'gold', 'SIN_STOCK': 'red' }[e] || 'gray')

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📦 Stock e Inventario</div>
          <div className="page-subtitle">Control de existencias y movimientos</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setModalTransf(true)}>↔️ Transferir</button>
        </div>
      </div>

      {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      {alertas.length > 0 && (
        <div className="alert alert-warning">
          ⚠️ <strong>{alertas.length} lote(s)</strong> próximos a vencer. Revisá las alertas de vencimiento.
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>Inventario Actual</button>
        <button className={`tab ${tab === 'alertas' ? 'active' : ''}`} onClick={() => setTab('alertas')}>
          ⚠️ Vencimientos {alertas.length > 0 && <span className="nav-badge" style={{ marginLeft: 4 }}>{alertas.length}</span>}
        </button>
        <button className={`tab ${tab === 'movimientos' ? 'active' : ''}`} onClick={() => { setTab('movimientos'); api.movimientosStock().then(setMovimientos) }}>Movimientos</button>
      </div>

      {tab === 'stock' && (
        <>
          <div className="search-bar">
            <div className="search-input-wrap" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Buscar producto..." value={buscar} onChange={e => setBuscar(e.target.value)} style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Filial</th><th>Stock</th><th>Mínimo</th><th>Estado</th><th>Próximo Vto.</th><th>Precio Costo</th><th></th></tr>
              </thead>
              <tbody>
                {stockFiltrado.map((s, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.codigo}</td>
                    <td style={{ fontWeight: 500 }}>{s.nombre}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.categoria_nombre}</td>
                    <td>{s.filial_nombre}</td>
                    <td style={{ fontWeight: 700 }}>{s.cantidad} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.unidad_medida}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.stock_minimo}</td>
                    <td><span className={`badge badge-${estadoColor(s.estado_stock)}`}>{s.estado_stock}</span></td>
                    <td style={{ color: s.proximo_vencimiento ? (new Date(s.proximo_vencimiento) - new Date() <= 30 * 86400000 ? 'var(--red)' : 'var(--text-muted)') : 'var(--text-muted)', fontWeight: new Date(s.proximo_vencimiento) - new Date() <= 30 * 86400000 ? 'bold' : 'normal' }}>
                      {s.proximo_vencimiento || '—'}
                    </td>
                    <td>₲ {fmt(s.precio_costo)}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => setModalBaja({ producto_id: s.id, filial_id: s.filial_id, nombre: s.nombre })}>
                        Dar de Baja
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stockFiltrado.length === 0 && <div className="empty-state"><div className="empty-icon">📦</div><p>Sin resultados</p></div>}
          </div>
        </>
      )}

      {tab === 'alertas' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Producto</th><th>Lote</th><th>Filial</th><th>Vencimiento</th><th>Días</th><th>Cantidad</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {alertas.map((a, i) => (
                <tr key={i}>
                  <td>{a.producto_nombre}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{a.numero_lote || '—'}</td>
                  <td>{a.filial_nombre}</td>
                  <td>{a.fecha_vto ? a.fecha_vto.slice(0, 10) : '—'}</td>
                  <td>
                    <span className={`badge badge-${a.dias_restantes <= 5 ? 'red' : a.dias_restantes <= 15 ? 'gold' : 'blue'}`}>
                      {a.dias_restantes <= 0 ? '⚠️ VENCIDO' : `${a.dias_restantes} días`}
                    </span>
                  </td>
                  <td>{a.cantidad_act}</td>
                  <td><span className="badge badge-gold">{a.estado}</span></td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => setModalBaja({ producto_id: a.producto_id, filial_id: a.filial_id, nombre: a.producto_nombre, lote_id: a.id, lote_nombre: a.numero_lote, cantidad_lote: Number(a.cantidad_act) })}>
                      Dar de Baja
                    </button>
                  </td>
                </tr>
              ))}
              {alertas.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state" style={{ padding: 30 }}><div>✅ Sin alertas de vencimiento</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movimientos' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Origen</th><th>Destino</th><th>Observación</th><th>Usuario</th></tr>
            </thead>
            <tbody>
              {movimientos.map((m, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>{new Date(m.fecha).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td><span className={`badge badge-${m.tipo === 'COMPRA' ? 'green' : m.tipo === 'VENTA' ? 'blue' : m.tipo === 'BAJA' ? 'red' : 'gold'}`}>{m.tipo}</span></td>
                  <td>{m.producto_nombre} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({m.codigo})</span></td>
                  <td style={{ fontWeight: 700 }}>{m.cantidad}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{m.filial_origen_nombre || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{m.filial_destino_nombre || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.observacion}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.usuario_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Baja */}
      <Modal open={!!modalBaja} onClose={() => setModalBaja(null)} title="Registrar Baja / Daño">
        {modalBaja && (
          <>
            <div className="modal-body">
              <div className="alert alert-warning">
                Producto: <strong>{modalBaja.nombre}</strong>
                {modalBaja.lote_nombre && <span> — Lote: <strong>{modalBaja.lote_nombre}</strong></span>}
              </div>
              {lotesProducto.length > 0 && (
                <div className="form-group">
                  <label>Lote asociado</label>
                  <select 
                    value={baja.lote_id} 
                    onChange={e => setBaja(b => ({ ...b, lote_id: e.target.value }))}
                    disabled={!!modalBaja.lote_id}
                  >
                    <option value="">-- Sin Lote / Stock General --</option>
                    {lotesProducto.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.numero_lote} (Stock: {l.cantidad_act} — Vto: {l.fecha_vto ? l.fecha_vto.slice(0, 10) : 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Motivo</label>
                <select value={baja.motivo} onChange={e => setBaja(b => ({ ...b, motivo: e.target.value }))}>
                  <option value="DAÑADO">Dañado</option>
                  <option value="VENCIDO">Vencido</option>
                  <option value="ROBO">Robo / Pérdida</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad a dar de baja</label>
                <input type="number" min="0.01" step="0.01" value={baja.cantidad} onChange={e => setBaja(b => ({ ...b, cantidad: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalBaja(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={doBaja}>Confirmar Baja</button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal Transferencia */}
      <Modal open={modalTransf} onClose={() => setModalTransf(false)} title="Transferencia entre Sucursales">
        <div className="modal-body">
          <div className="form-group">
            <label>Producto</label>
            <select value={transf.producto_id} onChange={e => setTransf(t => ({ ...t, producto_id: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {stock.map(s => <option key={`${s.id}-${s.filial_id}`} value={s.id}>{s.nombre} ({s.filial_nombre}: {s.cantidad})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Sucursal Origen</label>
              <select value={transf.filial_origen} onChange={e => setTransf(t => ({ ...t, filial_origen: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {filiales.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sucursal Destino</label>
              <select value={transf.filial_destino} onChange={e => setTransf(t => ({ ...t, filial_destino: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {filiales.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Cantidad</label>
            <input type="number" min="1" step="0.01" value={transf.cantidad} onChange={e => setTransf(t => ({ ...t, cantidad: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Observación</label>
            <input value={transf.observacion} onChange={e => setTransf(t => ({ ...t, observacion: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalTransf(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={doTransf}>↔️ Transferir</button>
        </div>
      </Modal>
    </div>
  )
}
