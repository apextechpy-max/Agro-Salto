import { useState, useEffect } from 'react'
import api from '../api'

const fmt = (n) => new Intl.NumberFormat('es-PY').format(Math.round(n || 0))

function Modal({ open, onClose, children, title }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const EMPTY = { tipo_inventario: 'AMBOS', nombre: '', descripcion: '', categoria_id: '', unidad_medida: 'UNIDAD', precio_costo: 0, precio_venta_menor: 0, precio_venta_mayor: 0, iva_tipo: '10', stock_minimo: 0, requiere_receta: false, activo: true }

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [filiales, setFiliales] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showAjuste, setShowAjuste] = useState(null)
  const [ajuste, setAjuste] = useState({ filial_id: '1', cantidad: 0, observacion: '' })
  const [buscar, setBuscar] = useState('')
  const [msg, setMsg] = useState(null)

  const load = () => api.productos(`?buscar=${buscar}`).then(setProductos)
  useEffect(() => {
    load()
    api.categorias().then(setCategorias)
    api.filiales().then(setFiliales)
  }, [buscar])

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowModal(true) }
  const openEdit = (p) => { setForm({ ...p, activo: p.activo === 1, tipo_inventario: p.tipo_inventario || 'AMBOS' }); setEditId(p.id); setShowModal(true) }

  const save = async () => {
    try {
      if (editId) await api.updateProducto(editId, form)
      else await api.createProducto(form)
      setMsg({ type: 'success', text: '✅ Producto guardado' })
      setShowModal(false); load()
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const doAjuste = async () => {
    try {
      await api.ajusteStock(showAjuste.id, { filial_id: parseInt(ajuste.filial_id), cantidad: parseFloat(ajuste.cantidad), observacion: ajuste.observacion })
      setMsg({ type: 'success', text: '✅ Stock ajustado' })
      setShowAjuste(null); load()
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const UNIDADES = ['UNIDAD', 'KG', 'GR', 'LT', 'ML', 'CAJA', 'BOLSA', 'SACO', 'FRASCO', 'AMPOLLA', 'DOSIS']

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🌿 Productos</div>
          <div className="page-subtitle">Catálogo de productos con precios y stock mínimo</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo Producto</button>
      </div>

      {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div className="search-bar">
        <div className="search-input-wrap" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Buscar por nombre o código..." value={buscar} onChange={e => setBuscar(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>IVA</th><th>P. Costo</th><th>P. Menor</th><th>P. Mayor</th><th>Stock Total</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.codigo}</td>
                <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                <td style={{ color: 'var(--text-muted)' }}>{p.categoria_nombre || '—'}</td>
                <td><span className="badge badge-green">{p.iva_tipo}%</span></td>
                <td>₲ {fmt(p.precio_costo)}</td>
                <td style={{ color: 'var(--green-primary)', fontWeight: 600 }}>₲ {fmt(p.precio_venta_menor)}</td>
                <td style={{ color: 'var(--blue)', fontWeight: 600 }}>₲ {fmt(p.precio_venta_mayor)}</td>
                <td style={{ fontWeight: 700 }}>{p.stock_total} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.unidad_medida}</span></td>
                <td><span className={`badge badge-${p.activo ? 'green' : 'gray'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Editar</button>
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowAjuste(p); setAjuste({ filial_id: filiales[0]?.id || 1, cantidad: 0, observacion: '' }) }}>Ajustar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productos.length === 0 && <div className="empty-state"><div className="empty-icon">🌿</div><p>Sin productos</p></div>}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar Producto' : 'Nuevo Producto'}>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Código *</label>
              <input value={editId ? form.codigo : '— Autogenerado —'} disabled style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', fontWeight: 700 }} />
            </div>
            <div className="form-group">
              <label>Tipo (Genera Código)</label>
              <select value={form.tipo_inventario} onChange={e => setForm(f => ({ ...f, tipo_inventario: e.target.value }))} disabled={!!editId}>
                <option value="AMBOS">Mixto (MIX)</option>
                <option value="CLINICA">Clínica (CLI)</option>
                <option value="PETSHOP">Petshop (PET)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unidad de Medida</label>
              <select value={form.unidad_medida} onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>IVA</label>
              <select value={form.iva_tipo} onChange={e => setForm(f => ({ ...f, iva_tipo: e.target.value }))}>
                <option value="10">10%</option>
                <option value="5">5%</option>
                <option value="EXENTO">Exento</option>
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Precio Costo (₲)</label>
              <input type="number" value={form.precio_costo} onChange={e => setForm(f => ({ ...f, precio_costo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Precio Minorista (₲)</label>
              <input type="number" value={form.precio_venta_menor} onChange={e => setForm(f => ({ ...f, precio_venta_menor: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Precio Mayorista (₲)</label>
              <input type="number" value={form.precio_venta_mayor} onChange={e => setForm(f => ({ ...f, precio_venta_mayor: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Stock Mínimo</label>
              <input type="number" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.requiere_receta} onChange={e => setForm(f => ({ ...f, requiere_receta: e.target.checked }))} style={{ width: 'auto' }} />
                Requiere receta
              </label>
            </div>
          </div>
          {editId && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} style={{ width: 'auto' }} />
                Producto activo
              </label>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>✓ Guardar</button>
        </div>
      </Modal>

      <Modal open={!!showAjuste} onClose={() => setShowAjuste(null)} title={`Ajustar Stock — ${showAjuste?.nombre}`}>
        {showAjuste && (
          <>
            <div className="modal-body">
              <div className="form-group">
                <label>Sucursal</label>
                <select value={ajuste.filial_id} onChange={e => setAjuste(a => ({ ...a, filial_id: e.target.value }))}>
                  {filiales.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad a agregar (negativo para restar)</label>
                <input type="number" step="0.01" value={ajuste.cantidad} onChange={e => setAjuste(a => ({ ...a, cantidad: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Motivo / Observación</label>
                <input value={ajuste.observacion} onChange={e => setAjuste(a => ({ ...a, observacion: e.target.value }))} placeholder="Ej: Conteo físico, corrección de error..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAjuste(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doAjuste}>✓ Aplicar Ajuste</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
