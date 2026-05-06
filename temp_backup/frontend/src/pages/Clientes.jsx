import { useState, useEffect } from 'react'
import api from '../api'

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

const EMPTY = { tipo: 'CLIENTE', razon_social: '', ruc: '', ci: '', telefono: '', email: '', direccion: '', condicion_iva: 'CONTRIBUYENTE', condicion_pago: 'CONTADO', limite_credito: 0, comision_pct: 0 }

export default function Clientes() {
  const [personas, setPersonas] = useState([])
  const [tipo, setTipo] = useState('CLIENTE')
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = () => api.personas(`?tipo=${tipo}&buscar=${buscar}`).then(setPersonas)
  useEffect(() => { load() }, [tipo, buscar])

  const openNew = () => { setForm({ ...EMPTY, tipo }); setEditId(null); setShowModal(true) }
  const openEdit = (p) => { setForm(p); setEditId(p.id); setShowModal(true) }

  const save = async () => {
    try {
      if (editId) await api.updatePersona(editId, form)
      else await api.createPersona(form)
      setMsg({ type: 'success', text: '✅ Guardado correctamente' })
      setShowModal(false); load()
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const TIPOS = [
    { value: 'CLIENTE', label: '👤 Clientes' },
    { value: 'PROVEEDOR', label: '🏭 Proveedores' },
    { value: 'VENDEDOR', label: '🤝 Vendedores' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">👥 Clientes, Proveedores y Vendedores</div>
          <div className="page-subtitle">Gestión del directorio de personas</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo</button>
      </div>

      {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div className="tabs">
        {TIPOS.map(t => <button key={t.value} className={`tab ${tipo === t.value ? 'active' : ''}`} onClick={() => setTipo(t.value)}>{t.label}</button>)}
      </div>

      <div className="search-bar">
        <div className="search-input-wrap" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input placeholder="Buscar por nombre, RUC o teléfono..." value={buscar} onChange={e => setBuscar(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre / Razón Social</th>
              <th>RUC / CI</th>
              <th>Teléfono</th>
              <th>Condición IVA</th>
              <th>Pago</th>
              {tipo === 'CLIENTE' && <th>Saldo Deuda</th>}
              {tipo === 'VENDEDOR' && <th>Comisión</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {personas.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.razon_social}</td>
                <td style={{ color: 'var(--text-muted)' }}>{p.ruc || p.ci || '—'}</td>
                <td>{p.telefono || '—'}</td>
                <td><span className={`badge badge-${p.condicion_iva === 'CONTRIBUYENTE' ? 'green' : 'gray'}`}>{p.condicion_iva}</span></td>
                <td><span className={`badge badge-${p.condicion_pago === 'CONTADO' ? 'blue' : 'gold'}`}>{p.condicion_pago}</span></td>
                {tipo === 'CLIENTE' && <td style={{ fontWeight: 700, color: p.saldo_cuenta > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                  {p.saldo_cuenta > 0 ? `₲ ${new Intl.NumberFormat('es-PY').format(p.saldo_cuenta)}` : '—'}
                </td>}
                {tipo === 'VENDEDOR' && <td>{p.comision_pct}%</td>}
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {personas.length === 0 && <div className="empty-state"><div className="empty-icon">👥</div><p>No se encontraron registros</p></div>}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar' : 'Nuevo'}>
        <div className="modal-body">
          <div className="form-group">
            <label>Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              <option value="CLIENTE">Cliente</option>
              <option value="PROVEEDOR">Proveedor</option>
              <option value="VENDEDOR">Vendedor</option>
              <option value="AMBOS">Cliente y Proveedor</option>
            </select>
          </div>
          <div className="form-group">
            <label>Nombre / Razón Social *</label>
            <input value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>RUC</label>
              <input value={form.ruc} onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))} placeholder="00000000-0" />
            </div>
            <div className="form-group">
              <label>CI</label>
              <input value={form.ci} onChange={e => setForm(f => ({ ...f, ci: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Condición IVA</label>
              <select value={form.condicion_iva} onChange={e => setForm(f => ({ ...f, condicion_iva: e.target.value }))}>
                <option value="CONTRIBUYENTE">Contribuyente</option>
                <option value="NO_CONTRIBUYENTE">No Contribuyente</option>
                <option value="EXENTO">Exento</option>
              </select>
            </div>
            <div className="form-group">
              <label>Condición de Pago</label>
              <select value={form.condicion_pago} onChange={e => setForm(f => ({ ...f, condicion_pago: e.target.value }))}>
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </div>
          </div>
          {form.condicion_pago === 'CREDITO' && (
            <div className="form-group">
              <label>Límite de Crédito (₲)</label>
              <input type="number" value={form.limite_credito} onChange={e => setForm(f => ({ ...f, limite_credito: e.target.value }))} />
            </div>
          )}
          {form.tipo === 'VENDEDOR' && (
            <div className="form-group">
              <label>Comisión (%)</label>
              <input type="number" value={form.comision_pct} onChange={e => setForm(f => ({ ...f, comision_pct: e.target.value }))} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>✓ Guardar</button>
        </div>
      </Modal>
    </div>
  )
}
